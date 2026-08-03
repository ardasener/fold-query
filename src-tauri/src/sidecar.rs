use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::sync::Mutex;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use serde::de::DeserializeOwned;
use tauri::{AppHandle, Manager};

use crate::python;

/// A single request may run a slow script; allow a generous window.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);

pub const SIDECAR_SOURCE: &str = include_str!("../python/sidecar.py");

#[derive(Debug, serde::Deserialize)]
struct SidecarResponse {
    id: u64,
    result: Option<serde_json::Value>,
    error: Option<String>,
}

/// A live sidecar process: request/response correlation over NDJSON stdio.
/// A reader thread pushes parsed responses into a channel; `call` waits for
/// the response matching its request id (requests are serialized by the
/// manager's mutex, so ordering is guaranteed).
struct Sidecar {
    child: Child,
    stdin: Mutex<ChildStdin>,
    rx: Receiver<SidecarResponse>,
    _reader: JoinHandle<()>,
    next_id: u64,
}

impl Sidecar {
    fn spawn(cache: &Path, venv_python: &Path) -> Result<Self, String> {
        let mut child = Command::new(venv_python)
            .arg(cache.join("sidecar.py"))
            .current_dir(cache)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn the Python sidecar: {e}"))?;

        let stdin = child.stdin.take().ok_or("sidecar stdin unavailable")?;
        let stdout = child.stdout.take().ok_or("sidecar stdout unavailable")?;

        let (tx, rx) = mpsc::channel();
        let reader = std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line) {
                    Ok(0) | Err(_) => break, // EOF or error: sidecar exited
                    Ok(_) => {
                        if let Ok(resp) = serde_json::from_str::<SidecarResponse>(line.trim()) {
                            let _ = tx.send(resp);
                        }
                    }
                }
            }
        });

        Ok(Self {
            child,
            stdin: Mutex::new(stdin),
            rx,
            _reader: reader,
            next_id: 0,
        })
    }

    fn alive(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    fn call<T: DeserializeOwned>(&mut self, method: &str, params: &serde_json::Value) -> Result<T, String> {
        let id = self.next_id;
        self.next_id += 1;
        let request = serde_json::json!({ "id": id, "method": method, "params": params });
        {
            let mut stdin = self.stdin.lock().unwrap();
            let mut line = serde_json::to_string(&request).map_err(|e| e.to_string())?;
            line.push('\n');
            stdin
                .write_all(line.as_bytes())
                .map_err(|e| format!("sidecar write failed: {e}"))?;
            stdin.flush().map_err(|e| format!("sidecar flush failed: {e}"))?;
        }

        let deadline = Instant::now() + REQUEST_TIMEOUT;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err("sidecar request timed out".to_string());
            }
            match self.rx.recv_timeout(remaining) {
                Ok(resp) if resp.id == id => {
                    if let Some(error) = resp.error {
                        return Err(error);
                    }
                    let value = resp.result.unwrap_or(serde_json::Value::Null);
                    return serde_json::from_value(value)
                        .map_err(|e| format!("unexpected sidecar result: {e}"));
                }
                Ok(_) => continue, // stale response from a superseded request
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    if !self.alive() {
                        return Err("sidecar process exited".to_string());
                    }
                    return Err("sidecar request timed out".to_string());
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    return Err("sidecar reader stopped".to_string());
                }
            }
        }
    }
}

/// Owns the sidecar process, respawning it on demand. Stored in Tauri state.
#[derive(Default)]
pub struct SidecarManager {
    inner: Mutex<Option<Sidecar>>,
}

impl SidecarManager {
    /// Send a JSON-RPC request; restarts the sidecar once if it died.
    pub fn call<T: DeserializeOwned>(
        &self,
        app: &AppHandle,
        method: &str,
        params: &serde_json::Value,
    ) -> Result<T, String> {
        let mut guard = self.inner.lock().unwrap();
        let alive = guard.as_mut().map(|s| s.alive()).unwrap_or(false);
        if !alive {
            let sidecar = self.spawn_locked(app)?;
            *guard = Some(sidecar);
        }
        match guard.as_mut().unwrap().call(method, params) {
            Ok(value) => Ok(value),
            Err(e) if e.contains("sidecar process exited") || e.contains("sidecar reader stopped") => {
                let sidecar = self.spawn_locked(app)?;
                *guard = Some(sidecar);
                guard.as_mut().unwrap().call(method, params)
            }
            Err(e) => Err(e),
        }
    }

    fn spawn_locked(&self, app: &AppHandle) -> Result<Sidecar, String> {
        let cache = python::cache_dir(app)?;
        std::fs::write(cache.join("sidecar.py"), SIDECAR_SOURCE)
            .map_err(|e| format!("could not write sidecar script: {e}"))?;
        let venv_python = python::ensure_environment(app)?;
        Sidecar::spawn(&cache, &venv_python)
    }
}

pub fn run_script(app: &AppHandle, source: &str) -> Result<python::ScriptResult, String> {
    let manager = app.state::<SidecarManager>();
    manager.call(
        app,
        "run_script",
        &serde_json::json!({ "source": source }),
    )
}

/// Async wrapper: the sidecar call is blocking, so it runs on a worker thread.
pub async fn run_script_async(app: &AppHandle, source: &str) -> Result<python::ScriptResult, String> {
    let app = app.clone();
    let source = source.to_string();
    tauri::async_runtime::spawn_blocking(move || run_script(&app, &source))
        .await
        .map_err(|e| e.to_string())?
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocsResult {
    pub symbol: String,
    pub docstring: String,
}

pub fn get_docs(app: &AppHandle, symbol: &str) -> Result<DocsResult, String> {
    let manager = app.state::<SidecarManager>();
    manager.call(app, "get_docs", &serde_json::json!({ "symbol": symbol }))
}

pub async fn get_docs_async(app: &AppHandle, symbol: &str) -> Result<DocsResult, String> {
    let app = app.clone();
    let symbol = symbol.to_string();
    tauri::async_runtime::spawn_blocking(move || get_docs(&app, &symbol))
        .await
        .map_err(|e| e.to_string())?
}
