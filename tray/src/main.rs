// The deco.chat menu bar app (Gimenes #4428, #4521). The shell only draws: the core is `vibebook tray`, run as a
// child process. The core writes one JSON line per menu, {"menu":[{id,label,checked?,enabled?}|{"sep":true}],
// "icon":"on"|"off"}, and this app writes one line per click, {"click":id}. The app has no logic of its own, so the
// shell can change later without a change to the core.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use std::io::{BufRead, BufReader, Write};
use std::process::{ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, RunEvent, Wry};

#[derive(Deserialize)]
struct Item {
    #[serde(default)]
    id: String,
    #[serde(default)]
    label: String,
    checked: Option<bool>,
    enabled: Option<bool>,
    #[serde(default)]
    sep: bool,
}

#[derive(Deserialize)]
struct Frame {
    menu: Vec<Item>,
    icon: Option<String>,
}

const ICON_ON: &[u8] = include_bytes!("../icons/tray-on.png");
const ICON_OFF: &[u8] = include_bytes!("../icons/tray-off.png");

/// The core's command: VIBEBOOK_TRAY_CORE (words split by spaces); else the `vibebook` binary shipped next to this
/// app's executable, as `vibebook watch --menu`, with the shipped `herdr` beside it (VIBEBOOK_HERDR_DIR); else
/// `vibebook tray` from PATH.
fn core_command() -> Command {
    if std::env::var("VIBEBOOK_TRAY_CORE").is_err() {
        if let Some(dir) = std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf())) {
            let cli = dir.join(format!("vibebook{}", std::env::consts::EXE_SUFFIX));
            if cli.exists() {
                let mut cmd = Command::new(cli);
                cmd.args(["watch", "--menu"]).env("VIBEBOOK_HERDR_DIR", &dir);
                return no_window(cmd);
            }
        }
    }
    let spec = std::env::var("VIBEBOOK_TRAY_CORE").unwrap_or_else(|_| "vibebook tray".into());
    let mut words = spec.split_whitespace();
    let mut cmd = Command::new(words.next().unwrap_or("vibebook"));
    cmd.args(words);
    no_window(cmd)
}

/// On Windows, a console program started from this app opens a console window: CREATE_NO_WINDOW stops that.
#[cfg(windows)]
fn no_window(mut cmd: Command) -> Command {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x0800_0000);
    cmd
}
#[cfg(not(windows))]
fn no_window(cmd: Command) -> Command {
    cmd
}

fn build_menu(app: &AppHandle, items: &[Item]) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::new(app)?;
    for item in items {
        if item.sep {
            menu.append(&PredefinedMenuItem::separator(app)?)?;
        } else if let Some(checked) = item.checked {
            menu.append(&CheckMenuItem::with_id(app, &item.id, &item.label, item.enabled.unwrap_or(true), checked, None::<&str>)?)?;
        } else {
            menu.append(&MenuItem::with_id(app, &item.id, &item.label, item.enabled.unwrap_or(true), None::<&str>)?)?;
        }
    }
    Ok(menu)
}

fn draw(app: &AppHandle, frame: Frame) {
    let Some(tray) = app.tray_by_id("main") else { return };
    if let Ok(menu) = build_menu(app, &frame.menu) {
        let _ = tray.set_menu(Some(menu));
    }
    let bytes = if frame.icon.as_deref() == Some("on") { ICON_ON } else { ICON_OFF };
    if let Ok(icon) = Image::from_bytes(bytes) {
        let _ = tray.set_icon(Some(icon));
        let _ = tray.set_icon_as_template(true);
    }
}

struct Core(Arc<Mutex<ChildStdin>>);

fn main() {
    let app = tauri::Builder::default()
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let mut child = core_command()
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::inherit())
                .spawn()
                .map_err(|e| format!("could not start the core (vibebook tray): {e}"))?;
            let stdin = Arc::new(Mutex::new(child.stdin.take().expect("core stdin")));
            let stdout = child.stdout.take().expect("core stdout");
            app.manage(Core(stdin.clone()));
            let loading = build_menu(app.handle(), &[Item { id: "loading".into(), label: "deco.chat…".into(), checked: None, enabled: Some(false), sep: false }])?;
            TrayIconBuilder::with_id("main")
                .icon(Image::from_bytes(ICON_OFF)?)
                .icon_as_template(true)
                .tooltip("deco.chat")
                .menu(&loading)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| {
                    let line = format!("{}\n", serde_json::json!({ "click": event.id().as_ref() }));
                    if let Some(core) = app.try_state::<Core>() {
                        if let Ok(mut w) = core.0.lock() {
                            let _ = w.write_all(line.as_bytes()).and_then(|_| w.flush());
                        }
                    }
                })
                .build(app)?;
            // One frame per line from the core; the menu is redrawn on the main thread (macOS needs it there).
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                    let Ok(frame) = serde_json::from_str::<Frame>(&line) else { continue };
                    let h = handle.clone();
                    let _ = handle.run_on_main_thread(move || draw(&h, frame));
                }
                // The core ended ("Sair", or it crashed): the app ends with it.
                let _ = child.wait();
                handle.exit(0);
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("tauri app");
    // A menu bar app has no window: closing nothing must not end it.
    app.run(|_, event| {
        if let RunEvent::ExitRequested { api, code, .. } = event {
            if code.is_none() {
                api.prevent_exit();
            }
        }
    });
}
