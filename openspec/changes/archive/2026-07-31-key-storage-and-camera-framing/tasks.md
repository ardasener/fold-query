## 1. Key storage

- [x] 1.1 `provider.rs`: replace keyring with a file at `<app_data_dir>/api_key`; `get_api_key`/`store_api_key`/`has_api_key` take the `AppHandle`; Unix 0600 perms (Windows relies on the profile's default ACL); atomic write; missing file → "no key" error
- [x] 1.2 Remove `keyring` from `Cargo.toml` (all platform variants) and its test; update callers (`lib.rs` commands, `agent.rs`)
- [x] 1.3 `cargo check` and existing tests pass

## 2. Camera framing

- [x] 2.1 `ViewerPanel.tsx`: compute the model bounding box (center/radius/minY) from the object vertices
- [x] 2.2 Add a camera rig that frames the model (isometric diagonal, distance from radius/fov, target = center); reframe on model load and on a reset signal
- [x] 2.3 Track `userMoved` via OrbitControls `start`; while unset, reframe on each new model; once set, stop auto-framing for the session
- [x] 2.4 Reset button overlay at the bottom-right of the viewer; clicking re-frames
- [x] 2.5 Move the grid to `minY - gap` when a model is present; keep the default otherwise

## 3. Verification

- [x] 3.1 `cargo check` and `bun run build` pass
- [x] 3.2 Save the provider; the key appears in `<app_data_dir>/api_key` (0600); no keychain prompts on chat or settings
- [x] 3.3 Loading a model frames it fully at an angle; the reset button re-frames after manual movement
- [x] 3.4 Auto-frame stops after the first manual camera interaction
- [x] 3.5 The grid sits under the model's base
