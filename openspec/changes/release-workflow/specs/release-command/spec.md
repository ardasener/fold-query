## ADDED Requirements

### Requirement: GitHub origin remote
The repo SHALL track GitHub as the `origin` remote for release pushes, with GitLab retained as the source remote.

#### Scenario: Origin points to GitHub
- **WHEN** the release script pushes
- **THEN** it pushes to the GitHub remote at `git@github.com:ardasener/fold-query.git`

#### Scenario: GitLab remains the source
- **WHEN** the repository is cloned or fetched
- **THEN** the GitLab remote is still present and used for the working branch
