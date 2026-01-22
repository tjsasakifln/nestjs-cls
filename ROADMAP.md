# NestJS CLS - Architectural Refactor Roadmap

## 🎯 Mission Statement

Replace fragile workarounds with robust structural solutions across 4 critical issues that were previously marked as "solved" but rely on brittle implementations.

---

## 📊 Executive Summary

| Metric              | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **Total Issues**    | 4 critical (#169, #223, #129, #196) + 1 internal cleanup |
| **Sub-Issues**      | 13 (fragmented for manageability)                        |
| **Progress**        | 8/13 completed (61.5%) - #2, #3, #5, #6, #8, #9, #11, #14 ✅ |
| **Timeline**        | 7 weeks (Week 1 in progress)                             |
| **Expected Impact** | Major version bump (v7.0)                                |
| **New Tests**       | 1200+ comprehensive tests                                |
| **Coverage Target** | >90% on modified files                                   |
| **Performance**     | Fail-fast (<10ms vs 10s), no degradation                 |

---

## 🚨 Critical Issues Breakdown

### Issue #169: Proxy Provider Dependency Resolution

**Current State:** 10-second timeout masks circular dependencies
**Target State:** Structural cycle detection using graph analysis
**Impact:** HIGH - Prevents production deadlocks

**Fragility:**

- Hardcoded 10s timeout in `proxy-provider-resolver.ts:82-96`
- Doesn't prevent circular deps, only detects after timeout
- Generic timeout exception without cycle path information

**Solution:**

- Implement Tarjan's strongly connected components algorithm
- Fail-fast with detailed cycle path (e.g., "A→B→C→A")
- Remove timeout completely

**Sub-Issues:** #1, #2, #3

---

### Issue #223: Context Leaking (Fastify Multi-Enhancers)

**Current State:** Fastify-specific hack using `request.raw` property
**Target State:** Framework-agnostic Symbol-based identity resolution
**Impact:** HIGH - Breaks with Fastify internal changes

**Fragility:**

- Relies on Fastify's internal `request.raw` structure
- Hardcoded in `context-cls-store-map.ts:39-44`
- No abstraction for other frameworks

**Solution:**

- Create `RequestIdentityResolver` using Symbol tagging
- Support Express, Fastify, Koa, Hapi uniformly
- Fallback to WeakMap when Symbol can't be added

**Sub-Issues:** #4, #5, #6

---

### Issue #129: Context Leaking (ClsGuard)

**Current State:** WeakMap-only tracking fails with Proxy objects
**Target State:** Hybrid Symbol+WeakMap for robustness
**Impact:** MEDIUM - False negatives in testing/mocking scenarios

**Fragility:**

- WeakMap identity comparison fails on Proxy wrappers
- No fallback mechanism
- Silent failures (creates duplicate contexts)

**Solution:**

- Primary: Symbol tagging (like #223)
- Fallback: WeakMap for frozen/sealed objects
- Graceful degradation

**Sub-Issues:** #7, #8, #9

---

### Issue #196: Transaction Context Reuse

**Current State:** Parent context inheritance causes corruption
**Target State:** Proper context isolation with lifecycle tracking
**Impact:** HIGH - Non-awaited transactions corrupt parent state

**Fragility:**

- `Propagation.Required` uses `ifNested: 'inherit'` (line 172)
- Child transactions can outlive parent, causing "Transaction already finished"
- No isolation guarantees

**Solution:**

- Implement `ifNested: 'isolated'` mode in ClsService
- Add lifecycle hooks to TransactionalAdapter interface
- Track child contexts and prevent premature parent completion

**Sub-Issues:** #10, #11, #12

---

### Bonus: Internal Circular Dependency

**Current State:** `cls.service.ts:237-240` uses dynamic import workaround
**Target State:** Clean dependency graph with proper DI
**Impact:** MEDIUM - Technical debt cleanup

**Fragility:**

```typescript
// TODO: This should be untangled and cleaned up
const { ProxyProviderManager } =
    await import('./proxy-provider/proxy-provider-manager');
```

**Solution:**

- Extract `ProxyResolutionFacade` to break circular dependency
- Deprecate `ClsService.resolve()` with migration guide
- Clean DI architecture

**Sub-Issues:** #13

---

## 📅 Implementation Timeline

### Week 1-2: Ronda 1 - Analysis Phase

**Objective:** Complete all research before writing code

| Sub-Issue | Title                               | Package       | Deliverable                           | Status                              |
| --------- | ----------------------------------- | ------------- | ------------------------------------- | ----------------------------------- |
| ✅ #2     | Directed graph analysis             | core          | `dependency-graph.ts` + specs         | **COMPLETED** (PR #15, 2026-01-21)  |
| ✅ #5     | Framework-agnostic request identity | core          | Research doc + compatibility matrix   | **COMPLETED** (d517ce5, 2026-01-21) |
| ✅ #8     | WeakMap false negatives             | core          | Research doc + edge case reproduction | **COMPLETED** (PR #20, 2026-01-21)  |
| ✅ #11    | Transaction propagation semantics   | transactional | Semantic specification doc            | **COMPLETED** (PR #22, 2026-01-21)  |

**Exit Criteria:**

- ✅ ~~#2 completed~~ - DependencyGraph utility implemented with 96.9% coverage
- ✅ ~~#5 completed~~ - Framework request identity analysis with Symbol tagging strategy
- ✅ ~~#8 completed~~ - WeakMap identity pitfalls documented with 70.6% failure rate
- ✅ ~~#11 completed~~ - Transaction propagation semantics documented with Spring/TypeORM analysis

---

### Week 3-4: Ronda 2 - Core Implementation

**Objective:** Implement foundational changes in `packages/core`

| Sub-Issue | Title                            | Package | Key Changes                         | Status                             |
| --------- | -------------------------------- | ------- | ----------------------------------- | ---------------------------------- |
| ✅ #3     | Proxy Provider resolver refactor | core    | Replace timeout with graph analysis | **COMPLETED** (PR #23, 2026-01-21) |
| ✅ #6     | Request identity resolver        | core    | Symbol-based identity + fallbacks   | **COMPLETED** (PR #24, 2026-01-21) |
| ✅ #9     | Context tracking hybrid strategy | core    | Symbol+WeakMap implementation       | **COMPLETED** (commit 79aeab2, 2026-01-21) |
| ✅ #14    | Circular dependency cleanup      | core    | Extract ProxyResolutionFacade       | **COMPLETED** (commit c93bf70, 2026-01-21) |

**Exit Criteria:**

- ✅ All core tests pass (291/291)
- ✅ Type checking passes
- ✅ Linting passes
- ✅ No performance degradation (1000x improvement for #3)

**Status:** **COMPLETED** - All 4 Ronda 2 sub-issues done! 🎉

---

### Week 5: Ronda 3 - Transactional Implementation

**Objective:** Implement transaction isolation fixes

| Sub-Issue | Title                     | Package       | Key Changes                    |
| --------- | ------------------------- | ------------- | ------------------------------ |
| #11       | Transaction isolation     | transactional | `ifNested: 'isolated'` mode    |
| #11       | Adapter interface updates | adapters/\*   | Lifecycle hooks implementation |

**Exit Criteria:**

- ✅ TypeORM adapter tests pass
- ✅ Prisma adapter tests pass
- ✅ All propagation modes validated

---

### Week 6-7: Ronda 4 - Comprehensive Validation

**Objective:** Validate with exhaustive test suites

| Sub-Issue | Title                             | Package       | Test Count |
| --------- | --------------------------------- | ------------- | ---------- |
| #3        | Circular dependency tests         | core          | 200+ tests |
| #6        | Multi-framework integration tests | core          | 400+ tests |
| #9        | Edge case tests (Proxy, mocks)    | core          | 300+ tests |
| #12       | Propagation mode tests            | transactional | 300+ tests |

**Exit Criteria:**

- ✅ 1200+ new tests passing
- ✅ Coverage >90% on all modified files
- ✅ CI/CD passes on original repo (simulated fork)
- ✅ Performance benchmarks stable
- ✅ Documentation updated

---

## 🎁 Final Deliverables

### Code Changes

- **13 sub-issues** implemented and validated
- **7 new files** created in `packages/core`
- **9 files** modified across core and transactional
- **16 test files** added/updated
- **0 timeouts** hardcoded
- **0 framework hacks** remaining
- **0 TODOs** for circular dependencies

### Documentation

- **4 research documents** in `docs/research/`
- **1 migration guide** (`docs/migration/v7-to-v8.md`)
- **2 READMEs** updated (core, transactional)
- **1 CHANGELOG** entry with breaking changes

### Validation

- **1200+ tests** with >90% coverage
- **Multi-framework** validation (Express 4/5, Fastify 4/5, Koa 2)
- **Multi-version** validation (NestJS 10, 11)
- **Performance** benchmarks (no degradation)

---

## 🔄 Workflow Strategy

### Development Approach

1. **Fork-based development:** Work in personal fork
2. **Issue-driven:** Each sub-issue is independently reviewable
3. **Validation-first:** Complete all tests before marking sub-issue done
4. **CI/CD validation:** Simulate original repo CI before consolidation

### Git Strategy

- **Main branch:** `feat/architectural-refactor`
- **Sub-branches:** `feat/issue-N-description` (one per sub-issue)
- **Commits:** Conventional commits for automatic versioning
- **Final PR:** Squash/rebase into clean history

### Review Process

1. **Per sub-issue:** Self-review against acceptance criteria
2. **Per phase:** Validate all sub-issues in phase together
3. **Pre-consolidation:** Full integration review
4. **Upstream submission:** Create consolidated PR for original repo

---

## 📈 Success Metrics

### Quantitative

- ✅ **0** hardcoded timeouts
- ✅ **0** framework-specific internal dependencies
- ✅ **0** TODOs for architectural issues
- ✅ **>90%** test coverage on modified files
- ✅ **<5%** performance variance
- ✅ **1200+** new tests
- ✅ **100%** CI/CD pass rate

### Qualitative

- ✅ Error messages are actionable (show cycle path, not just "timeout")
- ✅ Fail-fast behavior (<10ms vs 10s)
- ✅ Code is more testable and modular
- ✅ Documentation clearly explains propagation semantics
- ✅ Migration guide is comprehensive

### Upstream Goals

- ✅ PR accepted in original repo
- ✅ CI/CD passes 100%
- ✅ Positive review from maintainer (@Papooch)
- ✅ Community feedback addresses concerns

---

## 🗺️ Sub-Issue Dependency Graph

```
Ronda 1 (Analysis - Parallel)
├── #1 → Graph Analysis (no deps)
├── #4 → Framework Identity (no deps)
├── #7 → WeakMap Analysis (no deps)
└── #10 → Propagation Semantics (no deps)

Ronda 2 (Core Implementation - Sequential)
├── #2 → Proxy Resolver (depends on #1)
├── #5 → Request Identity (depends on #4)
├── #8 → Context Tracking (depends on #7)
└── #13 → Circular Dep (no deps, but should be last)

Ronda 3 (Transactional - Sequential)
└── #11 → Transaction Isolation (depends on #10, #13)

Ronda 4 (Validation - Parallel)
├── #3 → Proxy Tests (depends on #2)
├── #6 → Framework Tests (depends on #5)
├── #9 → Edge Case Tests (depends on #8)
└── #12 → Propagation Tests (depends on #11)
```

---

## 🚧 Risk Mitigation

### High Risk: Breaking Changes

**Risk:** Code depending on incorrect behavior breaks
**Mitigation:**

- Feature flag for gradual rollout
- Detailed migration guide with examples
- Deprecation warnings before removal
- Clear CHANGELOG with upgrade path

### Medium Risk: Performance

**Risk:** Graph analysis adds overhead
**Mitigation:**

- Cache analysis results per CLS context
- Lazy evaluation where possible
- Benchmark suite (before/after)
- Profile with 1000+ providers

### Low Risk: Framework Compatibility

**Risk:** Exotic framework not supported
**Mitigation:**

- Fallback to WeakMap always available
- Document tested frameworks explicitly
- Community testing before final release

---

## 📞 Communication Plan

### During Development

- Update this ROADMAP weekly with progress
- Mark completed sub-issues with ✅
- Document blockers and pivots

### Pre-Consolidation

- Internal review of all changes
- Performance benchmark report
- Migration guide draft review

### Upstream Submission

- Draft PR with comprehensive description
- Link to all sub-issues and research docs
- Request review from @Papooch
- Address feedback iteratively

---

## 🏁 Completion Criteria

This roadmap is considered **COMPLETE** when:

1. ✅ All 13 sub-issues are closed
2. ✅ All 1200+ tests passing
3. ✅ CI/CD green on fork
4. ✅ CI/CD green on simulated upstream
5. ✅ Documentation updated
6. ✅ Migration guide published
7. ✅ Performance benchmarks stable
8. ✅ Consolidated PR submitted to upstream
9. ✅ PR accepted and merged in original repo
10. ✅ v7.0 released to npm

---

## 📚 References

- **Detailed Plan:** `.claude/plans/tranquil-purring-swing.md`
- **Original Issues:** #169, #223, #129, #196
- **Research Docs:** `docs/research/` (created during Ronda 1)
- **Migration Guide:** `docs/migration/v7-to-v8.md` (created during Ronda 4)
- **Upstream Repo:** https://github.com/Papooch/nestjs-cls

---

**Last Updated:** 2026-01-21
**Status:** Ronda 2 - **COMPLETED** (4/4 complete - 100%) 🎉
**Next Milestone:** Ronda 3 (Transactional Implementation) OR Ronda 4 (Validation)

### Recent Progress

- ✅ **2026-01-21**: Issue #14 completed (commit c93bf70) - **Ronda 2 COMPLETED!** 🎉🎉🎉
    - Created ProxyResolutionFacade as clean public API for proxy resolution
    - Eliminated dynamic import workaround from ClsService.resolve()
    - Refactored ProxyProviderManager to accept ClsService instance in init() method
    - Deprecated ClsService.resolve() in favor of ProxyResolutionFacade.resolveProxyProviders()
    - All 291 core tests passing
    - Breaking change documented with migration guide
    - Addresses Issue #14 (Internal Circular Dependency Cleanup)
    - **RONDA 2 NOW 100% COMPLETE** - All 4 core implementation sub-issues done!

- ✅ **2026-01-21**: Issue #9 completed (commit 79aeab2) - **Ronda 2 MILESTONE: 75%** 🎉
    - Implemented hybrid Symbol+WeakMap strategy for context identity tracking
    - Symbol tagging as primary strategy (works with Proxies, Object.create(), Object.assign(), spread operator)
    - WeakMap fallback for frozen/sealed objects
    - Improved success rate from 29.4% to 100% in edge case scenarios
    - 31 comprehensive tests (17 edge cases + 14 unit tests)
    - 100% test coverage (statements, branches, lines)
    - All 291 core tests passing
    - Addresses Issue #129 (Context Leaking - ClsGuard)
    - Ready for Ronda 2 final issue (#14)

- ✅ **2026-01-21**: Issue #6 completed (PR #24) - **Ronda 2 MILESTONE: 50%** 🎉
    - Implemented framework-agnostic RequestIdentityResolver with Symbol tagging strategy
    - Replaced Fastify-specific `request.raw ?? request` hack with canonical object reference approach
    - Support for Express, Fastify, Koa, Hapi, and custom frameworks without framework dependencies
    - Symbol tagging with WeakMap fallback for frozen/sealed objects
    - 28 comprehensive unit tests with 100% coverage on RequestIdentityResolver
    - Integration tests for Express, Fastify, Koa patterns with edge cases (frozen objects, Proxy, concurrent access)
    - All 277 core tests passing
    - Coverage: 96.12% statements, 84% branches (core package)
    - Refactored ContextClsStoreMap to use RequestIdentityResolver.getIdentity()
    - Exported RequestIdentityResolver in public API
    - Breaking change documented in CHANGES.md with migration guide
    - Addresses #223 (Fastify multi-enhancer context leaking)
    - Merged to main branch (commit 81cf25c)
    - Ready for Ronda 2 next sub-issues (#9, #14)

- ✅ **2026-01-21**: Issue #3 completed (PR #23, GitHub Issue #17) - **Ronda 2 STARTED** 🎉
    - Integrated DependencyGraph into ProxyProvidersResolver for circular dependency detection
    - Replaced 10s timeout with fail-fast DFS-based cycle validation (<10ms)
    - Created ProxyProviderCircularDependencyException with detailed cycle path error messages
    - Added caching for cycle analysis results across multiple resolution contexts
    - Comprehensive test suite: 6 new tests covering self-reference, cycles, valid DAGs, and performance
    - Performance improvement: 1000x faster (10s → <10ms)
    - Coverage: 95.85% overall, 98.57% on proxy-provider-resolver.ts
    - All 249 tests passing
    - Merged to main branch (commit 8b81364)
    - GitHub Issue #17 closed
    - CHANGELOG updated with breaking change notice
    - Ready for next Ronda 2 sub-issues (#6, #9, #14)

- ✅ **2026-01-21**: Issue #11 completed (PR #22) - **Ronda 1 COMPLETED** 🎉
    - Comprehensive transaction propagation semantics documentation (1000+ lines)
    - Analyzed Spring Framework @Transactional and TypeORM QueryRunner semantics
    - Identified Issue #196 root cause: `ifNested: 'inherit'` in `Propagation.Required`
    - Proposed 3 solutions (Hybrid approach recommended for v7.0)
    - Created decision tables, sequence diagrams, and propagation mode comparison
    - Updated transactional README with clarified semantics and non-awaited transaction warnings
    - Research document: `docs/research/transaction-propagation-semantics.md`
    - Ready for Ronda 2 implementation (Issue #12)

- ✅ **2026-01-21**: Issue #8 completed (PR #20)
    - WeakMap object identity comparison pitfalls comprehensively analyzed
    - Documented 7 failure scenarios with 70.6% failure rate in edge cases
    - Created 17-test suite demonstrating Proxy, clone, and transformer failures
    - Identified root cause: WeakMap strict identity breaks with Proxy wrappers
    - Proposed Symbol+WeakMap hybrid solution (95% expected success rate)
    - Current Fastify hack (`request.raw ?? request`) proven insufficient
    - Research document: `docs/research/weakmap-identity-pitfalls.md`
    - Test suite: `packages/core/test/edge-cases/object-identity-failures.spec.ts`
    - Ready for Ronda 2 implementation (Issue #9)

- ✅ **2026-01-21**: Issue #5 completed (commit d517ce5)
    - Framework-agnostic request identity resolution strategy analyzed
    - Researched Express, Fastify, Koa, Hapi request object structures
    - Identified fragility in current `request.raw ?? request` hack
    - Recommended non-registered Symbol tagging as primary solution
    - Created comprehensive compatibility matrix (NestJS 10/11 × frameworks)
    - Documented 3 alternative strategies with pros/cons
    - Research document: `docs/research/framework-request-identity.md`
    - Ready for Ronda 2 implementation (Issue #6)

- ✅ **2026-01-21**: Issue #2 completed (PR #15 merged)
    - DependencyGraph utility implemented with O(V+E) DFS-based cycle detection
    - 24 comprehensive tests, 96.9% coverage
    - Exported as public API in nestjs-cls core package
    - New CI workflow for coverage reporting
    - Released in v6.3.0
