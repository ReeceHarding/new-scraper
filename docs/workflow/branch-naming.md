# Branch Naming Convention

This document outlines the branch naming standards for our project. Following these conventions helps maintain a clean and organized repository.

## Branch Types

### 1. Feature Branches
- **Prefix**: `feature/`
- **Format**: `feature/<issue-number>-<brief-description>`
- **Example**: `feature/123-add-email-templates`
- **Usage**: New features and enhancements

### 2. Bug Fix Branches
- **Prefix**: `fix/`
- **Format**: `fix/<issue-number>-<brief-description>`
- **Example**: `fix/124-email-sending-error`
- **Usage**: Bug fixes and patches

### 3. Hotfix Branches
- **Prefix**: `hotfix/`
- **Format**: `hotfix/<issue-number>-<brief-description>`
- **Example**: `hotfix/125-critical-security-patch`
- **Usage**: Urgent fixes for production issues

### 4. Documentation Branches
- **Prefix**: `docs/`
- **Format**: `docs/<issue-number>-<brief-description>`
- **Example**: `docs/126-update-api-docs`
- **Usage**: Documentation updates only

### 5. Refactor Branches
- **Prefix**: `refactor/`
- **Format**: `refactor/<issue-number>-<brief-description>`
- **Example**: `refactor/127-optimize-email-service`
- **Usage**: Code refactoring without feature changes

### 6. Test Branches
- **Prefix**: `test/`
- **Format**: `test/<issue-number>-<brief-description>`
- **Example**: `test/128-add-email-tests`
- **Usage**: Test additions or improvements

### 7. Chore Branches
- **Prefix**: `chore/`
- **Format**: `chore/<issue-number>-<brief-description>`
- **Example**: `chore/129-update-dependencies`
- **Usage**: Maintenance tasks and dependency updates

## Branch Name Guidelines

1. Use lowercase letters and hyphens only
2. Keep descriptions brief but descriptive
3. Include issue number when applicable
4. Avoid special characters
5. Maximum length: 80 characters

## Examples

✅ Good Examples:
- `feature/130-implement-oauth`
- `fix/131-broken-login`
- `docs/132-api-authentication`
- `refactor/133-clean-utils`

❌ Bad Examples:
- `new-feature` (no prefix)
- `feature/do_something` (uses underscore)
- `Feature/134-Something` (uses capitals)
- `fix/very-long-and-unnecessarily-detailed-description-that-goes-on-forever` (too long)

## Branch Lifecycle

1. Create branch from `main`
2. Make changes and commit
3. Push branch to remote
4. Create pull request
5. Review and merge
6. Delete branch after merge

## Special Branches

- `main` - Production-ready code
- `develop` - Integration branch (if needed)
- `release/*` - Release preparation
- `staging` - Pre-production testing 