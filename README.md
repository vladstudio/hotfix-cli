# Hotfix CLI

Automated hotfix workflow tool that handles the entire process from commit to merge.

## Features

- ✅ Generates timestamped branch names
- ✅ Creates branch, commits changes, pushes to GitHub
- ✅ Creates and auto-merges pull request
- ✅ Cleans up local and remote branches
- ✅ Full rollback on failure
- ✅ Cross-shell compatibility (works in bash, zsh, fish)

## Prerequisites

- Node.js >= 16
- Git repository with protected main branch
- GitHub CLI (`gh`) installed and authenticated
- Push permissions to repository

## Installation

### Global Installation
```bash
npm install -g .
# or
bun install -g .
```

### Local Installation
```bash
npm install
npm run build
# Use ./bin/hotfix directly
```

## Usage

1. Make your changes (edit files, fix typos, etc.)
2. Stage your changes: `git add .` (optional - the tool will stage all changes)
3. Run: `hotfix`

The tool will:
1. Create a timestamped branch (e.g., `hotfix-2025-07-30-14-30-45`)
2. Commit all changes with auto-generated message
3. Push branch to GitHub
4. Create pull request
5. Auto-merge the PR
6. Switch back to main and pull latest changes
7. Delete the temporary branch

## Workflow

```
Current state (main) → Create branch → Commit → Push → Create PR → Merge → Cleanup
```

## Error Handling

- Validates environment before starting
- Rolls back changes on any failure
- Returns to original branch state
- Provides clear error messages

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Run in development mode
bun run dev
```