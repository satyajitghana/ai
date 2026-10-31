// Scratch harness (not OpenAI code): runs the real pre-approval step `maybe_parse_apply_patch_verified` on argv ["apply_patch", PATCH]
// in the current directory, and prints which variant came back. It never writes a file.
use codex_apply_patch::{maybe_parse_apply_patch_verified, MaybeApplyPatchVerified};
use codex_exec_server::LOCAL_FS;
use codex_utils_path_uri::PathUri;
#[tokio::main(flavor = "current_thread")]
async fn main() {
    let patch = std::env::args().nth(1).expect("patch");
    let cwd = PathUri::from_host_native_path(std::env::current_dir().unwrap()).unwrap();
    let argv = vec!["apply_patch".to_string(), patch];
    match maybe_parse_apply_patch_verified(&argv, &cwd, LOCAL_FS.as_ref(), None).await {
        MaybeApplyPatchVerified::Body(a) => { let _ = &a; println!("OK") }
        MaybeApplyPatchVerified::CorrectnessError(e) => println!("REJECTED {}", e.to_string().lines().next().unwrap_or("")),
        MaybeApplyPatchVerified::ShellParseError(_) => println!("SHELL_PARSE_ERROR"),
        MaybeApplyPatchVerified::NotApplyPatch => println!("NOT_APPLY_PATCH"),
    }
}
