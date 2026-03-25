# Contributing

Thank you for considering contributing to Koban!

## Development Setup

See [Getting Started](getting-started.md) for environment setup.

## Workflow

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
3. **Make your changes** — follow existing code patterns
4. **Add tests** for new functionality
5. **Run checks:**
   ```bash
   npm test                       # Unit tests
   cd ext && npx tsc --noEmit     # Type check
   npm run build:ext              # Build
   ```
6. **Commit** with [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add cool feature"
   git commit -m "fix: resolve edge case in task archival"
   ```
7. **Push & open a PR** against `main`

## Commit Convention

| Prefix | Use For |
|--------|---------|
| `feat:` | New features |
| `fix:` | Bug fixes |
| `docs:` | Documentation changes |
| `refactor:` | Code restructuring (no behavior change) |
| `test:` | Adding or updating tests |
| `chore:` | Build, CI, tooling changes |

## Code Guidelines

- **TypeScript strict mode** — no `any` unless unavoidable
- **Service interfaces** — new services must have an interface in `types.ts`
- **Test doubles** — use fakes (not mocks) for service dependencies
- **Security** — escape all dynamic HTML attributes and content
- **Frontmatter** — use `updateFrontmatter()` (never hand-roll frontmatter serialization)

## CI Pipeline

Pull requests must pass:

1. **Typecheck** — `tsc --noEmit`
2. **Build** — `npm run build:ext`
3. **Tests** — `npx vitest run`
4. **Package** — `npx @vscode/vsce package --no-dependencies`

## Reporting Issues

Open an issue on [GitHub](https://github.com/stefanposs/koban/issues) with:

- VS Code version
- Koban version
- Steps to reproduce
- Expected vs actual behavior
