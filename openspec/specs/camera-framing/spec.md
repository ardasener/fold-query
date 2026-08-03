# camera-framing Specification

## Requirements

### Requirement: Camera frames the model
When a model is loaded, the camera MUST frame the model's bounding box from an isometric angle, and a reset button at the bottom-right of the viewer MUST re-frame the model on demand.

#### Scenario: Model framed on load
- **WHEN** a model is loaded (or the reset button is clicked)
- **THEN** the camera is positioned at an isometric angle framing the full model, looking at its center

#### Scenario: Reset button visible
- **WHEN** the viewer is shown
- **THEN** a reset button appears at the bottom-right that re-frames the model

### Requirement: Auto-frame stops after user interaction
The camera MUST auto-frame newly loaded models only until the user manually moves the camera; after the first manual interaction, auto-framing MUST stop for the session.

#### Scenario: Auto-frame before interaction
- **WHEN** a new model loads and the user has not moved the camera
- **THEN** the camera frames the new model automatically

#### Scenario: No auto-frame after interaction
- **WHEN** a new model loads after the user has moved the camera
- **THEN** the camera keeps its current position; the reset button still works

### Requirement: Grid follows the model base
The grid floor MUST sit below the model's base (the model's bounding-box minimum y) when a model is present.

#### Scenario: Grid under the model
- **WHEN** a model is displayed
- **THEN** the grid is positioned just below the model's lowest point
