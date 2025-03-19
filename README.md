# workflow-runner-analyzer
A github action which analyzing runner configurations

## Purpose

This action helps organizations enforce that GitHub workflows only run on approved self-hosted runners, rather than GitHub-hosted runners. Since GitHub Enterprise Cloud doesn't provide a direct option to disallow GitHub-hosted runners, this action serves as a workaround:

1. Set up this action as a required workflow for all repositories in your GitHub organization
2. The action analyzes workflow files to ensure all runners are in an allowed list
3. Workflows using unapproved runners will fail, allowing you to enforce your organization's runner policy

## Usage

Add this action as a required workflow in your GitHub organization:

```yaml
name: Validate Workflow Runners

on:
  workflow_dispatch:
  pull_request:
    paths:
      - '.github/workflows/**'
  push:
    paths:
      - '.github/workflows/**'

jobs:
  validate-runners:
    name: Validate Workflow Runners
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3
        
      - name: Validate runners
        uses: c4po/workflow-runner-analyzer@v1
        with:
          allowed-runners: 'self-hosted my-org-runner-1 my-org-runner-2'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `allowed-runners` | Space-separated list of allowed runner names | Yes | None |

## Outputs

| Output | Description |
|--------|-------------|

## Example: Setting Up as a Required Workflow

To enforce this check across your organization:

1. Create a repository for your organization's required workflows
2. Add this action as a workflow file (e.g., `runner-validation.yml`)
3. In your organization settings, go to "Settings > Code and automation > Actions > Required workflows"
4. Add the workflow as required for all repositories

This ensures that all repositories in your organization will run this check, preventing workflows from using unapproved runners.

## License

MIT License
