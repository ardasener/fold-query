use async_openai::config::OpenAIConfig;
use async_openai::types::chat::{
    ChatCompletionRequestMessage, ChatCompletionRequestUserMessage,
    ChatCompletionRequestUserMessageContent, CreateChatCompletionRequestArgs,
};
use async_openai::Client as OpenAIClient;
use keyring::Entry;

const KEYRING_SERVICE: &str = "com.foldquery.app";
const KEYRING_USER: &str = "api_key";

pub fn store_api_key(key: &str) -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())?;
    entry
        .set_password(key)
        .map_err(|e| format!("Failed to store the API key in the keychain: {e}"))
}

pub fn get_api_key() -> Result<String, String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())?;
    entry
        .get_password()
        .map_err(|e| format!("Failed to read the API key from the keychain: {e}"))
}

pub fn has_api_key() -> bool {
    get_api_key().is_ok()
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
    use keyring::Entry;

    #[test]
    fn keychain_persists_across_entries() {
        // Simulates save (entry A) then read-back (entry B) as separate objects.
        // Guards against the keyring mock-store fallback (no native features),
        // which keeps no state between Entry instances.
        let service = "com.foldquery.app.test";
        let account = "probe";
        let _ = Entry::new(service, account).unwrap().delete_credential();
        let write = Entry::new(service, account).unwrap();
        write.set_password("secret-123").unwrap();
        let read = Entry::new(service, account).unwrap();
        let got = read.get_password();
        assert_eq!(got.unwrap(), "secret-123");
        let _ = Entry::new(service, account).unwrap().delete_credential();
    }
}
