# Claude AI Assistant Guidelines for nestjs-cls

This document establishes rules and context for Claude AI when working with the nestjs-cls library monorepo.

## Project Overview

nestjs-cls is a Continuation-Local Storage (CLS) library for NestJS, enabling async context propagation throughout the application lifecycle. The library is built on Node.js AsyncLocalStorage and provides:

- **Core CLS functionality** (`packages/core`) - Main library for context storage
- **Transactional plugin** (`packages/transactional`) - Transaction management plugin
- **Database adapters** (`packages/transactional-adapters/*`) - Adapters for various ORMs (TypeORM, Prisma, Knex, Kysely, etc.)

**Repository type:** Fork (personal fork, not contributing to upstream)
**Upstream:** https://github.com/Papooch/nestjs-cls
**License:** MIT
**Package manager:** Yarn 4.12.0
**Node version:** >=18

## Critical Rules

### 1. NO AI ATTRIBUTION (ABSOLUTE RULE)

**NEVER, under ANY circumstances, add AI/Claude attribution to commits, PRs, or any project artifacts.**

This is a personal fork maintained by a human developer. All work must reflect human authorship only.

✅ **Acceptable:**
- Suggest commit messages for the user to execute manually
- Prepare staged changes and explain what should be committed
- Provide guidance on semantic commit format
- Create PR descriptions without AI attribution

❌ **FORBIDDEN:**
- Adding `Co-Authored-By: Claude` or any AI attribution to commit messages
- Adding AI/Claude mentions in PR descriptions (e.g., "🤖 Generated with Claude Code")
- Adding AI attribution footers to PRs (e.g., "🤖 Implemented as part of...")
- Any form of automated commit/PR creation that includes AI attribution
- Mentioning Claude, AI assistance, or automated tooling in any public-facing text

**Rationale:** This fork represents individual work, not AI-generated contributions. Attribution must remain accurate to maintain integrity of the development history and project identity.

### 2. Monorepo Awareness

This project uses Yarn workspaces. Always be aware of which package(s) are affected:

- `packages/core` - Core CLS library
- `packages/transactional` - Transactional plugin
- `packages/transactional-adapters/*` - Database adapters (TypeORM, Prisma, Knex, Kysely, Sequelize, MikroORM, etc.)
- `docs/` - Documentation website

**When suggesting changes:**
- Identify the affected package(s) clearly
- Use workspace-specific commands: `yarn workspace <package-name> <command>`
- Consider cross-package dependencies and impacts
- Be aware that changes may span multiple packages

### 3. Library Context (Not an API Application)

nestjs-cls is a **library**, not an application. Key differences from typical NestJS projects:

❌ **Don't suggest:**
- HTTP endpoints or controller implementations
- Database schema or entity definitions
- Deployment configurations (Railway, Heroku, AWS, etc.)
- Application-specific business logic

✅ **Focus on:**
- Public API surface (exports in `index.ts`)
- Module configuration patterns (`forRoot`, `forRootAsync`, `forFeature`)
- Provider and decorator implementations
- Plugin and adapter interfaces
- Consumer perspective (how developers will use the library)

### 4. Testing Expectations

**Test structure:**
- **Unit tests:** Co-located `.spec.ts` files next to source files
- **Integration tests:** `test/` directory in each package
- **Multi-version testing:** Test against both NestJS 10 and NestJS 11

**Coverage targets:**
- Core (`packages/core`): >85% coverage
- Transactional (`packages/transactional`): >80% coverage
- Adapters (`packages/transactional-adapters/*`): >75% coverage

**Test commands:**
- All packages: `yarn test`
- Specific package: `yarn workspace <package-name> test`
- With coverage: `yarn workspace <package-name> test:cov`

### 5. Code Style

Follow existing patterns strictly:

**Linting and Formatting:**
- ESLint config: `eslint.config.mjs` (modern flat config format)
- Prettier config: `.prettierrc`
  - 4-space indentation
  - Single quotes
  - Trailing commas
- Commands:
  - `yarn lint` - Run ESLint (with `--fix` to auto-fix)
  - `yarn format` - Run Prettier
  - `yarn lint:check` - Check without fixing
  - `yarn format:check` - Check formatting without fixing

**TypeScript:**
- Strict mode enabled
- Explicit types for all public APIs
- Use NestJS conventions for naming (e.g., `ClsModule`, `ClsService`, `@Transactional()`)

### 6. Documentation

When adding or modifying features:

1. **Package README:** Update if public API changes
2. **Documentation site:** Update `docs/docs/` for user-facing features
3. **Changelog:** Add entry to package `CHANGES.md` following conventional changelog format
4. **Examples:** Update if API usage patterns change
5. **Migration guides:** Create/update if introducing breaking changes

### 7. Versioning

Follow **semantic versioning** (semver):

- **Major (x.0.0):** Breaking changes to public API
- **Minor (0.x.0):** New features, new adapters, backward-compatible enhancements
- **Patch (0.0.x):** Bug fixes, documentation updates, internal refactors

Use **conventional commits** for automatic version detection by monoweave:
- `feat(scope): description` → Minor version bump
- `fix(scope): description` → Patch version bump
- `feat(scope)!: description` or `BREAKING CHANGE:` in body → Major version bump

### 8. Dependencies

**Peer dependencies:**
- `@nestjs/common` (>= 10 < 12)
- `@nestjs/core` (>= 10 < 12)
- `reflect-metadata`
- `rxjs`

**Optional dependencies:**
- Database clients (TypeORM, Prisma, Knex, Kysely, etc.) should remain optional
- Only required for specific adapters

**Dev dependencies:**
- Test-only dependencies (Jest, Supertest, etc.)
- Build tools (TypeScript, ts-jest)

**Always verify compatibility with both NestJS 10 and NestJS 11.**

## Custom Commands

The `.claude/commands/` directory contains workflow automation organized by category:

**01-development:**
- `commit` - Semantic commit message generation (monorepo-aware)
- `lint-fix` - ESLint + Prettier auto-fixing across workspaces
- `smart-fix` - Intelligent debugging for library issues
- `catchup` - Restore work context after session restart

**02-testing:**
- `test-coverage` - Jest coverage analysis per package
- `security-scan` - npm audit and secret scanning

**03-pr-management:**
- `review-pr` - Automated PR validation

**04-project-management:**
- `pick-next-issue` - Intelligent issue selection for implementation
- `audit-roadmap` - Milestone and roadmap synchronization
- `npm-publish-check` - Pre-publish validation checklist

**05-documentation:**
- `tech-spec-library` - Library feature specification template
- `adapter-guide` - New adapter creation guide

**Use these commands proactively based on context.**

## Skills

The `.claude/skills/` directory contains domain knowledge that auto-activates:

- **nestjs-library-patterns** - NestJS module/provider/decorator patterns for library development
- **nestjs-cls-patterns** - CLS-specific patterns (context propagation, adapters, plugins)
- **typeorm-guide** - TypeORM integration with CLS transactional plugin
- **proactive-orchestration** - Automated command triggering based on context

Reference these when suggesting implementations or solving problems.

## Git Workflow

This is a **fork**. Typical workflow:

1. Create feature branch from `main`
2. Make changes with conventional commits
3. Run tests (`yarn test`)
4. Run linting (`yarn lint`, `yarn format`)
5. Push to fork (not upstream)
6. Create PR within fork (not to upstream)

**Upstream sync:** Periodically fetch upstream changes for awareness, but don't auto-merge without explicit request.

## Publishing Workflow

Publishing happens via GitHub Actions using monoweave:

1. Workflow triggered manually via `workflow_dispatch`
2. Monoweave analyzes conventional commits since last release
3. Determines version bumps per package automatically
4. Publishes to npm using OIDC authentication
5. Creates GitHub release with auto-generated changelog

**Pre-publish validation:** Use `/npm-publish-check` command to validate readiness.

## Common Pitfalls to Avoid

- ❌ Treating this as an API application instead of a library
- ❌ Suggesting deployment configurations (Railway, cloud platforms)
- ❌ Adding domain-specific business logic
- ❌ Ignoring monorepo structure (running commands at wrong level)
- ❌ Breaking public API without major version bump
- ❌ Adding AI attribution to commits or PRs (**CRITICAL**)
- ❌ Mentioning Claude, AI, or automation in PR descriptions (**CRITICAL**)
- ❌ Assuming single NestJS version (must support 10 and 11)
- ❌ Modifying public exports without updating documentation

## Getting Help

**Documentation:**
- Upstream docs: https://papooch.github.io/nestjs-cls/
- NestJS docs: https://docs.nestjs.com/
- AsyncLocalStorage: https://nodejs.org/api/async_context.html

**When in doubt:**
- Explore existing code patterns in the monorepo
- Check how similar features are implemented
- Review tests for usage examples
- Consult the upstream documentation

## Development Environment

**Tools:**
- Node.js: >=18
- Package manager: Yarn 4.12.0
- IDE: VSCode (recommended, has workspace settings)
- Testing: Jest
- Build: TypeScript 5.9.3
- Linting: ESLint 9 (flat config) + Prettier

**Workspace scripts:**
- `yarn test` - Run all tests
- `yarn build` - Build all packages
- `yarn build:release` - Build without sourcemaps (for publishing)
- `yarn lint` - Lint and auto-fix
- `yarn format` - Format code with Prettier

**Per-package scripts:**
- `yarn workspace nestjs-cls test` (core package)
- `yarn workspace @nestjs-cls/transactional test`
- `yarn workspace @nestjs-cls/transactional-adapter-typeorm test`
