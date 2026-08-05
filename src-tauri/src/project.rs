use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const DEFAULT_SCRIPT: &str = r#"import cadquery as cq

# A box with chamfered vertical edges
result = (
    cq.Workplane("XY")
    .box(40, 40, 20)
    .edges("|Z")
    .chamfer(4)
)

show_object(result)
"#;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub created_at: u64,
    pub updated_at: u64,
    #[serde(default)]
    pub mode: ProjectMode,
}

/// How a project's model is produced.
#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
#[serde(rename_all = "lowercase")]
pub enum ProjectMode {
    /// Model comes from a CadQuery script (`model.py`).
    #[default]
    Code,
    /// Model is a fixed imported mesh (`mesh.json`), not editable as code.
    Mesh,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectData {
    pub id: String,
    pub name: String,
    /// CadQuery script source. Empty for mesh projects.
    pub source: String,
    pub messages: Vec<Value>,
    pub mode: ProjectMode,
    /// Normalized mesh for mesh projects (present only in mesh mode).
    pub mesh: Option<crate::python::MeshObject>,
    /// Scale (unit conversion) applied to the mesh. Present only in mesh mode.
    pub scale: Option<f64>,
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn projects_root(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve the app data directory: {e}"))?
        .join("projects");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create projects dir: {e}"))?;
    Ok(dir)
}

fn atomic_write(path: &std::path::Path, contents: &[u8]) -> Result<(), String> {
    let tmp = std::path::PathBuf::from(format!("{}.tmp", path.display()));
    std::fs::write(&tmp, contents).map_err(|e| format!("Could not write {}: {e}", tmp.display()))?;
    std::fs::rename(&tmp, path).map_err(|e| format!("Could not finalize {}: {e}", path.display()))?;
    Ok(())
}

fn read_meta(dir: &std::path::Path) -> Result<ProjectInfo, String> {
    let raw = std::fs::read(dir.join("meta.json"))
        .map_err(|e| format!("Could not read project meta: {e}"))?;
    serde_json::from_slice(&raw).map_err(|e| format!("Invalid project meta: {e}"))
}

fn write_meta(dir: &std::path::Path, info: &ProjectInfo) -> Result<(), String> {
    let raw = serde_json::to_vec(info).map_err(|e| e.to_string())?;
    atomic_write(&dir.join("meta.json"), &raw)
}

fn touch(dir: &std::path::Path, info: &mut ProjectInfo) -> Result<(), String> {
    info.updated_at = now_millis();
    write_meta(dir, info)
}

fn project_dir(root: &std::path::Path, id: &str) -> Result<PathBuf, String> {
    let dir = root.join(id);
    if !dir.is_dir() {
        return Err(format!("Project '{id}' does not exist"));
    }
    Ok(dir)
}

pub fn list_projects(app: &AppHandle) -> Result<Vec<ProjectInfo>, String> {
    let root = projects_root(app)?;
    let mut projects: Vec<ProjectInfo> = Vec::new();
    for entry in std::fs::read_dir(&root).map_err(|e| format!("Could not list projects: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if let Ok(info) = read_meta(&path) {
            projects.push(info);
        }
    }
    projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(projects)
}

pub fn create_project(app: &AppHandle, name: String) -> Result<ProjectInfo, String> {
    let root = projects_root(app)?;
    let id = Uuid::new_v4().to_string();
    let dir = root.join(&id);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create project dir: {e}"))?;

    let now = now_millis();
    let info = ProjectInfo {
        id: id.clone(),
        name,
        created_at: now,
        updated_at: now,
        mode: ProjectMode::Code,
    };
    write_meta(&dir, &info)?;
    atomic_write(&dir.join("model.py"), DEFAULT_SCRIPT.as_bytes())?;
    atomic_write(&dir.join("chat.json"), b"[]")?;
    Ok(info)
}

pub fn load_project_data(app: &AppHandle, id: &str) -> Result<ProjectData, String> {
    let root = projects_root(app)?;
    let dir = project_dir(&root, id)?;
    load_project_data_from_dir(&dir)
}

/// Load project data given the project directory (pure, testable).
fn load_project_data_from_dir(dir: &std::path::Path) -> Result<ProjectData, String> {
    let info = read_meta(dir)?;
    let messages: Vec<Value> = match std::fs::read(dir.join("chat.json")) {
        Ok(raw) => serde_json::from_slice(&raw).unwrap_or_default(),
        Err(_) => Vec::new(),
    };

    // The persisted mode is authoritative; mesh projects are never treated as
    // code even if stray files (e.g. an old model.py) exist.
    let (source, mode, mesh, scale) = match info.mode {
        ProjectMode::Mesh => {
            let raw = std::fs::read(dir.join("mesh.json"))
                .map_err(|e| format!("Could not read project mesh: {e}"))?;
            let mesh: crate::python::MeshObject =
                serde_json::from_slice(&raw).map_err(|e| format!("Invalid project mesh: {e}"))?;
            let scale: f64 = serde_json::from_slice(
                &std::fs::read(dir.join("scale.json"))
                    .map_err(|_| "Could not read project scale".to_string())?,
            )
            .map_err(|e| format!("Invalid project scale: {e}"))?;
            (String::new(), ProjectMode::Mesh, Some(mesh), Some(scale))
        }
        ProjectMode::Code => {
            let source = match std::fs::read_to_string(dir.join("model.py")) {
                Ok(s) => s,
                Err(_) => DEFAULT_SCRIPT.to_string(),
            };
            (source, ProjectMode::Code, None, None)
        }
    };

    Ok(ProjectData {
        id: info.id.clone(),
        name: info.name,
        source,
        messages,
        mode,
        mesh,
        scale,
    })
}

pub fn save_source(app: &AppHandle, id: &str, source: &str) -> Result<(), String> {
    let root = projects_root(app)?;
    let dir = project_dir(&root, id)?;
    // Mesh projects have no script; refuse writes so a stray model.py never
    // corrupts the project layout.
    if read_meta(&dir)?.mode == ProjectMode::Mesh {
        return Err("Imported mesh projects cannot be edited as code".to_string());
    }
    let mut info = read_meta(&dir)?;
    atomic_write(&dir.join("model.py"), source.as_bytes())?;
    touch(&dir, &mut info)
}

pub fn save_chat(app: &AppHandle, id: &str, messages: &[Value]) -> Result<(), String> {
    let root = projects_root(app)?;
    let dir = project_dir(&root, id)?;
    let mut info = read_meta(&dir)?;
    let raw = serde_json::to_vec(messages).map_err(|e| e.to_string())?;
    atomic_write(&dir.join("chat.json"), &raw)?;
    touch(&dir, &mut info)
}

pub fn rename_project(app: &AppHandle, id: &str, name: String) -> Result<ProjectInfo, String> {
    let root = projects_root(app)?;
    let dir = project_dir(&root, id)?;
    let mut info = read_meta(&dir)?;
    info.name = name;
    touch(&dir, &mut info)?;
    Ok(info)
}

pub fn delete_project(app: &AppHandle, id: &str) -> Result<(), String> {
    let root = projects_root(app)?;
    let dir = project_dir(&root, id)?;
    std::fs::remove_dir_all(&dir).map_err(|e| format!("Could not delete project: {e}"))
}

/// Save the scale (unit conversion) factor for a mesh project.
pub fn save_scale(app: &AppHandle, id: &str, scale: f64) -> Result<(), String> {
    let root = projects_root(app)?;
    let dir = project_dir(&root, id)?;
    let mut info = read_meta(&dir)?;
    let raw = serde_json::to_vec(&scale).map_err(|e| e.to_string())?;
    atomic_write(&dir.join("scale.json"), &raw)?;
    touch(&dir, &mut info)
}

/// Create a mesh project: a UUID dir holding the source file, the normalized
/// mesh (`mesh.json`), a `scale.json`, and `meta.json`. Returns the new info.
pub fn import_mesh(
    app: &AppHandle,
    name: String,
    source_name: &str,
    source_bytes: &[u8],
    mesh: &crate::python::MeshObject,
    scale: f64,
) -> Result<ProjectInfo, String> {
    let root = projects_root(app)?;
    let id = Uuid::new_v4().to_string();
    let dir = root.join(&id);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create project dir: {e}"))?;

    let now = now_millis();
    let info = ProjectInfo {
        id: id.clone(),
        name,
        created_at: now,
        updated_at: now,
        mode: ProjectMode::Mesh,
    };
    write_meta(&dir, &info)?;
    atomic_write(&dir.join(source_name), source_bytes)?;
    let mesh_raw = serde_json::to_vec(mesh).map_err(|e| e.to_string())?;
    atomic_write(&dir.join("mesh.json"), &mesh_raw)?;
    let scale_raw = serde_json::to_vec(&scale).map_err(|e| e.to_string())?;
    atomic_write(&dir.join("scale.json"), &scale_raw)?;
    atomic_write(&dir.join("chat.json"), b"[]")?;
    Ok(info)
}

/// Create a code project from an imported CAD solid: copies the source file
/// into the project dir and writes a `model.py` that loads it via CadQuery.
pub fn import_cad_file(
    app: &AppHandle,
    name: String,
    source_name: &str,
    source_bytes: &[u8],
) -> Result<ProjectInfo, String> {
    let root = projects_root(app)?;
    let id = Uuid::new_v4().to_string();
    let dir = root.join(&id);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create project dir: {e}"))?;

    let now = now_millis();
    let info = ProjectInfo {
        id: id.clone(),
        name,
        created_at: now,
        updated_at: now,
        mode: ProjectMode::Code,
    };
    write_meta(&dir, &info)?;
    atomic_write(&dir.join(source_name), source_bytes)?;

    let file_path = dir.join(source_name);
    let script = format!(
        r#"import cadquery as cq

# Imported CAD model
result = cq.importers.importStep(r"{path}")

show_object(result)
"#,
        path = file_path.display()
    );
    atomic_write(&dir.join("model.py"), script.as_bytes())?;
    atomic_write(&dir.join("chat.json"), b"[]")?;
    Ok(info)
}

/// Read a file's bytes (for the frontend to feed three.js loaders).
pub fn read_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Could not read file: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::python::MeshObject;
    use std::path::PathBuf;

    fn temp_root(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("foldquery-test-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn tri_mesh() -> MeshObject {
        MeshObject {
            vertices: vec![0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            faces: vec![0, 1, 2],
        }
    }

    #[test]
    fn mesh_project_roundtrip() {
        let root = temp_root("mesh");
        let id = uuid::Uuid::new_v4().to_string();
        let dir = root.join(&id);
        std::fs::create_dir_all(&dir).unwrap();
        let mesh = tri_mesh();
        let now = now_millis();
        write_meta(&dir, &ProjectInfo { id: id.clone(), name: "Test Mesh".into(), created_at: now, updated_at: now, mode: ProjectMode::Mesh }).unwrap();
        atomic_write(&dir.join("model.obj"), b"source").unwrap();
        atomic_write(&dir.join("mesh.json"), &serde_json::to_vec(&mesh).unwrap()).unwrap();
        atomic_write(&dir.join("scale.json"), &serde_json::to_vec(&2.5f64).unwrap()).unwrap();
        atomic_write(&dir.join("chat.json"), b"[]").unwrap();

        let data = load_project_data_from_dir(&dir).unwrap();
        assert_eq!(data.mode, ProjectMode::Mesh);
        assert_eq!(data.source, "");
        assert_eq!(data.mesh.unwrap().vertices, mesh.vertices);
        assert_eq!(data.scale.unwrap(), 2.5);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn cad_project_roundtrip() {
        let root = temp_root("cad");
        let id = uuid::Uuid::new_v4().to_string();
        let dir = root.join(&id);
        std::fs::create_dir_all(&dir).unwrap();
        let now = now_millis();
        write_meta(&dir, &ProjectInfo { id: id.clone(), name: "Test CAD".into(), created_at: now, updated_at: now, mode: ProjectMode::Code }).unwrap();
        atomic_write(&dir.join("model.step"), b"stepdata").unwrap();
        let file_path = dir.join("model.step");
        let script = format!("import cadquery as cq\nresult = cq.importers.importStep(r\"{path}\")\nshow_object(result)\n", path = file_path.display());
        atomic_write(&dir.join("model.py"), script.as_bytes()).unwrap();
        atomic_write(&dir.join("chat.json"), b"[]").unwrap();

        let data = load_project_data_from_dir(&dir).unwrap();
        assert_eq!(data.mode, ProjectMode::Code);
        assert!(data.source.contains("cq.importers.importStep"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn legacy_project_defaults_to_code() {
        let root = temp_root("legacy");
        let id = uuid::Uuid::new_v4().to_string();
        let dir = root.join(&id);
        std::fs::create_dir_all(&dir).unwrap();
        let now = now_millis();
        write_meta(&dir, &ProjectInfo { id: id.clone(), name: "Legacy".into(), created_at: now, updated_at: now, mode: ProjectMode::Code }).unwrap();
        atomic_write(&dir.join("model.py"), DEFAULT_SCRIPT.as_bytes()).unwrap();
        atomic_write(&dir.join("chat.json"), b"[]").unwrap();

        let data = load_project_data_from_dir(&dir).unwrap();
        assert_eq!(data.mode, ProjectMode::Code);
        assert!(!data.source.is_empty());
        let _ = std::fs::remove_dir_all(&root);
    }
}
