# Changelog

<!-- MONODEPLOY:BELOW -->

## [Unreleased]

### Features

* **core**: integrate DependencyGraph into proxy-provider-resolver for structural cycle detection
  - Replace timeout-based circular dependency detection with fail-fast DFS-based cycle analysis
  - Add ProxyProviderCircularDependencyException with detailed cycle path in error messages
  - Add caching for cycle analysis results to improve performance across multiple resolutions
  - Reduce detection time from 10s (timeout) to <10ms (structural validation)

* **core**: add framework-agnostic request identity resolution
  - Add RequestIdentityResolver utility for stable request identity across enhancers
  - Use Symbol tagging strategy with WeakMap fallback for frozen objects
  - Support Express, Fastify, Koa, and other frameworks without framework-specific hacks
  - Eliminate dependency on Fastify's internal `request.raw` structure
  - Improve context tracking reliability with Proxy objects and mocked requests

* **core**: replace WeakMap-only tracking with hybrid Symbol+WeakMap strategy
  - Implement Symbol tagging as primary strategy for context identity tracking
  - Use WeakMap fallback for frozen/sealed objects that cannot accept Symbol properties
  - Fix false negatives with Proxy wrappers, Object.create() clones, and mocked objects
  - Improve success rate from 29.4% to 100% in edge case scenarios
  - Symbol properties are copied by Object.assign() and spread operator (better than expected!)
  - Addresses Issue #129 (Context Leaking - ClsGuard)

* **core**: eliminate circular dependency in ClsService proxy resolution
  - Create ProxyResolutionFacade to provide clean public API for proxy resolution
  - Remove dynamic import workaround from ClsService.resolve()
  - Refactor ProxyProviderManager to accept ClsService instance in init() method
  - Export ProxyResolutionFacade as the recommended API for manual proxy resolution
  - Addresses Issue #14 (Internal Circular Dependency Cleanup)

* **core**: add `isolated` mode to ClsContextOptions for transaction isolation (#12)
  - New `ifNested: 'isolated'` option creates completely isolated context (like `override`)
  - Semantically indicates intentional isolation for operations that should not share state
  - Used by transactional package to prevent non-awaited transaction corruption
  - Functionally equivalent to `override` but with clearer intent for transaction scenarios

### Breaking Changes

* **core**: ProxyProvidersResolutionTimeoutException may no longer be thrown - use ProxyProviderCircularDependencyException instead

### Tests

* **core**: add Koa request identity integration test suite (100 tests, 100% passing ✅, Issue #33)
  - **Section 1**: Basic Koa Integration (30 tests) - validates ClsMiddleware, ClsGuard, ClsInterceptor with Koa ctx
  - **Section 2**: Koa Middleware Compatibility (30 tests) - validates koa-router, koa-bodyparser, popular Koa middleware
  - **Section 3**: Koa-Specific Edge Cases (20 tests) - validates ctx delegation (ctx.body, ctx.status), ctx.state, error handling
  - **Section 4**: Multi-Enhancer with Koa (20 tests) - validates all enhancers work together, concurrent requests, ctx properties
  - **Test file**: `packages/core/test/integration/koa-request-identity.spec.ts` (2,811 lines)
  - **Coverage**: Validates RequestIdentityResolver correctly identifies ctx.request as canonical object
  - **Critical validations**: ctx delegation, ctx.state, frozen/sealed objects via WeakMap fallback
  - **Concurrent scenarios**: Up to 50 concurrent requests without context leaks
  - **Addresses**: Issue #223 (framework-agnostic identity resolution for Koa)

* **core**: add Fastify request identity integration test suite (100 tests, 100% passing ✅, Issue #32)
  - **Section 1**: Basic Fastify integration (25 tests) - validates ClsMiddleware, ClsGuard, ClsInterceptor work with Symbol tagging
  - **Section 2**: Fastify v4/v5 compatibility (25 tests) - ensures backward compatibility across Fastify versions
  - **Section 3**: Fastify-specific edge cases (25 tests) - request decorators, hooks, global prefix routing
  - **Section 4**: Multi-enhancer scenarios (25 tests) - ADDRESSES ISSUE #223 (Fastify multi-enhancer context leaking)
  - Validates that RequestIdentityResolver eliminates the fragile `request.raw ?? request` hack
  - **CRITICAL**: All regression tests for Issue #223 pass - multi-enhancer context leaking is FIXED
  - Fixed middleware timing issues by using `setup` hook in ClsModule.forRoot() instead of manual middleware application
  - Setup hook runs INSIDE CLS context ensuring identity tracking always has active context
  - All 100 concurrent request tests pass - proper context isolation verified

* **core**: add comprehensive test suite for simple circular dependency detection (50 tests)
  - Add 10 tests for self-reference cycles (A→A patterns)
  - Add 15 tests for two-node cycles (A→B→A patterns)
  - Add 15 tests for three-node cycles (A→B→C→A patterns)
  - Add 10 tests for error message validation
  - All tests complete in ~28s with individual detection <50ms
  - Addresses Issue #27

* **core**: add comprehensive test suite for complex circular dependency scenarios (100 tests)
  - Add 25 tests for nested cycles within larger dependency graphs
  - Add 25 tests for multiple independent cycles in single graph
  - Add 25 tests for long cycle chains (5-25 nodes) with performance validation
  - Add 25 tests for mixed real-world scenarios (microservices, repositories, observers)
  - All cycle detections complete in <10ms
  - Achieves 96.87% line coverage on dependency-graph.ts
  - Addresses Issue #28

* **core**: add comprehensive test suite for valid DAGs (50 tests) - no false positives
  - Add 15 tests for diamond dependency patterns (A→B,C; B,C→D and variations)
  - Add 10 tests for linear chain patterns (A→B→C→D with up to 20+ nodes)
  - Add 15 tests for tree structure patterns (binary, unbalanced, wide, deep trees)
  - Add 10 tests for mixed valid patterns (disconnected DAGs, large graphs 100+ providers)
  - Validates ZERO false positives (all valid DAGs resolve successfully)
  - All resolutions complete in <100ms, large graphs (100+ providers) in <200ms
  - Ensures DependencyGraph doesn't incorrectly flag valid acyclic dependencies as cycles
  - Addresses Issue #29

* **core**: add Express request identity integration test suite (100 tests)
  - Add 25 tests for basic Express integration (ClsMiddleware, ClsGuard, ClsInterceptor)
  - Add 25 tests for Express v4 vs v5 compatibility (request object structure, Symbol tagging)
  - Add 25 tests for Express-specific edge cases (middleware transformations, body-parser, express-session)
  - Add 25 tests for multi-enhancer scenarios (Middleware + Guard, Middleware + Interceptor, all enhancers)
  - Validates RequestIdentityResolver works correctly with Express framework
  - Zero context leaks in 100 concurrent request scenarios
  - Addresses Issue #31 (Ronda 4 - Multi-Framework Integration Tests)

* **core**: add comprehensive test suite for circular dependency edge cases (30 tests)
  - Add 10 tests for empty and minimal graph scenarios (no providers, single provider, etc.)
  - Add 10 tests for providers with various dependency patterns (multiple dependencies, shared deps, etc.)
  - Add 10 tests for special character and naming edge cases (Unicode, special chars, long names, etc.)
  - Validates graceful handling of unusual but valid dependency configurations
  - All tests complete successfully without false positives or framework errors
  - Addresses Issue #30 (Section 1)

* **core**: add comprehensive test suite for circular dependency performance benchmarks (20 tests)
  - Add 10 tests for cycle detection performance (linear chains, tree structures, large graphs up to 1000 providers)
  - Add 10 tests for valid DAG validation performance (balanced trees, deep chains, wide graphs, complex mixed patterns)
  - Validates performance meets ROADMAP targets for large-scale dependency graphs
  - Cycle detection in 1000-provider graphs completes in <1000ms
  - Valid DAG resolution for 1000-provider graphs completes in <1000ms
  - Performance tests validate both correctness and efficiency of DependencyGraph implementation
  - Addresses Issue #30 (Section 2)

* **core**: ContextClsStoreMap now uses RequestIdentityResolver for HTTP requests
  - HTTP request identity is now resolved using Symbol tagging instead of `request.raw ?? request`
  - This change should be transparent to users, but custom code relying on the old behavior may need updates
  - Migration: If you're directly accessing or depending on the `request.raw` fallback logic, switch to using RequestIdentityResolver.getIdentity(request)

* **core**: ProxyProviderManager.init() now requires ClsService parameter
  - The init() method signature changed from `init()` to `init(clsService: ClsService)`
  - This change only affects users directly calling ProxyProviderManager.init() (rare)
  - Migration: Pass the ClsService instance (usually globalClsService) to init()
  - Internal usage in ClsRootModule has been updated automatically

* **core**: ClsService.resolve() is deprecated in favor of ProxyResolutionFacade
  - ClsService.resolve() still works but is marked as deprecated
  - Recommended migration: Replace `clsService.resolve(tokens)` with `ProxyResolutionFacade.resolveProxyProviders(tokens)`
  - The deprecated method will be removed in a future major version
  - Example:
    ```typescript
    // Old (deprecated)
    await this.cls.resolve([MyService]);

    // New (recommended)
    import { ProxyResolutionFacade } from 'nestjs-cls';
    await ProxyResolutionFacade.resolveProxyProviders([MyService]);
    ```

## [6.3.0](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@6.2.0...nestjs-cls@6.3.0) "nestjs-cls" (2026-01-21)<a name="6.3.0"></a>

### Features

* **core**: add dependency graph utility for cycle detection ([d0f3b36](https://github.com/Papooch/nestjs-cls/commits/d0f3b36))




## [6.2.0](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@6.1.0...nestjs-cls@6.2.0) "nestjs-cls" (2026-01-06)<a name="6.2.0"></a>

### Features

* **core**: add control over logging debug messages (#445) ([c09bdab](https://github.com/Papooch/nestjs-cls/commits/c09bdab))




## [6.1.0](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@6.0.1...nestjs-cls@6.1.0) "nestjs-cls" (2025-11-17)<a name="6.1.0"></a>

### Features

* support proxying functions with explicit properties ([dec5c2c](https://github.com/Papooch/nestjs-cls/commits/dec5c2c))
* **core**: support proxying functions with explicit properties (#389) ([dec5c2c](https://github.com/Papooch/nestjs-cls/commits/dec5c2c))




## [6.0.1](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@6.0.0...nestjs-cls@6.0.1) "nestjs-cls" (2025-06-02)<a name="6.0.1"></a>

### Bug Fixes

* **core**: remove unnecessary build step from prepack ([0d1e921](https://github.com/Papooch/nestjs-cls/commits/0d1e921))
* **core**: do not publish source maps (#322) ([0d1e921](https://github.com/Papooch/nestjs-cls/commits/0d1e921))




## [6.0.0](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@5.4.3...nestjs-cls@6.0.0) "nestjs-cls" (2025-05-29)<a name="6.0.0"></a>

### Breaking Changes

* The experimental Plugin API has been changed ([4623607](https://github.com/Papooch/nestjs-cls/commits/4623607))
* Access to Proxy providers moved to a dedicated `proxy` property on the ClsService ([82cdeef](https://github.com/Papooch/nestjs-cls/commits/82cdeef))

### Features

* **core**: introduce hooks for the Plugin API (#283) ([4623607](https://github.com/Papooch/nestjs-cls/commits/4623607))




## [5.4.3](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@5.4.2...nestjs-cls@5.4.3) "nestjs-cls" (2025-04-18)<a name="5.4.3"></a>

### Dependencies

* update nestjs-related deps ([a10e589](https://github.com/Papooch/nestjs-cls/commits/a10e589))
* update database deps ([4cb30aa](https://github.com/Papooch/nestjs-cls/commits/4cb30aa))
* update testing deps ([d92a42d](https://github.com/Papooch/nestjs-cls/commits/d92a42d))
* update dev deps ([f22b578](https://github.com/Papooch/nestjs-cls/commits/f22b578))
* update dev deps ([58874d3](https://github.com/Papooch/nestjs-cls/commits/58874d3))




## [5.4.2](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@5.4.1...nestjs-cls@5.4.2) "nestjs-cls" (2025-03-26)<a name="5.4.2"></a>

### Bug Fixes

* **core**: un-deprecate wrongly deprecated parts of the plugin API (#228) ([11ca429](https://github.com/Papooch/nestjs-cls/commits/11ca429))




## [5.4.1](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@5.4.0...nestjs-cls@5.4.1) "nestjs-cls" (2025-03-19)<a name="5.4.1"></a>

### Bug Fixes

* **core**: fix context loss when multiple enhancers are used with Fastify 5 ([b3d38c3](https://github.com/Papooch/nestjs-cls/commits/b3d38c3))
* **core**: reuse context when other Cls-enhancers are used together with ClsMiddleware with Fastify 5 (#223) ([b3d38c3](https://github.com/Papooch/nestjs-cls/commits/b3d38c3))




## [5.4.0](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@5.3.0...nestjs-cls@5.4.0) "nestjs-cls" (2025-02-17)<a name="5.4.0"></a>

### Features

* **core**: mark parts of old plugin API as deprecated, update docs (#217) ([48da8a2](https://github.com/Papooch/nestjs-cls/commits/48da8a2))




## [5.3.0](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@5.2.0...nestjs-cls@5.3.0) "nestjs-cls" (2025-02-16)<a name="5.3.0"></a>

### Bug Fixes

* **core**: add timeout to Proxy Provider resolution ([100d277](https://github.com/Papooch/nestjs-cls/commits/100d277))

### Features

* **core**: allow Proxy Providers to depend on each other ([90a7ee3](https://github.com/Papooch/nestjs-cls/commits/90a7ee3))




## [5.2.0](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@5.1.2...nestjs-cls@5.2.0) "nestjs-cls" (2025-02-10)<a name="5.2.0"></a>

### Dependencies

* allow nestjs 10 as peer dependency ([b7057cb](https://github.com/Papooch/nestjs-cls/commits/b7057cb))

### Features

* **core**: automatically detect fastify and express versions ([45a1be3](https://github.com/Papooch/nestjs-cls/commits/45a1be3))




## [5.1.2](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@5.1.1...nestjs-cls@5.1.2) "nestjs-cls" (2025-02-09)<a name="5.1.2"></a>

### Bug Fixes

* **core**: allow all Object.prototype key access on strict providers (#214) ([e938c6d](https://github.com/Papooch/nestjs-cls/commits/e938c6d))




## [5.1.1](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@5.1.0...nestjs-cls@5.1.1) "nestjs-cls" (2025-02-09)<a name="5.1.1"></a>

### Bug Fixes

* **core**: clarify error message for default proxy providers ([29ed8a4](https://github.com/Papooch/nestjs-cls/commits/29ed8a4))




## [5.1.0](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@5.0.1...nestjs-cls@5.1.0) "nestjs-cls" (2025-02-08)<a name="5.1.0"></a>

### Bug Fixes

* **core**: allow accessing constructor on strict proxy providers (#211) ([bf0f871](https://github.com/Papooch/nestjs-cls/commits/bf0f871))

### Features

* **core**: add saveCtx option in enhancer setup

This allows storing the ExecutionContext in the CLS (enabled by default) ([4dcda62](https://github.com/Papooch/nestjs-cls/commits/4dcda62))
* **core**: add `saveCtx` option in enhancer setup (#212) ([4dcda62](https://github.com/Papooch/nestjs-cls/commits/4dcda62))




## [5.0.1](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@5.0.0...nestjs-cls@5.0.1) "nestjs-cls" (2025-01-28)<a name="5.0.1"></a>

### Bug Fixes

* **core**: update fastify route pattern to support latest syntax (#206) ([dd87a33](https://github.com/Papooch/nestjs-cls/commits/dd87a33))




## [5.0.0](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@4.5.0...nestjs-cls@5.0.0) "nestjs-cls" (2025-01-21)<a name="5.0.0"></a>

### Breaking Changes

* The default mount point for express middleware has been changed from '*' to '/' ([4542aba](https://github.com/Papooch/nestjs-cls/commits/4542aba))

### Dependencies

* update all nestjs-related peer deps to latest (v11) ([915e797](https://github.com/Papooch/nestjs-cls/commits/915e797))

### Features

* **core**: support NestJS 11 ([4542aba](https://github.com/Papooch/nestjs-cls/commits/4542aba))




## [4.5.0](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@4.4.1...nestjs-cls@4.5.0) "nestjs-cls" (2024-12-07)<a name="4.5.0"></a>

### Features

* **core**: adds ClsModule.registerPlugins to inject Plugins from an external module (#192) ([11c40a0](https://github.com/Papooch/nestjs-cls/commits/11c40a0))




## [4.4.1](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@4.4.0...nestjs-cls@4.4.1) "nestjs-cls" (2024-08-06)<a name="4.4.1"></a>

### Bug Fixes

* **core**: support primitive values in websocket payload ([7f5c068](https://github.com/Papooch/nestjs-cls/commits/7f5c068))
* **core**: support primitive values in websocket payload (#172) ([7f5c068](https://github.com/Papooch/nestjs-cls/commits/7f5c068))




## [4.4.0](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@4.3.0...nestjs-cls@4.4.0) "nestjs-cls" (2024-07-26)<a name="4.4.0"></a>

### Features

* add `strict` option to proxy providers ([3f3de78](https://github.com/Papooch/nestjs-cls/commits/3f3de78))
* enable setting proxy provider `strict` option via a decorator. ([3f3de78](https://github.com/Papooch/nestjs-cls/commits/3f3de78))
* enable `strict` mode for Proxy Providers (#171) ([3f3de78](https://github.com/Papooch/nestjs-cls/commits/3f3de78))




## [4.3.0](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@4.2.1...nestjs-cls@4.3.0) "nestjs-cls" (2024-03-22)<a name="4.3.0"></a>

### Features

* add option to selectively resolve proxy providers ([26baa42](https://github.com/Papooch/nestjs-cls/commits/26baa42))
* selectively resolve proxy providers (#131) ([26baa42](https://github.com/Papooch/nestjs-cls/commits/26baa42))




## [4.2.1](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@4.2.0...nestjs-cls@4.2.1) "nestjs-cls" (2024-03-14)<a name="4.2.1"></a>

### Bug Fixes

* prevent context from leaking with ClsGuard (#129) ([7026fdf](https://github.com/Papooch/nestjs-cls/commits/7026fdf))




## [4.2.0](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@4.1.0...nestjs-cls@4.2.0) "nestjs-cls" (2024-02-21)<a name="4.2.0"></a>

### Bug Fixes

* make proxy providers compatible with #private fields ([367dfc7](https://github.com/Papooch/nestjs-cls/commits/367dfc7))

### Features

* add imperative API to get/set Proxy providers (#123) ([fbb27dc](https://github.com/Papooch/nestjs-cls/commits/fbb27dc))




## [4.1.0](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@4.0.4...nestjs-cls@4.1.0) "nestjs-cls" (2024-02-09)<a name="4.1.0"></a>

### Bug Fixes

* rework how plugins are registered (internals)

Previously all plugins' providers were mixed into one module,
now each plugin gets its own module. ([839df61](https://github.com/Papooch/nestjs-cls/commits/839df61))

### Features

* add multiple transactional adapters support

* Add tests for multiple named connections

* Add docs for multiple connections ([839df61](https://github.com/Papooch/nestjs-cls/commits/839df61))
* add support for multiple transactional adapters (#114) ([839df61](https://github.com/Papooch/nestjs-cls/commits/839df61))




## [4.0.4](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@4.0.3...nestjs-cls@4.0.4) "nestjs-cls" (2024-02-03)<a name="4.0.4"></a>

### Bug Fixes

* **core**: handle nested context correctly with UseCls decorator (#119) ([df90f30](https://github.com/Papooch/nestjs-cls/commits/df90f30))




## [4.0.3](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@4.0.2...nestjs-cls@4.0.3) "nestjs-cls" (2024-01-31)<a name="4.0.3"></a>

### Bug Fixes

* **proxy-provider-manager**: handle setting falsy value

Co-authored-by: Jerry Laloan <jerrylaloan@users.noreply.github.com> ([26737d8](https://github.com/Papooch/nestjs-cls/commits/26737d8))
* **core**: handle setting falsy value in proxy providers (#118) ([26737d8](https://github.com/Papooch/nestjs-cls/commits/26737d8))




## [4.0.2](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@4.0.1...nestjs-cls@4.0.2) "nestjs-cls" (2024-01-29)<a name="4.0.2"></a>

### Bug Fixes

* symbol key access and explicit constructor error (#113) ([0d4e97b](https://github.com/Papooch/nestjs-cls/commits/0d4e97b))




## [4.0.1](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@4.0.0...nestjs-cls@4.0.1) "nestjs-cls" (2024-01-22)<a name="4.0.1"></a>

### Bug Fixes

* update publish config ([da05ae7](https://github.com/Papooch/nestjs-cls/commits/da05ae7))




## [3.6.0](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@3.5.1...nestjs-cls@3.6.0) "nestjs-cls" (2023-10-18)<a name="3.6.0"></a>

### Features

* allow registering Proxy providers globally ([92d00f7](https://github.com/Papooch/nestjs-cls/commits/92d00f7))




## [3.5.1](https://github.com/Papooch/nestjs-cls/compare/nestjs-cls@3.5.0...nestjs-cls@3.5.1) "nestjs-cls" (2023-08-29)<a name="3.5.1"></a>

### Bug Fixes

* add rxjs and reflect-metadata as peer deps (#86) ([566f85a](https://github.com/Papooch/nestjs-cls/commits/566f85a))




## [3.5.0](https://github.com/Papooch/nestjs-cls/compare/v3.4.0...v3.5.0) "nestjs-cls" (2023-08-11)<a name="3.4.0"></a>

-   This is where we start the changelog with `monodeploy`. To view older changes, see Releases on GitHub or the commit history.
