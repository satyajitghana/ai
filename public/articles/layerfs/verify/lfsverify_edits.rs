//! Real-store version of the article's edit experiment: write a base file, then write an edited copy, report the bytes the Commit stored.
use layerfs_bridge::control::{SdkCall, SdkValue};
use layerfs_history::{BranchId, ForkRequest, ForkSource, HistoryCatalog, HistoryCatalogConfig, HistoryName, LayerStackId};
use layerfs_persistence::{Handles, PersistenceConfig, SqliteAcquisitionSchema, SqlitePersistenceProfile};
use layerfs_project::{init, InitRequest};
use layerfs_storage::{Storage, StoragePolicy};
use layerfs_store_service::{bootstrap::open_store_observed, Owner, OwnerConfig, StoreService};
use layerfs_telemetry::timer::Timing;
use std::{path::PathBuf, time::{Duration, Instant}};
const BINDING: &[u8] = b"daemon-installed-store";
const CURSOR: [u8; 32] = [43; 32];
fn t(s: &str) -> SdkValue { SdkValue::text(s) }
fn map(f: Vec<(&str, SdkValue)>) -> SdkValue { SdkValue::Map(f.into_iter().map(|(a, b)| (a.to_owned(), b)).collect()) }
fn noise(seed: u64, n: usize) -> Vec<u8> { let mut s = seed | 1; (0..n).map(|_| { s ^= s << 13; s ^= s >> 7; s ^= s << 17; s as u8 }).collect() }
fn main() {
    let a: Vec<String> = std::env::args().collect();
    let work = PathBuf::from(&a[1]);
    let files: Vec<(String, Vec<u8>)> = a[2..].iter().flat_map(|spec| {
        let (path, lim) = spec.split_once(':').map(|(p, l)| (p, l.parse::<usize>().unwrap())).unwrap_or((spec.as_str(), usize::MAX));
        let b = std::fs::read(path).unwrap(); let b = b[..lim.min(b.len())].to_vec();
        vec![(format!("{}[..{}]", path.rsplit('/').next().unwrap(), b.len()), b)]
    }).collect();
    let _ = std::fs::remove_dir_all(&work); std::fs::create_dir_all(work.join("source")).unwrap();
    std::fs::write(work.join("source/seed.txt"), b"seed\n").unwrap();
    let sealed = work.join("sealed.sqlite");
    let config = PersistenceConfig::sqlite(&sealed).with_sqlite_profile(SqlitePersistenceProfile::Disposable).with_sqlite_acquisition(SqliteAcquisitionSchema::Tables);
    let handles = Handles::create(config.clone(), StoragePolicy::frozen_default(), &HistoryCatalogConfig { binding_key: BINDING.to_vec(), cursor_key: CURSOR, incarnation: 1 }).unwrap();
    let storage = Storage::new(handles.storage.clone()).unwrap();
    let init_ = Timing::disabled("i", |timing| init(&storage, &handles.history, InitRequest { source: &work.join("source"), acquisition: &handles.acquisition, stack: LayerStackId::from_authority([23; 16]), name: HistoryName::new("installed").unwrap(), scope_seed: [31; 32], deadline: Instant::now() + Duration::from_secs(60) }, timing)).0.unwrap();
    handles.history.fork(&ForkRequest { stack: init_.stack.id, branch: BranchId::from_authority([24; 16]), name: HistoryName::new("main").unwrap(), source: ForkSource::Layer(init_.stack.head_layer) }).unwrap();
    drop(storage);
    let s = handles.seal().unwrap(); let installed = work.join("store.sqlite"); std::fs::copy(s.path, &installed).unwrap();
    let pc = PersistenceConfig { path: installed, ..config };
    let oc = OwnerConfig::default();
    let opened = open_store_observed(pc, BINDING, CURSOR, oc.namespaces, 64 * 1024, layerfs_storage::ReservationBlocks::default()).unwrap();
    let owner = Owner::start(&work.join("overlay.sqlite"), layerfs_overlay::ProfileConfig::default(), oc).unwrap();
    let service = StoreService::new(opened, &owner);
    let call = |method: &str, mut f: Vec<(&str, SdkValue)>| { f.push(("project", t("installed"))); layerfs_api::call(&service, &SdkCall { method: method.into(), args: map(f) }).unwrap() };
    let mut k = 0;
    for (name, base) in &files {
        for case in ["overwrite", "insert", "append"] {
            k += 1;
            let br = format!("b{k}");
            call("branch.fork", vec![("name", t(&br))]);
            let before = service.store.save_counters().delta.chunk_depths;
            let w = |bytes: Vec<u8>| { let r = call("fs.write", vec![("branch", t(&br)), ("path", t("/big.bin")), ("bytes", SdkValue::Bytes(bytes))]); r.get("commit").and_then(|c| c.get_int("newStored")).unwrap() };
            let first = w(base.clone());
            let mid = base.len() / 2; let e = noise(900 + k as u64, 100);
            let changed = match case {
                "overwrite" => { let mut b = base.clone(); b[mid..mid + 100].copy_from_slice(&e); b }
                "insert" => [&base[..mid], &e[..], &base[mid..]].concat(),
                _ => [&base[..], &e[..]].concat(),
            };
            let mid_counters = service.store.save_counters().delta.chunk_depths;
            let second = w(changed);
            let after = service.store.save_counters().delta.chunk_depths;
            let full1: u64 = mid_counters[0] - before[0]; let d1: u64 = mid_counters[1..].iter().zip(before[1..].iter()).map(|(a, b)| a - b).sum();
            let full2: u64 = after[0] - mid_counters[0]; let d2: u64 = after[1..].iter().zip(mid_counters[1..].iter()).map(|(a, b)| a - b).sum();
            println!("{{\"file\":\"{name}\",\"size\":{},\"case\":\"{case}\",\"base_new_stored\":{first},\"base_chunks_full\":{full1},\"base_chunks_delta\":{d1},\"edit_new_stored\":{second},\"edit_chunks_full\":{full2},\"edit_chunks_delta\":{d2}}}", base.len());
        }
    }
}
