# editor-scrolling Specification

## Requirements

### Requirement: Editor scrolls within the pane
The code editor MUST scroll its content vertically when the script exceeds the pane height, instead of clipping.

#### Scenario: Long script scrolls
- **WHEN** the script content is taller than the editor pane
- **THEN** the editor scrolls vertically to reveal the full content

#### Scenario: Line numbers visible
- **WHEN** scrolling through the script
- **THEN** the gutter with line numbers scrolls together with the content
