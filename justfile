# Koban — Development Commands

# Default: show available recipes
default:
    @just --list

# ─── Development ────────────────────────────────────────────────

# Watch extension host changes (auto-rebuild on save)
dev:
    node esbuild.ext.mjs --watch

# Build, package, install, and reload — one command to test live
dev-install: build-prod
    npx @vscode/vsce package --no-dependencies
    code --install-extension koban-*.vsix --force
    @echo "✅ Installed! Press CMD+Shift+P → 'Developer: Reload Window' to activate"

# ─── Build ──────────────────────────────────────────────────────

# Build extension host (→ dist/extension.cjs)
build-ext:
    node esbuild.ext.mjs

# Build everything
build: build-ext

# Build for production (minified)
build-prod:
    node esbuild.ext.mjs --production

# ─── Quality ────────────────────────────────────────────────────

# Type-check the extension host
typecheck:
    cd ext && npx tsc --noEmit

# Run unit tests
test:
    npx vitest run

# Run all QA checks (typecheck + test)
qa: typecheck test

# ─── VS Code Extension ─────────────────────────────────────────

# Package as VS Code extension (VSIX)
package-extension: build-prod
    npx @vscode/vsce package --no-dependencies

# Install extension locally
install-extension:
    code --install-extension koban-*.vsix

# ─── Utilities ──────────────────────────────────────────────────

# Clean build artifacts
clean:
    rm -rf dist node_modules/.vite *.vsix

# Install dependencies
install:
    npm install

# Full reset
reset: clean install
