# Contributing to nestjs-cls Architectural Refactor Branch

Welcome! This is an **exploratory development branch** testing v7.0 architectural improvements for the nestjs-cls library.

## Branch Context

-   **Upstream Repository:** https://github.com/Papooch/nestjs-cls
-   **This Branch:** https://github.com/tjsasakifln/nestjs-cls
-   **Purpose:** Test architectural refactors for potential upstream contribution
-   **License:** MIT

This fork is **not** a competing implementation. It serves as a testing ground for validating architectural improvements through comprehensive analysis, implementation, and testing before considering contribution back to the upstream library maintained by Ondřej Švanda (Papooch).

---

## Development Philosophy

This fork distinguishes itself through:

1. **Research-First Approach:** Analysis phase before implementation (see `docs/research/`)
2. **Systematic Refactoring:** 4 Rondas (Analysis → Core → Transactional → Validation) per [ROADMAP.md](./ROADMAP.md)
3. **High Test Coverage:** >90% target on all modified files
4. **Multi-Version Support:** NestJS 10 & 11, Node.js >=18
5. **Comprehensive Documentation:** ROADMAP.md tracking, migration guides, research docs

---

## Getting Started

### Prerequisites

-   **Node.js:** >=18
-   **Package Manager:** Yarn 4.12.0 (required)
-   **TypeScript:** 5.9.3
-   **Git:** For version control

### Setup

1. **Fork and Clone**

```bash
git clone https://github.com/[your-username]/nestjs-cls.git
cd nestjs-cls
```

2. **Install Dependencies**

```bash
yarn install
```

3. **Build All Packages**

```bash
yarn build
```

4. **Run Tests**

```bash
yarn test
```

---

## Monorepo Structure

This repository uses **Yarn workspaces**. Understanding the structure is critical:

| Package Name                                | Filepath                                    | Description               |
| ------------------------------------------- | ------------------------------------------- | ------------------------- |
| nestjs-cls                                  | `packages/core`                             | Core CLS library          |
| @nestjs-cls/transactional                   | `packages/transactional`                    | Transactional plugin      |
| @nestjs-cls/transactional-adapter-<adapter> | `packages/transactional-adapters/<adapter>` | ORM adapters (8 adapters) |
| nestjs-cls-docs                             | `docs`                                      | Documentation website     |

### Workspace Commands

Run commands in specific packages:

```bash
# Syntax
yarn workspace <package-name> <command>

# Examples
yarn workspace nestjs-cls test
yarn workspace @nestjs-cls/transactional test:cov
yarn workspace @nestjs-cls/transactional-adapter-typeorm build
```

Run commands across all packages:

```bash
yarn test              # All tests
yarn build             # Build all packages
yarn lint              # Lint all packages with auto-fix
yarn format            # Format all packages with Prettier
```

---

## Workflow Automation

The `.claude/commands/` directory contains workflow automation tools to streamline development:

### Development Commands

-   `/commit` - Semantic commit message generation (monorepo-aware)
-   `/lint-fix` - ESLint + Prettier auto-fixing across workspaces
-   `/smart-fix` - Intelligent debugging for library issues
-   `/catchup` - Restore work context after session restart

### Testing Commands

-   `/test-coverage` - Jest coverage analysis per package
-   `/security-scan` - npm audit and secret scanning

### Project Management Commands

-   `/pick-next-issue` - Intelligent issue selection from ROADMAP.md
-   `/audit-roadmap` - Milestone and roadmap synchronization
-   `/npm-publish-check` - Pre-publish validation checklist

See `.claude/commands/` for full documentation of available automation.

---

## How to Contribute

### 1. Identify Work

**Recommended:** Use the [ROADMAP.md](./ROADMAP.md) for guidance:

-   Check **Ronda 4 (Validation)** for current priorities
-   Review **open sub-issues** (e.g., #27-#40 for test suite implementation)
-   Look for issues marked `help wanted` or `good first issue`

**Create New Work:**

-   Open an issue describing the problem/feature
-   Discuss approach before implementation
-   Ensure alignment with v7.0 refactor goals

### 2. Create a Branch

Use semantic branch naming:

```bash
# Feature branches
git checkout -b feat/issue-N-description

# Bug fix branches
git checkout -b fix/issue-N-description

# Documentation branches
git checkout -b docs/topic-description

# Test branches
git checkout -b test/issue-N-description
```

### 3. Make Changes

**Follow Existing Patterns:**

-   Study similar code in the monorepo
-   Maintain TypeScript strict mode compliance
-   Use NestJS conventions (`ClsModule`, `ClsService`, `@Transactional()`)

**Testing Requirements:**

-   **Unit tests:** Co-located `.spec.ts` files next to source files
-   **Integration tests:** `test/` directory in each package
-   **Coverage target:** >90% on modified files
-   **Multi-version testing:** Ensure compatibility with NestJS 10 & 11

**Run Tests:**

```bash
# Specific package
yarn workspace nestjs-cls test
yarn workspace nestjs-cls test:cov

# All packages
yarn test
```

### 4. Code Style

**Linting:**

```bash
yarn lint              # Auto-fix issues
yarn lint:check        # Check without fixing
```

**Formatting:**

```bash
yarn format            # Auto-format with Prettier
yarn format:check      # Check formatting without fixing
```

**Configuration:**

-   ESLint: `eslint.config.mjs` (modern flat config format)
-   Prettier: `.prettierrc` (4-space indentation, single quotes, trailing commas)

### 5. Commit Changes

Use **semantic commit messages** for automatic version detection:

```bash
# Format
<type>(<scope>): <description>

# Types
feat      - New feature (minor version bump)
fix       - Bug fix (patch version bump)
docs      - Documentation only
style     - Formatting, no code change
refactor  - Code restructuring
test      - Adding tests
chore     - Maintenance tasks

# Scopes
core                - packages/core
transactional       - packages/transactional
adapter-typeorm     - specific adapter
docs                - documentation

# Breaking Changes (major version bump)
feat(core)!: breaking change description
# OR
feat(core): description

BREAKING CHANGE: Detailed explanation
```

**Examples:**

```bash
git commit -m "feat(core): add DependencyGraph utility for cycle detection"
git commit -m "fix(transactional): prevent transaction corruption in nested contexts"
git commit -m "docs(roadmap): update Ronda 4 progress"
git commit -m "test(core): add circular dependency edge case tests"
```

### 6. Push and Create PR

```bash
# Push to your fork
git push origin feat/issue-N-description
```

**Create Pull Request on GitHub:**

-   **Target branch:** `main` (this fork, NOT upstream)
-   **Title:** Use semantic commit format
-   **Description:**
    -   Reference ROADMAP.md issue if applicable
    -   Explain changes and rationale
    -   Include test results (coverage, passing tests)
    -   Note any breaking changes

### 7. PR Requirements

Before submitting, ensure:

-   ✅ All tests passing (`yarn test`)
-   ✅ Linting passing (`yarn lint:check`)
-   ✅ Formatting passing (`yarn format:check`)
-   ✅ Coverage >90% on modified files
-   ✅ ROADMAP.md updated (if working on tracked sub-issue)
-   ✅ CHANGES.md updated (if public API changes)
-   ✅ Documentation updated (if user-facing changes)

### 8. Review Process

-   PRs are reviewed against ROADMAP.md acceptance criteria
-   Address feedback iteratively
-   Update ROADMAP.md to mark sub-issues complete when merged
-   Squash commits if requested before merge

---

## Testing Guidelines

### Multi-Version Testing

All tests must pass on:

-   **NestJS 10.x** (using `@nestjs/common10` aliases in test setup)
-   **NestJS 11.x** (default)

### Test Organization

**Unit Tests:** Co-located with source files

```
packages/core/src/lib/cls-service.ts
packages/core/src/lib/cls-service.spec.ts
```

**Integration Tests:** Separate `test/` directory

```
packages/core/test/integration/middleware.spec.ts
packages/transactional/test/propagation-modes.spec.ts
```

### Coverage Expectations

| Package                           | Target Coverage |
| --------------------------------- | --------------- |
| `packages/core`                   | >90%            |
| `packages/transactional`          | >90%            |
| `packages/transactional-adapters` | >75%            |

**Check Coverage:**

```bash
yarn workspace nestjs-cls test:cov
yarn workspace @nestjs-cls/transactional test:cov
```

---

## Documentation Requirements

When adding or modifying features:

1. **Package README:** Update if public API changes
2. **CHANGES.md:** Add entry following conventional changelog format
3. **ROADMAP.md:** Update progress if working on a tracked sub-issue
4. **Research Docs:** Add to `docs/research/` for architectural decisions
5. **Migration Guides:** Create if introducing breaking changes (especially for v7.0)

---

## Versioning

This fork follows **semantic versioning** (semver):

-   **Major (x.0.0):** Breaking changes to public API
-   **Minor (0.x.0):** New features, backward-compatible enhancements
-   **Patch (0.0.x):** Bug fixes, documentation, internal refactors

**Automated Version Detection:**
Monoweave analyzes conventional commits to determine version bumps automatically during publishing.

---

## Common Pitfalls

❌ **Don't:**

-   Treat this as an API application (it's a library)
-   Add domain-specific business logic
-   Ignore monorepo structure (run commands at wrong level)
-   Break public API without major version bump
-   Assume single NestJS version (must support 10 and 11)
-   Modify public exports without updating documentation
-   Create PR against upstream repository (use this fork's `main` branch)

✅ **Do:**

-   Focus on library API surface (exports in `index.ts`)
-   Follow existing module configuration patterns (`forRoot`, `forRootAsync`, `forFeature`)
-   Test against both NestJS 10 and 11
-   Update ROADMAP.md when completing sub-issues
-   Run full test suite before pushing
-   Reference ROADMAP.md in PRs for context

---

## Getting Help

**Documentation:**

-   **Upstream Docs:** https://papooch.github.io/nestjs-cls/ (primary reference for library usage)
-   **NestJS Docs:** https://docs.nestjs.com/
-   **AsyncLocalStorage:** https://nodejs.org/api/async_context.html

**In This Repository:**

-   **ROADMAP.md:** Current development focus and progress tracking
-   **Research Docs:** `docs/research/` for architectural decisions and analysis
-   **Skills:** `.claude/skills/` for domain knowledge and patterns
-   **Examples:** Check existing tests for usage patterns

**Questions:**

-   Open a GitHub issue with the `question` label
-   Reference ROADMAP.md for context on what's being worked on
-   Check closed PRs for implementation examples

---

## Project Health

**Current Status (as of 2026-01-21):**

-   ✅ **Ronda 1 (Analysis):** 100% complete
-   ✅ **Ronda 2 (Core Implementation):** 100% complete
-   ✅ **Ronda 3 (Transaction Isolation):** 100% complete
-   🚧 **Ronda 4 (Validation):** In progress

**Metrics:**

-   **Velocity:** ~6 issues/week
-   **ETA:** 2-3 weeks (ahead of 2026-03-10 deadline)
-   **Test Count:** 341 tests (291 core + 50 transactional)
-   **Coverage:** 96.12% core, 95.45% transactional

See [ROADMAP.md](./ROADMAP.md) for detailed progress metrics and sub-issue tracking.

---

## License

Contributions to this fork are licensed under the **MIT License**.

By contributing, you agree that your contributions will be licensed under the same MIT License that covers this project.

---

## Acknowledgment

This branch builds on the excellent work of **Ondřej Švanda ([@Papooch](https://github.com/Papooch))**, the original author of nestjs-cls.

**Upstream Repository:** https://github.com/Papooch/nestjs-cls

---

**Thank you for contributing to this exploratory branch!**

Your work helps validate architectural improvements that may benefit the broader nestjs-cls community through upstream contribution.
