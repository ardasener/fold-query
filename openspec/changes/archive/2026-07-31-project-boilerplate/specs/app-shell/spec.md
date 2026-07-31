## ADDED Requirements

### Requirement: App launches into a desktop window
The application MUST launch as a native desktop window via Tauri, loading the React frontend.

#### Scenario: App starts
- **WHEN** the app is started with `bun tauri dev`
- **THEN** a native window opens and the React app renders inside it

### Requirement: Ant Design app frame
The application MUST render an Ant Design `Layout` frame consisting of a header, a sider, and a content area.

#### Scenario: Frame is visible on launch
- **WHEN** the app starts
- **THEN** a header (showing the app name), a sider (placeholder navigation), and a content area are visible

### Requirement: Themed UI
The application MUST configure its Ant Design theme through `ConfigProvider`, including a set of design tokens.

#### Scenario: Theme tokens applied
- **WHEN** the app renders
- **THEN** Ant Design components use the configured theme tokens

### Requirement: Placeholder welcome screen
The content area MUST show a placeholder welcome screen explaining the app's purpose (converting 3D models into papercraft templates).

#### Scenario: Welcome screen shown
- **WHEN** the app starts
- **THEN** the content area displays a welcome message describing the app's purpose and no other functionality is present

### Requirement: Framework invocation works in Tauri
The React app MUST integrate with Tauri's APIs (invoke/event system) without errors, demonstrating the Tauri ↔ frontend bridge is wired correctly.

#### Scenario: Tauri API bridge callable
- **WHEN** the frontend invokes a basic Tauri command
- **THEN** the command succeeds and no error is surfaced in the UI
