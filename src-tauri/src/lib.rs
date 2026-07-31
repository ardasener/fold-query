mod python;

use tauri::AppHandle;

#[tauri::command]
async fn check_python_setup(app: AppHandle) -> Result<python::SetupStatus, String> {
    tauri::async_runtime::spawn_blocking(move || python::check_setup(&app))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn setup_python(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || python::ensure_environment(&app).map(|_| ()))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn run_cad_script(app: AppHandle, source: String) -> Result<python::ScriptResult, String> {
    tauri::async_runtime::spawn_blocking(move || python::run_cad_script(&app, source))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            check_python_setup,
            setup_python,
            run_cad_script,
            exit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
