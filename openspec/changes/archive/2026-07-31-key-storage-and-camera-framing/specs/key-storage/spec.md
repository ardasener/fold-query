## ADDED Requirements

### Requirement: API key stored in a user-only file
The API key MUST be stored in a file in the app-data directory with user-only permissions, not in the OS keychain. Reading the key MUST NOT trigger any OS prompt.

#### Scenario: Key saved
- **WHEN** the user saves the provider
- **THEN** the key is written to `<app_data_dir>/api_key` with user-only permissions

#### Scenario: Key read without prompts
- **WHEN** the chat or provider status reads the key
- **THEN** no OS authentication prompt appears

#### Scenario: Key file missing
- **WHEN** the key file does not exist
- **THEN** reads report that no key is configured
