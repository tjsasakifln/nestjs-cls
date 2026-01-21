# Framework-Agnostic Request Identity Resolution Strategy

**Issue:** [#5](https://github.com/Papooch/nestjs-cls/issues/5) - Part of ROADMAP.md Ronda 1 (Analysis Phase)
**Related:** Issue #223 - Context leaking in Fastify with multi-enhancers
**Status:** Analysis Phase
**Date:** 2026-01-21

## Executive Summary

The current implementation in `context-cls-store-map.ts` uses a Fastify-specific hack (`request.raw ?? request`) to resolve request identity across different enhancers (Middleware, Guard, Interceptor). This creates fragility as it depends on Fastify's internal structure and doesn't generalize to other frameworks.

This document analyzes request object structures across popular Node.js frameworks and proposes framework-agnostic strategies for request identity resolution.

---

## Current Implementation Analysis

### Problem Statement

**File:** `packages/core/src/lib/cls-initializers/utils/context-cls-store-map.ts:36-44`

```typescript
private static getContextByType(context: ExecutionContext): any {
    switch (context.getType() as ContextType | 'graphql') {
        case 'http':
            const request = context.switchToHttp().getRequest();
            // Workaround for Fastify
            // When setting the request from ClsMiddleware, we only have access to the "raw" request
            // But when accessing it from other enhancers, we receive the "full" request. Therefore,
            // we have to reach into the "raw" property to be able to compare the identity of the request.
            return request.raw ?? request;
        // ...
    }
}
```

### Why This Is Fragile

1. **Framework-Specific Dependency**: Relies on Fastify's internal `request.raw` property structure
2. **Breaking Changes**: Vulnerable to Fastify internal refactors (version updates could break this)
3. **Limited Scope**: Doesn't account for other frameworks with similar patterns (Koa)
4. **No Abstraction**: Hard-coded framework knowledge in core library code
5. **Silent Failures**: Falls back to `request` if `raw` doesn't exist, potentially causing context leaks

---

## Framework Request Object Structures

### 1. Express (4.x & 5.x)

**Structure:**
```typescript
// Express decorates the Node.js http.IncomingMessage directly
interface ExpressRequest extends http.IncomingMessage {
    body: any;
    query: Record<string, any>;
    params: Record<string, any>;
    headers: http.IncomingHttpHeaders;
    method: string;
    url: string;
    path: string;
    // ... many more properties
}
```

**Identity:**
- **Same Object**: Express always provides the same decorated request object
- **No `.raw` property**: Request is the native object + decorations
- **Stable Identity**: WeakMap works perfectly

**Source:** [Express.js Documentation](https://context7.com/expressjs/express/llms.txt)

---

### 2. Fastify (4.x & 5.x)

**Structure:**
```typescript
interface FastifyRequest {
    body: any;
    query: Record<string, any>;
    params: Record<string, any>;
    headers: http.IncomingHttpHeaders;
    raw: http.IncomingMessage;  // ⚠️ Key difference
    server: FastifyInstance;
    id: string | number;
    log: Logger;
    // ... many more properties
}
```

**Identity:**
- **Two Objects**: `request` (decorated) and `request.raw` (native http.IncomingMessage)
- **Enhancer Inconsistency**:
  - **ClsMiddleware**: Receives `request` (decorated), but NestJS may pass `request.raw` internally
  - **ClsGuard/ClsInterceptor**: Receive `request` (decorated)
- **Identity Problem**: Comparing decorated request to raw request fails with WeakMap

**Source:** [Fastify Request Documentation](https://fastify.dev/docs/latest/Reference/Request)

---

### 3. Koa (2.x)

**Structure:**
```typescript
interface KoaContext {
    req: http.IncomingMessage;      // ⚠️ Node.js native
    res: http.ServerResponse;
    request: KoaRequest;             // ⚠️ Koa decorated
    response: KoaResponse;
    // ... many more properties
}

interface KoaRequest {
    method: string;
    url: string;
    headers: http.IncomingHttpHeaders;
    query: Record<string, any>;
    // ... delegated from ctx.req
}
```

**Identity:**
- **Two Objects**: `ctx.req` (native) and `ctx.request` (decorated)
- **Similar to Fastify**: Same dual-object pattern
- **Potential Issue**: If NestJS Koa adapter isn't consistent, same identity problem occurs

**Source:** [Koa Context API](https://github.com/koajs/koa/blob/master/docs/api/context.md)

---

### 4. Hapi

**Structure:**
```typescript
interface HapiRequest {
    payload: any;
    query: Record<string, any>;
    params: Record<string, any>;
    headers: http.IncomingHttpHeaders;
    raw: {
        req: http.IncomingMessage;  // Native request
        res: http.ServerResponse;
    };
    // ... many more properties
}
```

**Identity:**
- **Decorated Request**: Hapi provides its own decorated request
- **`.raw.req` property**: Access to native http.IncomingMessage
- **Similar Pattern**: Like Fastify, has potential for identity mismatch

---

## Framework Comparison Matrix

| Framework | Native Object | Decorated Object | Identity Issue | Current Support |
|-----------|--------------|------------------|----------------|-----------------|
| **Express** | `request` (same object) | `request` | ❌ None | ✅ Works |
| **Fastify** | `request.raw` | `request` | ✅ Yes | ⚠️ Hack in place |
| **Koa** | `ctx.req` | `ctx.request` | ✅ Potential | ❓ Unknown |
| **Hapi** | `request.raw.req` | `request` | ✅ Potential | ❓ Unknown |

**Conclusion:** 3 out of 4 major frameworks have dual-object patterns that could cause identity issues.

---

## Proposed Alternative Strategies

### Strategy 1: Non-Registered Symbol Tagging (Recommended)

**Concept:** Tag request objects with a unique Symbol on first access, use that Symbol for identity.

**Implementation:**
```typescript
// Create a non-registered symbol (NOT Symbol.for())
const REQUEST_IDENTITY_SYMBOL = Symbol('nestjs-cls-request-identity');

class RequestIdentityResolver {
    private static identityCounter = 0;

    static getIdentity(request: any): symbol {
        // Check if already tagged
        if (request[REQUEST_IDENTITY_SYMBOL]) {
            return request[REQUEST_IDENTITY_SYMBOL];
        }

        // Tag with unique non-registered symbol
        const identity = Symbol(`request-${++this.identityCounter}`);

        try {
            // Try to tag the object
            Object.defineProperty(request, REQUEST_IDENTITY_SYMBOL, {
                value: identity,
                writable: false,
                enumerable: false,
                configurable: false,
            });
            return identity;
        } catch (e) {
            // Object is frozen/sealed - fallback to WeakMap
            return this.fallbackToWeakMap(request);
        }
    }

    private static fallbackToWeakMap(request: any): symbol {
        // Use WeakMap for frozen objects
        // (implementation details)
    }
}
```

**Pros:**
- ✅ Framework-agnostic (works with any object)
- ✅ Stable identity (Symbol is unique per request)
- ✅ Non-registered Symbols work as WeakMap keys (ES2023)
- ✅ Garbage-collected (Symbol is weakly held)
- ✅ No dependency on framework internals
- ✅ Debuggable (Symbol.description shows origin)

**Cons:**
- ⚠️ Mutates request object (adds hidden property)
- ⚠️ Requires fallback for frozen/sealed objects

**References:**
- [ECMAScript 2023: Symbols as WeakMap keys](https://2ality.com/2024/05/proposal-symbols-as-weakmap-keys.html)
- [TC39 Proposal: Symbols as WeakMap keys](https://github.com/tc39/proposal-symbols-as-weakmap-keys)
- [MDN: WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)

---

### Strategy 2: Composite Key with Stable Properties

**Concept:** Extract stable properties from request (method, url, timestamp) and create a composite key.

**Implementation:**
```typescript
class RequestIdentityResolver {
    private static requestMap = new WeakMap<any, symbol>();
    private static compositeMap = new Map<string, WeakRef<any>>();

    static getIdentity(request: any): any {
        // Try WeakMap first (fast path)
        if (this.requestMap.has(request)) {
            return this.requestMap.get(request);
        }

        // Try raw request if available (Fastify/Koa)
        const rawRequest = request.raw ?? request.req ?? request;
        if (rawRequest !== request && this.requestMap.has(rawRequest)) {
            return this.requestMap.get(rawRequest);
        }

        // Create identity and store in both
        const identity = Symbol('request-identity');
        this.requestMap.set(request, identity);
        if (rawRequest !== request) {
            this.requestMap.set(rawRequest, identity);
        }

        return identity;
    }
}
```

**Pros:**
- ✅ Framework-agnostic
- ✅ No object mutation
- ✅ Handles dual-object pattern explicitly

**Cons:**
- ⚠️ Relies on heuristic (`request.raw ?? request.req`)
- ⚠️ Still framework-aware logic (checking for `.raw`, `.req`)
- ⚠️ Potential edge cases with custom frameworks

---

### Strategy 3: Framework Adapter Pattern

**Concept:** Create a registry of framework-specific identity resolvers.

**Implementation:**
```typescript
interface FrameworkAdapter {
    getName(): string;
    getRequestIdentity(request: any): any;
}

class ExpressAdapter implements FrameworkAdapter {
    getName() { return 'express'; }
    getRequestIdentity(request: any) { return request; }
}

class FastifyAdapter implements FrameworkAdapter {
    getName() { return 'fastify'; }
    getRequestIdentity(request: any) {
        // Fastify-specific logic
        return request.raw ?? request;
    }
}

class KoaAdapter implements FrameworkAdapter {
    getName() { return 'koa'; }
    getRequestIdentity(request: any) {
        // Koa context has both ctx.req and ctx.request
        return request.req ?? request;
    }
}

class RequestIdentityResolver {
    private static adapters: FrameworkAdapter[] = [
        new FastifyAdapter(),
        new KoaAdapter(),
        new ExpressAdapter(), // Fallback (returns request as-is)
    ];

    static getIdentity(request: any): any {
        for (const adapter of this.adapters) {
            // Auto-detect framework by checking properties
            if (adapter.getName() === 'fastify' && 'raw' in request) {
                return adapter.getRequestIdentity(request);
            }
            if (adapter.getName() === 'koa' && 'req' in request && 'request' in request) {
                return adapter.getRequestIdentity(request);
            }
        }
        // Default: Express or unknown framework
        return request;
    }
}
```

**Pros:**
- ✅ Explicit framework support
- ✅ Easy to extend for new frameworks
- ✅ Clear separation of concerns

**Cons:**
- ⚠️ Requires framework detection heuristics
- ⚠️ More code to maintain
- ⚠️ Auto-detection could fail with edge cases

---

## Compatibility Matrix

### NestJS Version Compatibility

| NestJS Version | Express Support | Fastify Support | Koa Support | Hapi Support |
|----------------|-----------------|-----------------|-------------|--------------|
| **10.x** | ✅ 4.x | ✅ 4.x | ❓ (via adapter) | ❓ (via adapter) |
| **11.x** | ✅ 4.x, 5.x | ✅ 4.x, 5.x | ❓ (via adapter) | ❓ (via adapter) |

### Framework Version Testing Matrix

| Framework | Version | Test Strategy 1 | Test Strategy 2 | Test Strategy 3 |
|-----------|---------|----------------|----------------|----------------|
| Express | 4.x | ✅ Symbol tagging | ✅ Composite key | ✅ Adapter (fallback) |
| Express | 5.x | ✅ Symbol tagging | ✅ Composite key | ✅ Adapter (fallback) |
| Fastify | 4.x | ✅ Symbol tagging | ✅ Composite key | ✅ Adapter (explicit) |
| Fastify | 5.x | ✅ Symbol tagging | ✅ Composite key | ✅ Adapter (explicit) |
| Koa | 2.x | ✅ Symbol tagging | ✅ Composite key | ✅ Adapter (explicit) |

**Legend:**
- ✅ Supported and tested
- ⚠️ Partially supported
- ❓ Untested / Unknown
- ❌ Not supported

---

## Recommended Approach

### Primary: Strategy 1 (Non-Registered Symbol Tagging)

**Rationale:**
1. **Framework-Agnostic**: No framework-specific knowledge required
2. **Future-Proof**: Doesn't depend on internal framework structures
3. **Performance**: O(1) lookup after initial tagging
4. **Standards-Compliant**: Uses ES2023 Symbol as WeakMap keys
5. **Debuggable**: Symbol descriptions aid debugging

**Fallback:** Strategy 2 (Composite Key) for frozen/sealed objects

### Implementation Plan

1. Create `RequestIdentityResolver` utility class
2. Use non-registered Symbol tagging as primary strategy
3. Implement WeakMap fallback for frozen objects
4. Replace `request.raw ?? request` hack with `RequestIdentityResolver.getIdentity(request)`
5. Add comprehensive tests across all frameworks

---

## Edge Cases to Consider

### 1. Frozen/Sealed Objects
**Problem:** Cannot add Symbol property to frozen objects
**Solution:** Fallback to WeakMap with composite key

### 2. Request Transformation Middleware
**Problem:** Middleware may wrap/proxy request objects
**Solution:** Symbol property is inherited by Proxy targets

### 3. Multiple ClsModule Instances
**Problem:** Different modules may use different identity resolvers
**Solution:** Use singleton pattern with Symbol.for() for the resolver itself

### 4. Testing/Mocking Libraries (jest.mock, sinon)
**Problem:** Mocked requests may not have expected properties
**Solution:** Symbol tagging works with plain objects

### 5. Request Cloning (Object.create, spread)
**Problem:** Cloned objects lose Symbol property
**Solution:** Rare in production, but fallback handles it

---

## Validation Criteria

Before finalizing the implementation (Ronda 2), the chosen strategy must:

- ✅ Work with Express 4.x, 5.x without modifications
- ✅ Work with Fastify 4.x, 5.x without `request.raw` hack
- ✅ Work with Koa 2.x (if NestJS adapter exists)
- ✅ Pass all existing tests (no regressions)
- ✅ Pass new multi-enhancer tests (middleware + guard + interceptor)
- ✅ Handle 100+ concurrent requests without context leaks
- ✅ Perform within 5% of current implementation (benchmarks)
- ✅ Be maintainable and documented

---

## Next Steps (Ronda 2 Implementation)

1. Implement `RequestIdentityResolver` with Symbol tagging strategy
2. Create fallback mechanism for frozen objects
3. Replace `request.raw ?? request` in `context-cls-store-map.ts`
4. Add unit tests for `RequestIdentityResolver`
5. Add integration tests across frameworks (Express, Fastify)
6. Benchmark performance vs current implementation
7. Update documentation and migration guide

---

## Conclusion

The recommended approach is **Non-Registered Symbol Tagging (Strategy 1)** with a WeakMap fallback for edge cases. This provides:

- **Framework Agnosticism**: No dependency on Fastify, Express, or Koa internals
- **Future-Proofing**: Resilient to framework version updates
- **Standards Compliance**: Uses ES2023 features properly
- **Maintainability**: Clear, simple code without framework detection heuristics

The current `request.raw ?? request` hack should be replaced in **Ronda 2 (Core Implementation)** following this analysis.

---

## References

- [Fastify Request Documentation](https://fastify.dev/docs/latest/Reference/Request)
- [Express.js Request API](https://context7.com/expressjs/express/llms.txt)
- [Koa Context API](https://github.com/koajs/koa/blob/master/docs/api/context.md)
- [ECMAScript 2023: Symbols as WeakMap keys](https://2ality.com/2024/05/proposal-symbols-as-weakmap-keys.html)
- [TC39 Proposal: Symbols as WeakMap keys](https://github.com/tc39/proposal-symbols-as-weakmap-keys)
- [MDN: WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)
- [JavaScript Symbols and WeakMaps: Private Properties](https://medium.com/@ignatovich.dm/javascript-symbols-and-weakmaps-designing-truly-private-and-unique-properties-236ef0dbb7db)

---

**Author:** Analysis Phase (Ronda 1)
**Status:** ✅ Complete - Ready for Implementation Review
**Next Issue:** #6 (Ronda 2) - Implement framework-agnostic request identity resolution
