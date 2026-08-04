mod agent;
mod download;
mod llm;
mod project;
mod provider;
mod python;
mod sidecar;
mod unfold;

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
    tauri::async_runtime::spawn_blocking(move || sidecar::run_script(&app, &source))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
async fn test_provider(input: provider::ProviderInput) -> Result<(), String> {
    provider::test_provider(input).await
}

#[tauri::command]
fn save_provider(app: AppHandle, input: provider::ProviderInput) -> Result<(), String> {
    provider::store_api_key(&app, input.key.trim())?;
    // Verify the write by reading back, so the UI never reports success
    // while the key is actually unusable.
    provider::get_api_key(&app).map(|_| ())
}

#[tauri::command]
fn get_provider_status(app: AppHandle) -> Result<bool, String> {
    Ok(provider::has_api_key(&app))
}

#[tauri::command]
async fn chat_message(app: AppHandle, input: agent::ChatInput) -> Result<(), String> {
    agent::chat_message(app, input).await
}

#[tauri::command]
async fn clear_chat(app: AppHandle) {
    agent::clear_chat(&app).await;
}

#[tauri::command]
async fn list_projects(app: AppHandle) -> Result<Vec<project::ProjectInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || project::list_projects(&app))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn create_project(app: AppHandle, name: String) -> Result<project::ProjectInfo, String> {
    tauri::async_runtime::spawn_blocking(move || project::create_project(&app, name))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn load_project(app: AppHandle, id: String) -> Result<project::ProjectData, String> {
    agent::load_project(&app, id).await
}

#[tauri::command]
async fn save_project_source(app: AppHandle, id: String, source: String) -> Result<(), String> {
    agent::save_project_source(&app, id, source).await
}

#[tauri::command]
async fn rename_project(app: AppHandle, id: String, name: String) -> Result<project::ProjectInfo, String> {
    tauri::async_runtime::spawn_blocking(move || project::rename_project(&app, &id, name))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn delete_project(app: AppHandle, id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || project::delete_project(&app, &id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn write_downloads_file(
    app: AppHandle,
    file_name: String,
    data: Vec<u8>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || download::write_downloads_file(&app, &file_name, data))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn unfold(
    mesh: python::MeshObject,
    target_faces: Option<u32>,
) -> Result<unfold::Net, String> {
    tauri::async_runtime::spawn_blocking(move || unfold::unfold(&mesh, target_faces))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(sidecar::SidecarManager::default())
        .manage(agent::AgentState::default())
        .invoke_handler(tauri::generate_handler![
            check_python_setup,
            setup_python,
            run_cad_script,
            exit_app,
            test_provider,
            save_provider,
            get_provider_status,
            chat_message,
            clear_chat,
            list_projects,
            create_project,
            load_project,
            save_project_source,
            rename_project,
            delete_project,
            write_downloads_file,
            unfold,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
