use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

/// Minimum supported Python version (CadQuery 2.8 requires >= 3.11).
pub const MIN_PYTHON_MINOR: u32 = 11;

pub const REQUIREMENTS: &str = "cadquery>=2.8,<3\n";

pub const RUNNER_SOURCE: &str = include_str!("../python/runner.py");

#[derive(Serialize, Clone, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum MissingComponent {
    Python,
    PythonVersion,
    Venv,
    Pip,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupStatus {
    pub ready: bool,
    pub missing: Option<MissingComponent>,
    pub venv_exists: bool,
    pub system_python: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub step: String,
    pub message: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshObject {
    pub vertices: Vec<f64>,
    pub faces: Vec<u32>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptResult {
    pub stdout: String,
    pub error: Option<String>,
    pub objects: Vec<MeshObject>,
}

struct PythonVersion {
    major: u32,
    minor: u32,
}

fn parse_python_version(text: &str) -> Option<PythonVersion> {
    // Accept "Python 3.12.4" (stdout on some builds, stderr on others).
    let mut parts = text.split_whitespace();
    let mut num = parts.next()?.to_string();
    if num == "Python" {
        num = parts.next()?.to_string();
    }
    let mut it = num.split('.');
    let major = it.next()?.parse().ok()?;
    let minor = it.next()?.parse().ok()?;
    Some(PythonVersion { major, minor })
}

fn find_system_python() -> Option<(PathBuf, PythonVersion)> {
    for candidate in ["python3", "python"] {
        let Ok(out) = Command::new(candidate).arg("--version").output() else {
            continue;
        };
        if !out.status.success() {
            continue;
        }
        let stdout = String::from_utf8_lossy(&out.stdout);
        let stderr = String::from_utf8_lossy(&out.stderr);
        let text = if stdout.trim().is_empty() { stderr } else { stdout };
        if let Some(version) = parse_python_version(&text) {
            return Some((PathBuf::from(candidate), version));
        }
    }
    None
}

fn module_available(python: &Path, module: &str) -> bool {
    Command::new(python)
        .arg("-m")
        .arg(module)
        .arg("--help")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

pub(crate) fn cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_cache_dir()
        .map_err(|e| format!("Could not resolve the app cache directory: {e}"))
}

fn venv_python_path(app: &AppHandle) -> PathBuf {
    let base = cache_dir(app).unwrap_or_else(|_| PathBuf::from("."));
    if cfg!(windows) {
        base.join("venv").join("Scripts").join("python.exe")
    } else {
        base.join("venv").join("bin").join("python")
    }
}

fn venv_works(python: &Path) -> bool {
    Command::new(python)
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn emit(app: &AppHandle, step: &str, message: &str) {
    let _ = app.emit(
        "python-setup-progress",
        ProgressEvent {
            step: step.to_string(),
            message: message.to_string(),
        },
    );
}

fn run_status(app: &AppHandle, python: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new(python)
        .args(args)
        .current_dir(cache_dir(app)?)
        .output()
        .map_err(|e| format!("Failed to run {python:?}: {e}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let tail: String = stderr.chars().rev().take(2000).collect::<String>().chars().rev().collect();
        Err(if tail.trim().is_empty() {
            "Command failed with no output".to_string()
        } else {
            tail
        })
    }
}

/// Pure detection: reports readiness and which component is missing.
pub fn check_setup(app: &AppHandle) -> Result<SetupStatus, String> {
    let venv_py = venv_python_path(app);
    if venv_works(&venv_py) {
        return Ok(SetupStatus {
            ready: true,
            missing: None,
            venv_exists: true,
            system_python: None,
        });
    }

    let Some((python, version)) = find_system_python() else {
        return Ok(SetupStatus {
            ready: false,
            missing: Some(MissingComponent::Python),
            venv_exists: false,
            system_python: None,
        });
    };

    let mut missing = None;
    if version.major != 3 || version.minor < MIN_PYTHON_MINOR {
        missing = Some(MissingComponent::PythonVersion);
    } else if !module_available(&python, "venv") {
        missing = Some(MissingComponent::Venv);
    } else if !module_available(&python, "pip") {
        missing = Some(MissingComponent::Pip);
    }

    Ok(SetupStatus {
        ready: false,
        missing,
        venv_exists: false,
        system_python: Some(format!("{}.{}", version.major, version.minor)),
    })
}

/// Ensures a working venv exists; creates and populates it when needed.
/// Emits `python-setup-progress` events and returns the venv python path.
pub fn ensure_environment(app: &AppHandle) -> Result<PathBuf, String> {
    let cache = cache_dir(app)?;
    let venv_py = venv_python_path(app);

    // Keep the runner and requirements in sync with the embedded versions on
    // every call (cheap and idempotent), so app updates propagate to the cache.
    std::fs::create_dir_all(&cache).map_err(|e| format!("Could not create cache dir: {e}"))?;
    std::fs::write(cache.join("runner.py"), RUNNER_SOURCE)
        .map_err(|e| format!("Could not write runner: {e}"))?;
    std::fs::write(cache.join("requirements.txt"), REQUIREMENTS)
        .map_err(|e| format!("Could not write requirements: {e}"))?;

    if venv_works(&venv_py) {
        return Ok(venv_py);
    }

    let (python, version) = find_system_python().ok_or("Python 3 was not found on this system.")?;
    if version.major != 3 || version.minor < MIN_PYTHON_MINOR {
        return Err(format!(
            "Python {}.{} is too old; version 3.{}+ is required.",
            version.major, version.minor, MIN_PYTHON_MINOR
        ));
    }
    if !module_available(&python, "venv") {
        return Err("The Python `venv` module is not available.".to_string());
    }
    if !module_available(&python, "pip") {
        return Err("The Python `pip` module is not available.".to_string());
    }

    emit(app, "detect", "Python 3 found, creating virtual environment…");
    let venv_dir = cache.join("venv");
    let status = Command::new(&python)
        .arg("-m")
        .arg("venv")
        .arg(&venv_dir)
        .status()
        .map_err(|e| format!("Failed to run venv creation: {e}"))?;
    if !status.success() {
        return Err("Virtual environment creation failed.".to_string());
    }

    emit(app, "venv", "Virtual environment created");

    emit(
        app,
        "install",
        "Installing dependencies (this can take a few minutes)…",
    );
    run_status(app, &venv_py, &["-m", "pip", "install", "--upgrade", "pip"])
        .map_err(|e| format!("Failed to upgrade pip: {e}"))?;
    run_status(
        app,
        &venv_py,
        &["-m", "pip", "install", "-r", cache.join("requirements.txt").to_str().unwrap_or("requirements.txt")],
    )
    .map_err(|e| format!("Dependency installation failed:\n{e}"))?;

    emit(app, "verify", "Verifying CadQuery…");
    run_status(app, &venv_py, &["-c", "import cadquery"])
        .map_err(|e| format!("CadQuery verification failed:\n{e}"))?;

    emit(app, "verify", "CadQuery is ready");
    Ok(venv_py)
}
