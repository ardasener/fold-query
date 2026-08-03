## Why

Two usability issues: on macOS the API key stored in the system keychain prompts for the keychain password on every read (the item is created without an access-control entry by an unsigned app, so macOS re-authorizes each access — even in the same session, unchanged build). And the 3D viewer camera is fixed, so large models start with the camera inside the geometry while small models appear far away.

## What Changes

- The API key is stored in a user-only (0600) file at `<app_data_dir>/api_key` instead of the OS keychain; provider save/status/chat all read it from the file. The `keyring` dependency is removed.
- The 3D viewer frames the model: the camera is positioned at an isometric angle framing the model's bounding box, with a reset button overlaid at the bottom-right of the view.
- The camera auto-frames each newly loaded model until the user manually moves the camera (orbits/zooms); after that the app leaves the camera alone for the session.
- The grid floor moves to sit under the model's base.

## Capabilities

### New Capabilities
- `key-storage`: The API key persists in a user-only file in the app-data directory (no keychain, no per-read prompts).
- `camera-framing`: The viewer frames the loaded model (reset button, auto-frame until the user moves the camera), and the grid follows the model's base.

### Modified Capabilities
<!-- None — no existing spec behavior changes. -->

## Impact

- Rust: `provider.rs` rewritten to use a file (functions take the app handle); `keyring` removed from `Cargo.toml`; callers updated; keychain test replaced.
- Frontend: `ViewerPanel.tsx` gains framing logic, a reset button, and user-move tracking; grid positioning follows the model.
