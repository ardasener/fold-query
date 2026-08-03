use std::path::{Path, PathBuf};

use async_openai::config::OpenAIConfig;
use async_openai::types::chat::{
    ChatCompletionRequestMessage, ChatCompletionRequestUserMessage,
    ChatCompletionRequestUserMessageContent, CreateChatCompletionRequestArgs,
};
use async_openai::Client as OpenAIClient;
use tauri::{AppHandle, Manager};

const KEY_FILE: &str = "api_key";

fn key_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve the app data directory: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create data dir: {e}"))?;
    Ok(dir.join(KEY_FILE))
}

fn write_key_file(path: &Path, key: &str) -> Result<(), String> {
    let tmp = PathBuf::from(format!("{}.tmp", path.display()));
    std::fs::write(&tmp, key.as_bytes())
        .map_err(|e| format!("Could not write the API key: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("Could not set key file permissions: {e}"))?;
    }
    std::fs::rename(&tmp, path).map_err(|e| format!("Could not finalize the API key file: {e}"))?;
    Ok(())
}

pub fn store_api_key(app: &AppHandle, key: &str) -> Result<(), String> {
    let path = key_path(app)?;
    write_key_file(&path, key)
}

pub fn get_api_key(app: &AppHandle) -> Result<String, String> {
    let path = key_path(app)?;
    std::fs::read_to_string(&path)
        .map_err(|_| "No API key is configured. Add one in Settings → AI Provider.".to_string())
}

pub fn has_api_key(app: &AppHandle) -> bool {
    get_api_key(app).is_ok()
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInput {
    pub url: String,
    pub model: String,
    pub key: String,
}

/// Normalize a provider base URL. Providers often document the full endpoint
/// (`…/v1/chat/completions`); async-openai appends `/chat/completions` itself,
/// so strip a trailing suffix and slashes to accept both forms.
pub fn normalize_api_base(raw: &str) -> String {
    let trimmed = raw.trim().trim_end_matches('/');
    match trimmed.strip_suffix("/chat/completions") {
        Some(base) => base.trim_end_matches('/').to_string(),
        None => trimmed.to_string(),
    }
}

/// Minimal chat completion against the given provider values.
pub async fn test_provider(input: ProviderInput) -> Result<(), String> {
    let config = OpenAIConfig::new()
        .with_api_base(normalize_api_base(&input.url))
        .with_api_key(input.key.trim());
    let client = OpenAIClient::with_config(config);

    let request = CreateChatCompletionRequestArgs::default()
        .model(input.model.trim())
        .messages(vec![ChatCompletionRequestMessage::User(
            ChatCompletionRequestUserMessage {
                content: ChatCompletionRequestUserMessageContent::Text("ping".into()),
                name: None,
            },
        )])
        .max_completion_tokens(1u32)
        .build()
        .map_err(|e| e.to_string())?;

    client
        .chat()
        .create(request)
        .await
        .map_err(|e| format!("Connection test failed: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_file_roundtrip() {
        let dir = std::env::temp_dir().join(format!("foldquery-key-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("api_key");

        write_key_file(&path, "secret-123").unwrap();
        let read = std::fs::read_to_string(&path).unwrap();
        assert_eq!(read, "secret-123");

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }

        let _ = std::fs::remove_dir_all(&dir);
    }
}
