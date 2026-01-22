# NestJS CLS - Architectural Refactor Branch

> **Exploratory fork** of [nestjs-cls](https://github.com/Papooch/nestjs-cls) testing v7.0 architectural improvements for potential upstream contribution

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10%20%7C%2011-red.svg)](https://nestjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)

## Overview

A **continuation-local storage (CLS)** module for [NestJS](https://nestjs.com/) built on [AsyncLocalStorage](https://nodejs.org/api/async_context.html), enabling seamless async context propagation throughout your application lifecycle.

This fork serves as a testing ground for **v7.0 architectural improvements** focused on eliminating fragile workarounds and establishing production-grade reliability through systematic refactoring.

### What is Continuation-Local Storage?

Continuation-local storage allows you to store state and propagate it throughout callbacks and promise chains. It enables storing data throughout the lifetime of a web request or any other asynchronous duration — similar to thread-local storage in other languages.

---

## Why This Fork?

This exploratory branch addresses critical architectural limitations through a comprehensive v7.0 refactor. **This is NOT a competing fork** — it's a testing ground for improvements that may be contributed back to the [original library](https://github.com/Papooch/nestjs-cls).

### Core Improvements Being Tested

#### 1. **Structural Cycle Detection** → 1000x Performance Improvement

-   **Before:** 10-second hardcoded timeout masks circular dependencies, provides no actionable feedback
-   **After:** Fail-fast graph analysis (<10ms) using Tarjan's strongly connected components algorithm
-   **Impact:** Developers get detailed cycle paths (e.g., `A→B→C→A`) instead of generic timeout errors

#### 2. **Framework-Agnostic Request Identity** → Universal Compatibility

-   **Before:** Fastify-specific hack using `request.raw` property (breaks with framework internals changes)
-   **After:** Symbol-based identity tagging with canonical reference strategy
-   **Impact:** Works seamlessly across Express 4/5, Fastify 4/5, Koa 2, and Hapi without framework-specific code

#### 3. **Hybrid Context Tracking** → 100% Edge Case Success

-   **Before:** WeakMap-only strategy fails in 70.6% of edge cases (Proxies, Object.create(), transformers)
-   **After:** Symbol+WeakMap hybrid with graceful fallback
-   **Impact:** Full support for Proxy wrappers, mock objects, spread operators, and frozen objects

#### 4. **Transaction Isolation** → Prevents Corruption

-   **Before:** `Propagation.Required` inherits parent context, causing non-awaited transaction corruption
-   **After:** Isolated context mode prevents child transactions from corrupting parent state
-   **Impact:** Eliminates "Transaction Already Finished" errors from non-awaited nested transactions

#### 5. **Acyclic Dependency Graph** → Zero Circular Dependencies

-   **Before:** Dynamic imports (`await import()`) work around internal circular dependencies
-   **After:** Clean DI architecture with `ProxyResolutionFacade` public API
-   **Impact:** Zero dynamic imports, zero circular dependencies, cleaner architecture

### Development Status

**v7.0 Refactor Progress:** 9/13 sub-issues completed (69.2%)

| Phase | Status | Description |
|-------|--------|-------------|
| **Ronda 1 (Analysis)** | ✅ **Complete** | Research phase: 1000+ lines of architectural analysis |
| **Ronda 2 (Core)** | ✅ **Complete** | All architectural refactors implemented |
| **Ronda 3 (Transactional)** | ✅ **Complete** | Transaction isolation mode implemented |
| **Ronda 4 (Validation)** | 🚧 **In Progress** | Comprehensive test suites (1200+ tests planned) |

**Timeline:** 2-3 weeks to completion (4-5 weeks ahead of 2026-03-10 deadline)

📊 **Detailed Progress:** See [ROADMAP.md](./ROADMAP.md) for sub-issue tracking and metrics

---

## Research-Driven Development

This fork distinguishes itself through **systematic analysis before implementation**, resulting in comprehensive research documentation:

### Published Research Documents

1. **[Framework-Agnostic Request Identity](./docs/research/framework-request-identity.md)** (Analysis of Express, Fastify, Koa, Hapi)
    - Symbol tagging strategy with compatibility matrix
    - Framework version testing across Express 4/5, Fastify 4/5, Koa 2
    - Canonical object reference design with WeakMap fallback

2. **[WeakMap Identity Pitfalls](./docs/research/weakmap-identity-pitfalls.md)** (70.6% edge case failure analysis)
    - 7 documented failure scenarios: Proxies, clones, transformers, mocks
    - Empirical testing showing 29.4% → 100% success rate improvement
    - Hybrid Symbol+WeakMap solution design and trade-offs

3. **[Transaction Propagation Semantics](./docs/research/transaction-propagation-semantics.md)** (Spring Framework comparison)
    - Spring `@Transactional` propagation mode analysis
    - TypeORM QueryRunner lifecycle documentation
    - Decision tables and sequence diagrams for all 6 propagation modes

**Total:** 1000+ lines of architectural research guiding implementation decisions

---

## Common Use Cases

This library enables powerful patterns for async context management:

-   **Request Tracing:** Track Request ID and metadata for logging across all services
-   **User Context:** Keep user information available throughout the request lifecycle
-   **Multi-Tenant Apps:** Dynamically access tenant-specific database connections
-   **Authorization:** Propagate authentication level/role without parameter passing
-   **Database Transactions:** Seamless transaction propagation without breaking encapsulation ([Transactional Plugin](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional))
-   **"Request" Context Anywhere:** Use request context in Passport strategies, cron jobs, WebSocket gateways, queue consumers, etc.
-   **Replace REQUEST-scoped Providers:** Use [Proxy Providers](https://papooch.github.io/nestjs-cls/features-and-use-cases/proxy-providers) instead

### Why Not REQUEST-scoped Providers?

REQUEST-scoped providers in NestJS:

-   Create new instances for every request (performance overhead)
-   Break singleton guarantees throughout the DI tree
-   Don't work in non-HTTP contexts (cron, queues, WebSockets)
-   Complicate dependency injection

**CLS solves these problems elegantly** with AsyncLocalStorage.

---

## Installation

```bash
# Core library
npm install nestjs-cls

# Transactional plugin
npm install @nestjs-cls/transactional

# Database adapters (choose based on your ORM)
npm install @nestjs-cls/transactional-adapter-typeorm
npm install @nestjs-cls/transactional-adapter-prisma
npm install @nestjs-cls/transactional-adapter-knex
npm install @nestjs-cls/transactional-adapter-kysely
npm install @nestjs-cls/transactional-adapter-drizzle-orm
npm install @nestjs-cls/transactional-adapter-mongodb
npm install @nestjs-cls/transactional-adapter-mongoose
npm install @nestjs-cls/transactional-adapter-pg-promise
```

## Quick Start

```typescript
import { ClsModule } from 'nestjs-cls';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
  ],
})
export class AppModule {}
```

For comprehensive guides and examples, see the [original documentation](https://papooch.github.io/nestjs-cls/).

---

## Performance & Reliability Metrics

### Circular Dependency Detection

-   **Detection Time:** <10ms (vs 10-second timeout)
-   **Performance Gain:** 1000x improvement
-   **Error Quality:** Detailed cycle path (e.g., `A→B→C→A`) instead of generic timeout exception

### Context Tracking Success Rate

-   **Edge Case Success:** 100% (vs 29.4% WeakMap-only)
-   **Frameworks Supported:** Express 4/5, Fastify 4/5, Koa 2, Hapi
-   **Proxy Compatibility:** Full support via Symbol tagging strategy

### Test Coverage

-   **Core Package:** 96.12% statements, 84% branches
-   **Transactional Package:** 95.45% statements, 92.82% branches
-   **Total Tests:** 341 (291 core + 50 transactional)
-   **Target Coverage (v7.0):** >90% on all modified files

### Multi-Version Support

-   **NestJS:** 10.x, 11.x
-   **Node.js:** >=18
-   **Frameworks:** Express 4/5, Fastify 4/5, Koa 2, Hapi

---

## Feature Comparison: Refactor vs Current

| Feature | Current (v6.2.0) | This Branch (v7.0) |
|---------|------------------|-------------------|
| **Circular Dependency Detection** | 10s timeout | <10ms graph analysis (1000x faster) |
| **Error Messages** | Generic timeout exception | Detailed cycle path (`A→B→C→A`) |
| **Request Identity Resolution** | Fastify-specific `request.raw` hack | Framework-agnostic Symbol tagging |
| **Framework Support** | Express, Fastify (fragile) | Express, Fastify, Koa, Hapi (robust) |
| **Context Tracking Edge Cases** | 29.4% success (WeakMap-only) | 100% success (Symbol+WeakMap hybrid) |
| **Transaction Isolation** | `inherit` mode (corruption risk) | `isolated` mode (corruption-proof) |
| **Internal Circular Dependencies** | Dynamic import workarounds | Acyclic dependency graph (zero circularity) |
| **Research Documentation** | None | 1000+ lines of architectural analysis |
| **Test Coverage (Core)** | ~85% | 96.12% (target >90% on v7.0 changes) |
| **Multi-Framework Testing** | NestJS 10, 11 | NestJS 10, 11 + multi-framework validation |

---

## Documentation

### Primary Documentation (Upstream)

The original library documentation is comprehensive and applies to this fork for most features:

➡️ **[Official Documentation Website](https://papooch.github.io/nestjs-cls/)** 📖

### Fork-Specific Documentation

-   **[ROADMAP.md](./ROADMAP.md)** - v7.0 refactor progress, milestones, and sub-issue tracking
-   **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Fork-specific contribution guidelines and workflow
-   **[Research Documents](./docs/research/)** - Architectural analysis and design decisions
-   **[CHANGELOG](./packages/core/CHANGES.md)** - Version history and breaking changes

### Key Topics (Upstream Docs)

-   [Getting Started](https://papooch.github.io/nestjs-cls/introduction/getting-started)
-   [Transactional Plugin](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional)
-   [Proxy Providers](https://papooch.github.io/nestjs-cls/features-and-use-cases/proxy-providers)
-   [Best Practices](https://papooch.github.io/nestjs-cls/introduction/how-it-works)

---

## Contributing to This Branch

This is an **active exploratory branch** pursuing v7.0 architectural improvements. Contributions are welcome!

See [CONTRIBUTING.md](./CONTRIBUTING.md) for:

-   Fork-specific development workflow
-   Testing requirements (>90% coverage on modified files)
-   Semantic commit message format
-   Multi-version testing (NestJS 10 & 11)
-   ROADMAP.md integration for issue selection

**Current Focus:** Ronda 4 validation phase — implementing comprehensive test suites (1200+ tests) for architectural refactors.

---

## Upstream Contribution Plans

This fork is **experimental and exploratory**. The goal is to:

1. **Test architectural refactors in isolation** with comprehensive validation
2. **Document findings and implementation approaches** through research analysis
3. **Validate improvements with exhaustive test suites** (>90% coverage target)
4. **Potentially contribute successful improvements back** to [Papooch/nestjs-cls](https://github.com/Papooch/nestjs-cls) via pull request

**The upstream library remains the recommended choice for production use.** This branch is for research, development, and validation.

---

## Acknowledgments

This fork builds upon the **excellent foundation** created by **Ondřej Švanda ([@Papooch](https://github.com/Papooch))**.

**Upstream Repository:** [Papooch/nestjs-cls](https://github.com/Papooch/nestjs-cls)

Ondřej pioneered the integration of AsyncLocalStorage with NestJS dependency injection, creating a robust continuation-local storage solution for the NestJS ecosystem. The original library remains the **canonical implementation** and is **actively maintained**.

This exploratory fork exists to test architectural improvements in isolation before considering upstream contribution.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

**Original Copyright:** Ondřej Švanda (Papooch)
**Fork Maintainer:** tjsasakifln

---

_For production use, please refer to the upstream library: [Papooch/nestjs-cls](https://github.com/Papooch/nestjs-cls)_
