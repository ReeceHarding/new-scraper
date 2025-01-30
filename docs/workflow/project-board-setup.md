# Project Board Setup

This document outlines the configuration for our GitHub project boards.

## Main Development Board

### Board Configuration
- Name: Development
- Template: Automated kanban
- Visibility: Private (team only)

### Columns

#### 1. To Do
- **Purpose**: Upcoming work items
- **Configuration**:
  - Preset: To do
  - Automation:
    - Newly added issues
    - Newly added pull requests
    - Reopened issues
    - Reopened pull requests

#### 2. In Progress
- **Purpose**: Work actively being done
- **Configuration**:
  - Preset: In progress
  - Automation:
    - Pull requests out of draft
    - Reopened pull requests
    - Issues assigned to someone
    - Pull requests assigned to someone

#### 3. Review
- **Purpose**: Items needing review/approval
- **Configuration**:
  - Preset: Review in progress
  - Automation:
    - Pull requests pending review
    - Pull requests pending merge
    - Issues pending feedback

#### 4. Done
- **Purpose**: Completed work
- **Configuration**:
  - Preset: Done
  - Automation:
    - Closed issues
    - Merged pull requests
    - Closed pull requests

### Labels

#### Priority Labels
- `priority: critical` - #FF0000
- `priority: high` - #FF6B6B
- `priority: medium` - #FFD93D
- `priority: low` - #6BCB77

#### Type Labels
- `type: feature` - #0066FF
- `type: bug` - #FF4444
- `type: enhancement` - #4CAF50
- `type: documentation` - #2196F3
- `type: refactor` - #9C27B0
- `type: test` - #795548
- `type: chore` - #607D8B

#### Status Labels
- `status: blocked` - #FF0000
- `status: needs review` - #FFB300
- `status: in progress` - #2196F3
- `status: ready` - #4CAF50

#### Scope Labels
- `scope: frontend` - #3F51B5
- `scope: backend` - #673AB7
- `scope: database` - #009688
- `scope: infrastructure` - #FF5722
- `scope: security` - #F44336

### Repository Settings

#### Branch Protection Rules
- Require pull request reviews before merging
- Dismiss stale pull request approvals when new commits are pushed
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Include administrators in restrictions

#### Merge Button Settings
- Allow merge commits
- Allow squash merging
- Automatically delete head branches

#### Notification Settings
- Notify on pull request reviews
- Notify on pull request merges
- Notify on issue assignments
- Notify on mentions

## Setup Instructions

1. Go to the repository's Projects tab
2. Click "New project"
3. Select "Automated kanban" template
4. Name the project "Development"
5. Configure columns as specified above
6. Add automation rules
7. Configure labels
8. Set up branch protection rules
9. Configure merge button settings
10. Set up notification preferences

## Maintenance

- Archive completed items monthly
- Review and update automation rules quarterly
- Clean up stale issues and pull requests
- Update labels as needed
- Review and adjust notification settings 