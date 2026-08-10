## ADDED Requirements

### Requirement: First-launch provisioning
On first launch, when no working environment exists, the app SHALL provision the CadQuery environment into the app cache directory using the bundled micromamba, with the micromamba root prefix scoped to the cache directory.

#### Scenario: Fresh install provisions environment
- **WHEN** the app starts and no working Python environment exists
- **THEN** the bundled micromamba creates the locked environment under the cache directory and the app proceeds once it is ready

#### Scenario: Provisioning is one-time
- **WHEN** the environment already exists and works
- **THEN** the app uses it directly without re-provisioning

#### Scenario: Progress is reported
- **WHEN** provisioning is running
- **THEN** the app emits progress events for the preparation, download, and verification stages

#### Scenario: Failed provisioning is retryable
- **WHEN** provisioning fails (e.g. network unavailable)
- **THEN** the app falls back to an existing environment or system Python and surfaces a retryable error
