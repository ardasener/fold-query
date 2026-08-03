use std::path::PathBuf;

use tauri::{AppHandle, Manager};

pub fn downloads_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .download_dir()
        .map_err(|e| format!("Could not resolve the Downloads directory: {e}"))
}

/// Writes the given bytes to the OS Downloads directory and returns the
/// written file path.
pub fn write_downloads_file(app: &AppHandle, file_name: &str, data: Vec<u8>) -> Result<String, String> {
    let dir = downloads_dir(app)?;
    let path = dir.join(file_name);
    std::fs::write(&path, &data)
        .map_err(|e| format!("Could not write {}: {e}", path.display()))?;
    Ok(path.display().to_string())
}
