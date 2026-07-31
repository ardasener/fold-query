## ADDED Requirements

### Requirement: Provider registration popup
The settings modal MUST include an AI Provider section with a button that opens a popup for entering a base URL, a model name, and an API key (password field). The popup MUST allow testing the connection before saving.

#### Scenario: Opening provider setup
- **WHEN** the user clicks the provider setup button
- **THEN** a popup opens with base URL, model, and API key fields, prefilled with the saved values when a provider is configured

#### Scenario: Testing the connection
- **WHEN** the user clicks Test Connection with the entered values
- **THEN** the app attempts a minimal API request and reports success or failure

### Requirement: Keychain storage
Saving the provider MUST store the API key in the OS keychain and never display it back in the UI. The URL and model MUST be persisted with the other settings.

#### Scenario: Saving the provider
- **WHEN** the user clicks Save
- **THEN** the API key is stored in the OS keychain, the URL and model persist in settings, and the key field clears

#### Scenario: Status shows no key
- **WHEN** the app reports provider status
- **THEN** it includes configured/url/model but never the key
