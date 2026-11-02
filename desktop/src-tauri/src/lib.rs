//! A11yLens Desktop: окно Tauri 2, Windows-таргет.
//!
//! Бэкенд окна намеренно тонкий: он хранит два JSON-файла в app data
//! (состояние первого запуска и история сканов) и запускает sidecar —
//! CLI-движок (Node SEA-бинарник a11ylens-engine.exe или, в dev-режиме,
//! `node src/cli/bin.mjs`). Вся логика сканирования — в движке, окно
//! только собирает отчёт.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::Manager;

/// Состояние первого запуска: этика + согласие на докачку Chromium (R04.1/R04.2).
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct AppState {
    ethics_accepted: bool,
    chromium_consent: bool,
    theme: String,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            ethics_accepted: false,
            chromium_consent: false,
            theme: "dark".to_string(),
        }
    }
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BrowserStatus {
    installed: bool,
    browsers_dir: String,
}

/// Результат запуска sidecar: stdout/stderr и код выхода.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EngineRun {
    exit_code: i32,
    stdout: String,
    stderr: String,
}

/// Чем запускается движок: SEA-бинарник или dev-режим через node + репозиторий.
enum EngineLaunch {
    Sidecar(PathBuf),
    NodeCli(PathBuf),
}

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("не удалось определить каталог данных: {error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("не удалось создать каталог данных: {error}"))?;
    Ok(dir)
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Option<T> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write_json(path: &Path, value: &serde_json::Value) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    fs::write(path, text).map_err(|error| format!("не удалось записать {}: {error}", path.display()))
}

#[tauri::command]
fn load_state(app: tauri::AppHandle) -> AppState {
    data_dir(&app)
        .ok()
        .and_then(|dir| read_json::<AppState>(&dir.join("state.json")))
        .unwrap_or_default()
}

#[tauri::command]
fn save_state(app: tauri::AppHandle, state: AppState) -> Result<(), String> {
    let value = serde_json::to_value(&state).map_err(|error| error.to_string())?;
    write_json(&data_dir(&app)?.join("state.json"), &value)
}

/// История — список записей, форму которых владеет фронт (desktop/src/lib/history.ts).
/// Бэкенд хранит её как JSON-массив, не зная полей.
#[tauri::command]
fn load_history(app: tauri::AppHandle) -> Vec<serde_json::Value> {
    data_dir(&app)
        .ok()
        .and_then(|dir| read_json::<Vec<serde_json::Value>>(&dir.join("history.json")))
        .unwrap_or_default()
}

#[tauri::command]
fn save_history(app: tauri::AppHandle, list: Vec<serde_json::Value>) -> Result<(), String> {
    let value = serde_json::to_value(&list).map_err(|error| error.to_string())?;
    write_json(&data_dir(&app)?.join("history.json"), &value)
}

/// Установлен ли Playwright-Chromium: ищем chromium-*/chrome-win*/chrome.exe
/// в %LOCALAPPDATA%\ms-playwright (раскладка каталога менялась: chrome-win,
/// chrome-win64 — принимаем обе).
#[tauri::command]
fn check_browser() -> BrowserStatus {
    let Some(local) = std::env::var_os("LOCALAPPDATA").map(PathBuf::from) else {
        return BrowserStatus { installed: false, browsers_dir: String::new() };
    };
    let browsers_dir = local.join("ms-playwright");
    let installed = fs::read_dir(&browsers_dir)
        .map(|entries| {
            entries
                .flatten()
                .filter(|entry| {
                    entry
                        .file_name()
                        .to_string_lossy()
                        .starts_with("chromium-")
                })
                .any(|entry| {
                    ["chrome-win", "chrome-win64"].iter().any(|layout| {
                        let dir = entry.path().join(layout);
                        dir.join("chrome.exe").is_file() || dir.join("chrome").is_file()
                    })
                })
        })
        .unwrap_or(false);
    BrowserStatus {
        installed,
        browsers_dir: browsers_dir.to_string_lossy().into_owned(),
    }
}

/// Где движок: 1) переменная окружения A11YLENS_ENGINE; 2) рядом с exe окна
/// (так кладёт bundler externalBin); 3) каталог ресурсов; 4) dev-фолбэк —
/// node + репозиторный src/cli/bin.mjs.
fn resolve_engine(app: &tauri::AppHandle) -> Result<EngineLaunch, String> {
    if let Some(path) = std::env::var_os("A11YLENS_ENGINE") {
        let path = PathBuf::from(path);
        if path.is_file() {
            return Ok(EngineLaunch::Sidecar(path));
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let sidecar = dir.join("a11ylens-engine.exe");
            if sidecar.is_file() {
                return Ok(EngineLaunch::Sidecar(sidecar));
            }
        }
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        let sidecar = resource_dir.join("binaries").join("a11ylens-engine.exe");
        if sidecar.is_file() {
            return Ok(EngineLaunch::Sidecar(sidecar));
        }
    }
    let repo_cli = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("src")
        .join("cli")
        .join("bin.mjs");
    let repo_cli = repo_cli
        .canonicalize()
        .map_err(|_| "sidecar a11ylens-engine.exe не найден; соберите его: desktop/scripts/build-sidecar.mjs".to_string())?;
    Ok(EngineLaunch::NodeCli(repo_cli))
}

fn spawn_engine(launch: &EngineLaunch, args: &[String]) -> Result<EngineRun, String> {
    let mut command = match launch {
        EngineLaunch::Sidecar(path) => {
            let mut command = Command::new(path);
            command.args(args);
            command
        }
        EngineLaunch::NodeCli(cli) => {
            let mut command = Command::new("node");
            command.arg(cli).args(args);
            command
        }
    };
    hide_console(&mut command);
    let output = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|error| format!("не удалось запустить движок: {error}"))?;
    Ok(EngineRun {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

#[cfg(windows)]
fn hide_console(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    // CREATE_NO_WINDOW: рядом с окном не должно мигать консолей sidecar.
    command.creation_flags(0x0800_0000);
}

#[cfg(not(windows))]
fn hide_console(_command: &mut Command) {}

#[tauri::command]
async fn run_engine(app: tauri::AppHandle, args: Vec<String>) -> Result<EngineRun, String> {
    let launch = resolve_engine(&app)?;
    tauri::async_runtime::spawn_blocking(move || spawn_engine(&launch, &args))
        .await
        .map_err(|error| format!("поток движка упал: {error}"))?
}

/// Докачка Playwright-Chromium (R04.1, с согласия пользователя — гейт на фронте).
/// SEA-sidecar умеет подкоманду install-browser; в dev-режиме — npx playwright.
#[tauri::command]
async fn install_browser(app: tauri::AppHandle) -> Result<EngineRun, String> {
    let launch = resolve_engine(&app)?;
    tauri::async_runtime::spawn_blocking(move || match &launch {
        EngineLaunch::Sidecar(path) => spawn_engine(
            &EngineLaunch::Sidecar(path.clone()),
            &["install-browser".to_string()],
        ),
        EngineLaunch::NodeCli(_) => {
            let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("..");
            let mut command = Command::new("npx");
            command
                .arg("-y")
                .arg("playwright")
                .arg("install")
                .arg("chromium")
                .current_dir(repo_root);
            hide_console(&mut command);
            let output = command
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
                .map_err(|error| format!("не удалось запустить npx playwright: {error}"))?;
            Ok(EngineRun {
                exit_code: output.status.code().unwrap_or(-1),
                stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            })
        }
    })
    .await
    .map_err(|error| format!("поток установки упал: {error}"))?
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_state,
            load_history,
            save_history,
            check_browser,
            run_engine,
            install_browser
        ])
        .run(tauri::generate_context!())
        .expect("не удалось запустить A11yLens Desktop");
}
