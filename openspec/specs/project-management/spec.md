# project-management Specification

## Purpose

Manage projects: create, switch, rename, delete, and load them, including the project mode (code or mesh) that determines how the model is edited and stored.

## Requirements

### Requirement: Project selector popover
The top bar MUST show the active project and open a popover on click. The popover MUST contain a live search input (filtering projects by name as the user types), a create button, and a scrollable list of projects.

#### Scenario: Search filters projects
- **WHEN** the user types in the search box
- **THEN** the project list filters to matching names as they type

#### Scenario: Active project highlighted
- **WHEN** the list is shown
- **THEN** the active project is visually highlighted

### Requirement: Create project
The popover's create button MUST create a new project with a generated name, activate it, and switch to it.

#### Scenario: Creating a project
- **WHEN** the user clicks the create button
- **THEN** a project with a generated name is created and becomes active

### Requirement: Switch project
Clicking a project in the list MUST switch to it, restoring its script in the editor and its conversation in the chat.

#### Scenario: Switching projects
- **WHEN** the user clicks a different project
- **THEN** the editor shows that project's script and the chat shows its conversation, and the agent session operates on that project

### Requirement: Rename and delete via edit modal
Each project in the list MUST have an edit button that opens a modal with a rename field and a delete action (with confirmation).

#### Scenario: Renaming a project
- **WHEN** the user renames a project in the modal
- **THEN** the project's display name updates in the list and in `meta.json`

#### Scenario: Deleting a project
- **WHEN** the user confirms deletion in the modal
- **THEN** the project directory is removed; if it was active, the app switches to another project

### Requirement: First-launch default project
When the app starts and no projects exist, the app MUST create and activate a default project with a generated name.

#### Scenario: Empty project list on start
- **WHEN** the app becomes ready and no projects exist
- **THEN** a default project is created and activated

### Requirement: Project mode
A project SHALL carry a `mode` in its metadata: `"code"` (default, has a `model.py`) or `"mesh"` (no script; mesh stored as `mesh.json`).

#### Scenario: Existing projects default to code mode
- **WHEN** a project without a `mode` field is loaded
- **THEN** it is treated as a code project

#### Scenario: Mesh project loads mesh data
- **WHEN** a mesh project is loaded
- **THEN** the app receives its normalized mesh and scale instead of a script
