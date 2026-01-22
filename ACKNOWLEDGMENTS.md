# Acknowledgments

## Original Author

This project is a derivative work of **nestjs-cls**, created by **Ondřej Švanda ([@Papooch](https://github.com/Papooch))**.

**Upstream Repository:** https://github.com/Papooch/nestjs-cls
**Original License:** MIT License (Copyright (c) 2023)

Ondřej pioneered the integration of AsyncLocalStorage with NestJS dependency injection, creating a robust foundation for continuation-local storage in the NestJS ecosystem. The original library remains the **canonical implementation** and is **actively maintained**.

---

## Fork Purpose

This exploratory branch tests architectural improvements for potential upstream contribution:

-   **Structural Cycle Detection** - 1000x performance improvement using graph analysis
-   **Framework-Agnostic Request Identity** - Symbol-based tagging supporting Express, Fastify, Koa, Hapi
-   **Hybrid Context Tracking** - Symbol+WeakMap strategy improving edge case success from 29.4% to 100%
-   **Transaction Isolation Modes** - Prevents non-awaited transaction corruption
-   **Acyclic Dependency Graph** - Eliminates circular dependencies and dynamic imports

The branch serves as a testing ground for validating these improvements through comprehensive testing (1200+ new tests) before considering upstream contribution.

---

## Upstream Relationship

This is **NOT a competing fork**. The goal is to:

1. **Test architectural refactors in isolation** with comprehensive validation
2. **Validate improvements with exhaustive test suites** (>90% coverage target)
3. **Document findings and implementation approaches** through research analysis (1000+ lines of documentation)
4. **Potentially contribute successful improvements back** to [Papooch/nestjs-cls](https://github.com/Papooch/nestjs-cls) via pull request

**The upstream library remains the recommended choice for production use.** This branch is for research, development, and validation.

---

## Attribution Principle

All code in this repository is either:

1. **Original work** from Ondřej Švanda (Papooch) under MIT license
2. **Derivative modifications** by tjsasakifln for architectural improvements
3. **Community contributions** (see Git history for full contributor list)

The Git history preserves the complete contribution lineage.

---

## Community

Special thanks to:

-   **Ondřej Švanda (Papooch)** for creating nestjs-cls and pioneering CLS integration with NestJS
-   **NestJS Core Team** for creating an excellent framework that makes this library possible
-   **AsyncLocalStorage Contributors** in Node.js for providing the foundational API
-   **All Contributors** to the original nestjs-cls library who have improved it over time
-   **Everyone who has opened issues, submitted PRs, or provided feedback** to help improve the library

---

## Research Foundation

This fork's improvements are built on comprehensive research:

1. **Framework-Agnostic Request Identity Analysis** - Study of Express, Fastify, Koa, Hapi request handling
2. **WeakMap Identity Pitfalls Documentation** - Empirical testing of 7 edge case failure scenarios
3. **Transaction Propagation Semantics** - Spring Framework comparison and TypeORM lifecycle analysis

These research documents (1000+ lines) are available in [`docs/research/`](./docs/research/) and represent a systematic approach to library development.

---

## License Compliance

This fork complies fully with the MIT License terms of the original work:

-   ✅ Attribution to original author maintained in LICENSE, README, and this file
-   ✅ License text preserved without modification
-   ✅ Copyright notices included in all appropriate files
-   ✅ Modifications documented in CHANGES.md and Git history
-   ✅ Derivative work status clearly communicated

See [LICENSE](./LICENSE) for the full license text.

---

## Gratitude

This exploratory fork would not exist without Ondřej's foundational work. The architectural improvements being tested here are made possible by the solid design principles and clean codebase established in the original library.

**Thank you, Ondřej, for your contribution to the NestJS ecosystem.**

---

_For questions about this fork, open an issue on [tjsasakifln/nestjs-cls](https://github.com/tjsasakifln/nestjs-cls/issues)._

_For the production-ready canonical implementation, visit [Papooch/nestjs-cls](https://github.com/Papooch/nestjs-cls)._
