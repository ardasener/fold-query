# print-output Specification

## Purpose

Produce exact 1:1 physical-scale print output via the OS native print dialog, from a detached mm-sized print document, with a simplification notice when the mesh was decimated.

## Requirements

### Requirement: Print button
The Print Preview SHALL display a Print button in the settings bar that opens the OS native print dialog.

#### Scenario: Print opens native dialog
- **WHEN** the user clicks the Print button with a net available
- **THEN** the operating system's print dialog opens for the print document

#### Scenario: No net available
- **WHEN** the user clicks the Print button but no net has been produced
- **THEN** the button is disabled

### Requirement: Exact 1:1 print output
The print document SHALL render each page as a vector SVG at explicit mm dimensions with island coordinates in mm, so the printed template is true physical scale.

#### Scenario: Page sized to paper
- **WHEN** the print document is built
- **THEN** each page element is sized to the usable sheet area in mm and the `@page` rule is set to the selected paper size

#### Scenario: Coordinates are physical mm
- **WHEN** an island is drawn in the print document
- **THEN** its coordinates are the true mm coordinates (1 unit = 1mm), with no scaling factor

#### Scenario: One print page per sheet
- **WHEN** the layout has multiple pages
- **THEN** the print document contains one page element per sheet, each starting on a new printed page

### Requirement: Print document isolation
The print document SHALL be detached from the app UI so only the net prints, and SHALL be cleaned up after printing.

#### Scenario: App chrome not printed
- **WHEN** the print dialog opens
- **THEN** only the net pages are printable; the editor, viewer, chat, and settings bar are not part of the print document

#### Scenario: Print root removed after print
- **WHEN** the print dialog closes
- **THEN** the temporary print document is removed from the DOM

### Requirement: Simplification notice
The Print Preview SHALL display a dismissible notice when the unfolded net was produced from a simplified mesh.

#### Scenario: Notice shown after simplification
- **WHEN** the unfold response reports simplification (original face count greater than final)
- **THEN** the print pane shows a dismissible notice stating the original and final triangle counts

#### Scenario: No notice without simplification
- **WHEN** the unfold response reports no simplification
- **THEN** no simplification notice is shown

### Requirement: Viewer keeps full-resolution mesh
The 3D view SHALL continue to display the full-resolution mesh even when the net was built from a simplified mesh.

#### Scenario: 3D view unaffected by simplification
- **WHEN** the net is produced from a simplified mesh
- **THEN** the 3D viewer still shows the original, higher-detail mesh
