# Installation

## From VSIX (Recommended)

Download the latest `.vsix` from [GitHub Releases](https://github.com/stefanposs/koban/releases) and install:

```bash
code --install-extension koban-0.1.0.vsix
```

## From VS Code Marketplace

!!! note "Coming Soon"
    Koban will be published to the VS Code Marketplace. Until then, install from VSIX.

```
ext install stefanposs.koban
```

## Build from Source

```bash
git clone https://github.com/stefanposs/koban.git
cd koban
npm install
npm run package
code --install-extension koban-*.vsix
```

## Requirements

- **VS Code** >= 1.74.0
- **Node.js** >= 18 (for building from source)

## First Steps

1. Click the **Koban** icon in the Activity Bar (left sidebar)
2. Click **"🚀 Initialize Koban Workspace"**
3. A "Getting Started" space with a sample task is created
4. Press ++cmd+shift+k++ (macOS) or ++ctrl+shift+k++ (Windows/Linux) to open the Kanban board

!!! tip
    Koban auto-opens the board when you click the sidebar icon — if a space exists, the board loads immediately.
