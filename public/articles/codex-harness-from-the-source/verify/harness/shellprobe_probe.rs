// Reads JSON lines (an argv array each) from stdin; prints what the real parser/danger check say.
use std::io::BufRead;
use shellprobe::{bash, is_dangerous_command};
fn main() {
    for line in std::io::stdin().lock().lines() {
        let line = line.unwrap();
        if line.trim().is_empty() { continue; }
        let argv: Vec<String> = serde_json::from_str(&line).unwrap();
        let plain = bash::parse_shell_lc_plain_commands(&argv);
        let danger = is_dangerous_command::dangerous_command_match(&argv).is_some();
        println!("{}", serde_json::json!({"argv": argv, "plain_split": plain, "dangerous": danger}));
    }
}
