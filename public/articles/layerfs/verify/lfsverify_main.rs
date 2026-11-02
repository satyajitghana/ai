//! Drives the real LayerFS Store (init + fs.apply commits, in process, no FUSE) over sampled git snapshots.
use layerfs_bridge::control::{SdkCall, SdkValue};
use layerfs_history::{BranchId, ForkRequest, ForkSource, HistoryCatalog, HistoryCatalogConfig, HistoryName, LayerStackId};
use layerfs_persistence::{Handles, PersistenceConfig, SqliteAcquisitionSchema, SqlitePersistenceProfile};
use layerfs_project::{init, InitRequest};
use layerfs_storage::{Storage, StoragePolicy};
use layerfs_store_service::{bootstrap::open_store_observed, Owner, OwnerConfig, StoreService};
use layerfs_telemetry::timer::Timing;
use std::{collections::{BTreeMap, HashSet}, io::Write, path::PathBuf, process::Command, time::{Duration, Instant}};

const BINDING: &[u8] = b"daemon-installed-store";
const CURSOR: [u8; 32] = [43; 32];

fn git(repo: &str, args: &[&str]) -> Vec<u8> {
    let o = Command::new("git").arg("-C").arg(repo).args(args).output().unwrap();
    assert!(o.status.success(), "git {args:?}");
    o.stdout
}
/// path -> (mode, sha, size) for a commit, excluding public/ and submodules.
fn tree(repo: &str, c: &str) -> BTreeMap<String, (String, String, u64)> {
    let out = git(repo, &["ls-tree", "-r", "-l", "-z", c]);
    let mut m = BTreeMap::new();
    for l in out.split(|b| *b == 0) {
        if l.is_empty() { continue; }
        let s = String::from_utf8_lossy(l).to_string();
        let (meta, path) = s.split_once('\t').unwrap();
        let f: Vec<&str> = meta.split_whitespace().collect();
        if f[1] != "blob" || path.starts_with("public/") || f[0] == "160000" { continue; }
        m.insert(path.to_string(), (f[0].to_string(), f[2].to_string(), f[3].parse().unwrap()));
    }
    m
}
fn blob(repo: &str, sha: &str) -> Vec<u8> { git(repo, &["cat-file", "blob", sha]) }
fn t(s: &str) -> SdkValue { SdkValue::text(s) }
fn map(f: Vec<(&str, SdkValue)>) -> SdkValue { SdkValue::Map(f.into_iter().map(|(a, b)| (a.to_owned(), b)).collect()) }

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let n: usize = a[1].parse().unwrap();
    let repo = a[2].as_str();
    let end = a[3].as_str();
    let work = PathBuf::from(&a[4]);
    let verify_n: usize = a.get(5).map(|s| s.parse().unwrap()).unwrap_or(200);
    let revs: Vec<String> = String::from_utf8(git(repo, &["rev-list", "--reverse", end])).unwrap().split_whitespace().map(String::from).collect();
    let step = (revs.len() - 1) as f64 / (n - 1) as f64;
    let sel: Vec<String> = (0..n).map(|i| revs[(i as f64 * step).round() as usize].clone()).collect();
    eprintln!("commits {} sampled {}", revs.len(), sel.len());
    let _ = std::fs::remove_dir_all(&work);
    std::fs::create_dir_all(&work).unwrap();
    let source = work.join("source");
    std::fs::create_dir(&source).unwrap();
    // genesis = snapshot 0
    let mut prev = tree(repo, &sel[0]);
    let mut dirs: HashSet<String> = HashSet::new();
    for (p, (mode, sha, _)) in &prev {
        let dest = source.join(p);
        std::fs::create_dir_all(dest.parent().unwrap()).unwrap();
        std::fs::write(&dest, blob(repo, sha)).unwrap();
        if mode == "100755" { use std::os::unix::fs::PermissionsExt; std::fs::set_permissions(&dest, std::fs::Permissions::from_mode(0o755)).unwrap(); }
        let mut d = p.as_str();
        while let Some((par, _)) = d.rsplit_once('/') { dirs.insert(par.to_string()); d = par; }
    }
    let sealed = work.join("sealed.sqlite");
    let config = PersistenceConfig::sqlite(&sealed).with_sqlite_profile(SqlitePersistenceProfile::Disposable).with_sqlite_acquisition(SqliteAcquisitionSchema::Tables);
    let policy = StoragePolicy::frozen_default();
    let handles = Handles::create(config.clone(), policy, &HistoryCatalogConfig { binding_key: BINDING.to_vec(), cursor_key: CURSOR, incarnation: 1 }).unwrap();
    let storage = Storage::new(handles.storage.clone()).unwrap();
    let t0 = Instant::now();
    let initialized = Timing::disabled("init", |timing| {
        init(&storage, &handles.history, InitRequest {
            source: &source, acquisition: &handles.acquisition,
            stack: LayerStackId::from_authority([23; 16]), name: HistoryName::new("installed").unwrap(),
            scope_seed: [31; 32], deadline: Instant::now() + Duration::from_secs(120),
        }, timing)
    }).0.unwrap();
    eprintln!("init entries={} in {:?}", initialized.entries, t0.elapsed());
    let branch = BranchId::from_authority([24; 16]);
    handles.history.fork(&ForkRequest { stack: initialized.stack.id, branch, name: HistoryName::new("main").unwrap(), source: ForkSource::Layer(initialized.stack.head_layer) }).unwrap();
    drop(storage);
    let sealed_out = handles.seal().unwrap();
    let installed = work.join("store.sqlite");
    std::fs::copy(sealed_out.path, &installed).unwrap();
    std::fs::remove_dir_all(&source).unwrap();
    let genesis_bytes = std::fs::metadata(&installed).unwrap().len();
    eprintln!("genesis store.sqlite {genesis_bytes}");

    let pc = PersistenceConfig { path: installed.clone(), ..config };
    let oc = OwnerConfig::default();
    let opened = open_store_observed(pc, BINDING, CURSOR, oc.namespaces, 64 * 1024, layerfs_storage::ReservationBlocks::default()).unwrap();
    let owner = Owner::start(&work.join("overlay.sqlite"), layerfs_overlay::ProfileConfig::default(), oc).unwrap();
    let service = StoreService::new(opened, &owner);
    let call = |method: &str, mut fields: Vec<(&str, SdkValue)>| {
        fields.push(("project", t("installed")));
        let c = SdkCall { method: method.into(), args: map(fields) };
        layerfs_api::call(&service, &c)
    };
    call("branch.fork", vec![("name", t("work"))]).unwrap();

    let mut rows = vec![];
    rows.push(format!("{{\"i\":0,\"new_stored\":0,\"file_bytes\":{genesis_bytes},\"changes\":0}}"));
    let mut cum_new: i64 = 0;
    let mut commits = 0usize;
    for i in 1..n {
        let cur = tree(repo, &sel[i]);
        let mut changes: Vec<SdkValue> = vec![];
        for p in prev.keys() { if !cur.contains_key(p) { changes.push(map(vec![("op", t("rm")), ("path", t(&format!("/{p}")))])); } }
        for (p, (mode, sha, _)) in &cur {
            if prev.get(p).map(|x| &x.1) == Some(sha) { continue; }
            let mut d = p.as_str();
            let mut need = vec![];
            while let Some((par, _)) = d.rsplit_once('/') { if !dirs.contains(par) { need.push(par.to_string()); } d = par; }
            for par in need.into_iter().rev() { dirs.insert(par.clone()); changes.push(map(vec![("op", t("mkdir")), ("path", t(&format!("/{par}")))])); }
            let mut f = vec![("op", t("write")), ("path", t(&format!("/{p}"))), ("bytes", SdkValue::Bytes(blob(repo, sha)))];
            if mode == "100755" { f.push(("mode", SdkValue::Int(0o755))); }
            changes.push(map(f));
        }
        let nch = changes.len();
        let mut ns: i64 = 0;
        for chunk in changes.chunks(300) {
            let r = call("fs.apply", vec![("branch", t("work")), ("changes", SdkValue::List(chunk.to_vec()))]).unwrap_or_else(|e| panic!("snapshot {i} apply: {e:?}"));
            ns += r.get("commit").and_then(|c| c.get_int("newStored")).unwrap_or(0);
            commits += 1;
        }
        cum_new += ns;
        let fb = std::fs::metadata(&installed).unwrap().len();
        rows.push(format!("{{\"i\":{i},\"new_stored\":{ns},\"file_bytes\":{fb},\"changes\":{nch}}}"));
        if i % 10 == 0 { eprintln!("snap {i}/{n} changes={nch} cum_new_stored={cum_new} file={fb}"); }
        prev = cur;
    }
    // read-back verification of the last snapshot: every file's size, and the text of every file that came back whole
    let mut binary = 0; let (mut checked, mut size_bad, mut text_checked, mut text_bad) = (0, 0, 0, 0);
    let keys: Vec<&String> = prev.keys().collect();
    let stride = (keys.len() / verify_n.max(1)).max(1);
    for p in keys.iter().step_by(stride.min(1).max(1)) {
        let r = call("fs.read", vec![("branch", t("work")), ("path", t(&format!("/{p}")))]);
        checked += 1;
        let v = match r { Ok(v) => v, Err(e) => { if e.code == "Binary" { binary += 1; } else { size_bad += 1; eprintln!("read error {p}: {e:?}"); } continue; } };
        if v.get_int("size") != Some(prev[*p].2 as i64) { size_bad += 1; if size_bad <= 5 { eprintln!("size mismatch {p}: store {:?} git {}", v.get_int("size"), prev[*p].2); } continue; }
        let trunc = matches!(v.get("truncated"), Some(SdkValue::Bool(true)));
        if !trunc {
            if let Ok(want) = String::from_utf8(blob(repo, &prev[*p].1)) {
                text_checked += 1;
                if v.get_text("text") != Some(want.as_str()) { text_bad += 1; }
            }
        }
    }
    let fin = std::fs::metadata(&installed).unwrap().len();
    let out = format!("{{\"n\":{n},\"end\":\"{end}\",\"genesis_bytes\":{genesis_bytes},\"final_file_bytes\":{fin},\"sum_new_stored\":{cum_new},\"apply_commits\":{commits},\"read_checked\":{checked},\"binary_refused\":{binary},\"size_bad\":{size_bad},\"text_checked\":{text_checked},\"text_bad\":{text_bad},\"rows\":[{}]}}", rows.join(","));
    std::fs::File::create(work.join("result.json")).unwrap().write_all(out.as_bytes()).unwrap();
    println!("{}", &out[..out.find("\"rows\"").unwrap()]);
}
