# Version Management

This project uses centralized version management with the root `package.json` as the single source of truth.

## Current Version System

- **Source of Truth**: `/package.json` version field
- **Web App**: Synced to `/web/package.json` and `/web/src/utils/version.ts`
- **Firmware**: Synced to `#define FIRMWARE_VERSION` in `/firmware/src/main.cpp`

## How to Create a Release (Recommended)

### 🚀 Automated Release Process
```bash
veetr release 0.0.1   # Creates branch, commits, tags, and pushes
```

**What this does automatically:**
1. ✅ Validates the version format (semver)
2. ✅ Checks git working directory is clean
3. ✅ Updates all version references
4. ✅ Creates branch `bump-0.0.1`
5. ✅ Commits with message `"Bump to version 0.0.1"`
6. ✅ Creates and pushes git tag `0.0.1`
7. ✅ Pushes the branch

**GitHub Actions will then:**
1. 🔍 Validate version consistency across all files
2. 🏗️ Build web app and firmware to ensure no errors
3. 📝 Create a Pull Request automatically
4. 🎉 Create GitHub release with binaries (after PR merge)


## Complete Release Workflow

### Using Automated Release (Recommended)
```bash
# 1. Create release (does everything automatically)
veetr release 1.2.3

# 2. Review and merge the auto-created Pull Request
# 3. GitHub Actions handles the rest!
```

## GitHub Actions Automation

### On Tag Creation:
- **Validates**: All files have consistent versions
- **Builds**: Web app and firmware 
- **Creates**: Pull Request with validation results
- **Reports**: Success/failure with detailed information

### On PR Merge:
- **Builds**: Final release artifacts
- **Creates**: GitHub release with firmware binaries
- **Deploys**: Web app to GitHub Pages


## Troubleshooting

### Release Command Fails
- Ensure git working directory is clean: `git status`
- Check you're on the main branch: `git branch`
- Verify version format: use semver like `1.2.3`

### Version Inconsistency
- The veetr CLI now includes built-in version synchronization
- Check the validation output in GitHub Actions

### GitHub Actions Fails
- Check the workflow logs for specific errors
- Ensure all files build successfully locally
