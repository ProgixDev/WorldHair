# Expo App Template

This repository is an Expo app template that provides a starting point for building React Native applications with Expo, including setup scripts for NativeWind, Git hooks, and project management.

## Scripts

- **clean-keep.ts**: Removes all .keep placeholder files from the project directories (self-deleting script).
- **generate-adaptive-icon.ts**: Generates `assets/images/adaptive-icon.png` from `Logo.png` by centering the logo on a 1024×1024 transparent canvas. Android adaptive icons require the logo to stay within the inner 66% "safe zone" to avoid clipping.
- **rename-project.ts**: Updates package.json, app.json, and other files to use the current folder name as the project name.
- **reset-git.ts**: Resets the Git repository by removing .git, reinitializing, and creating a fresh initial commit (self-deleting script).
- **setup-git-hooks.ts**: Sets up Husky for pre-commit linting and Commitlint for commit message validation.
- **setup-nativewind.ts**: Automates the setup of NativeWind, a utility-first CSS library for React Native, by installing dependencies and configuring the project.
- **update-dependencies.ts**: Updates all project dependencies and ensures Expo package compatibility.
