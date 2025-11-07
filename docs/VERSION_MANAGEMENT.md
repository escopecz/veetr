# Version Management

This project uses centralized version management with the root `package.json` as the single source of truth.

## Current Version System

- **Source of Truth**: `/package.json` version field
- **Web App**: Synced to `/web/package.json` and `/web/src/utils/version.ts`
- **Firmware**: Synced to `#define FIRMWARE_VERSION` in `/firmware/src/main.cpp`

## How to Create a Release (Recommended)

### 🚀 Automated Release Process
```bash
./veetr release 0.0.1   # Creates branch, commits, tags, and pushes
```

**What this does automatically:**
1. ✅ Validates the version format (semver)
2. ✅ Checks git working directory is clean
3. ✅ Updates all version references
4. ✅ Commits directly to main with message `"Bump to version 0.0.1"`
5. ✅ Creates and pushes git tag `0.0.1`
6. ✅ Pushes changes to main branch

**GitHub Actions will then:**
1. 🔍 Validate version consistency across all files
2. 🏗️ Build web app and firmware to ensure no errors
3. 🎉 Create GitHub release with binaries automatically


## Complete Release Workflow

### Using Automated Release (Recommended)
```bash
# 1. Create release (does everything automatically)
./veetr release 1.2.3

# 2. GitHub Actions automatically validates, builds, and creates release
# 3. Done! Check the releases page for your new release
```

## GitHub Actions Automation

### On Tag Creation:
- **Validates**: All files have consistent versions
- **Builds**: Web app and firmware 
- **Creates**: GitHub release with firmware binaries
- **Reports**: Success/failure with detailed information


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
