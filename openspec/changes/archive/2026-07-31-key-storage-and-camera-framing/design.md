## Context

Two issues surfaced in use. (1) The macOS keychain prompts for the password on every read of the API key. Verified via `security find-generic-password`: the item is created with `access = NULL` (keyring's legacy `SecKeychainAddGenericPassword` path), which for an unsigned app yields an item with no trusted-application ACL entry — so macOS re-authorizes on every access regardless of build state. (2) The viewer camera is fixed at `[4, 3, 5]` / fov 45, so large models start with the camera inside the geometry. Exploration decisions: replace the keychain with a user-only file (option A); frame the model with a reset button and auto-frame until the user moves the camera; move the grid under the model's base.

## Goals / Non-Goals

**Goals:**
- No keychain prompts: the API key lives in a 0600 file in the app-data directory.
- The viewer frames the full model at an isometric angle on load and via a reset button.
- Auto-framing stops once the user manually moves the camera (session-wide).
- The grid sits under the model's base.

**Non-Goals:**
- No keychain migration from existing items (the user re-saves the key once).
- No user-adjustable camera preset/angle settings.
- No changes to the orbit/zoom controls behavior.

## Decisions

### D1: Key in a user-only file (drop the keychain)
`provider.rs` stores the key at `<app_data_dir>/api_key`. On Unix the file is created with mode `0600`; on Windows no explicit permission code is needed — a file created in the user's app-data directory inherits the profile's default ACL, which scopes it to the user account (+ SYSTEM/Administrators, the practical Windows equivalent of 0600). Writes are atomic (temp + rename). Rationale: deterministic, no prompts in dev or release, and it is the standard practice for BYOK keys (gh CLI, VS Code). The `keyring` dependency (and its per-platform native features) is removed, along with the keychain test. Note: no at-rest encryption on Windows (DPAPI deferred — a plain file relies on the profile ACL for now).

### D2: Provider functions take the app handle
`get_api_key`/`store_api_key`/`has_api_key` now take the `AppHandle` (needed to resolve the data dir); all callers (commands, agent) pass it.

### D3: Framing math
From the returned mesh, compute the bounding box over all objects: `center`, `radius` (bounding sphere of the box), and `minY`. The camera is placed at `center + normalize(1, 0.8, 1.2) × distance`, with `distance = radius / sin(fov/2) × 1.2`, floored at `max(radius × 1.5, 0.5)`, looking at `center`. The OrbitControls target is set to `center`.

### D4: Reset button
An overlay button at the bottom-right of the viewer (over the canvas) re-frames the current model.

### D5: Auto-frame until the user moves
A `userMoved` flag is set on the OrbitControls `start` event (first manual interaction). While `!userMoved`, each newly loaded model triggers a re-frame. Once the user moves the camera, auto-framing is disabled for the rest of the session; the manual button always works.

### D6: Grid follows the model
The grid's y is set to `minY - gap` (small offset below the model's base) when a model is present; the current fixed position is used when there is no model.

## Risks / Trade-offs

- [File storage lacks keychain at-rest encryption] → The key is the user's own BYOK token; 0600 perms match common CLI-tool practice. Windows relies on the profile ACL (DPAPI at-rest encryption deferred).
- [Auto-frame stops after the first user move] → Intended per exploration; the reset button remains available.
- [Framing ignores the canvas aspect ratio] → A margin factor approximates framing; acceptable for now, can be refined with aspect-aware fov later.
