import { ContextClsStoreMap } from '../../src/lib/cls-initializers/utils/context-cls-store-map';
import { ClsStore } from '../../src/lib/cls.options';

/**
 * This test suite validates Symbol+WeakMap hybrid strategy for robust
 * context identity tracking across object wrappers, proxies, and transformations.
 *
 * After Issue #9: Symbol tagging allows the store to work transparently through
 * Proxy wrappers and most transformations that previously failed with WeakMap-only.
 *
 * @see Issue #9 - Replace WeakMap-only tracking with hybrid Symbol+WeakMap strategy
 * @see docs/research/weakmap-identity-pitfalls.md
 */
describe('Symbol+WeakMap Hybrid Strategy Validation', () => {
    let originalObject: any;
    let store: ClsStore;

    beforeEach(() => {
        originalObject = { id: 'test-request', headers: {} };
        store = { user: 'test-user' } as any;
    });

    describe('Scenario 1: Proxy Objects', () => {
        it('should retrieve store when object is wrapped in Proxy', () => {
            // Store the original object
            ContextClsStoreMap.setByRaw(originalObject, store);

            // Create a Proxy wrapper (common in testing frameworks and middleware)
            const proxiedObject = new Proxy(originalObject, {
                get(target, prop) {
                    return target[prop];
                },
            });

            // Symbol tagging works transparently through Proxy wrappers
            const retrieved = ContextClsStoreMap.getByRaw(proxiedObject);

            // ✅ After Issue #9: Symbol allows retrieval through Proxy
            expect(retrieved).toBe(store);
        });

        it('should retrieve store with Proxy that intercepts property access', () => {
            const handler = {
                get(target: any, prop: string) {
                    // console.log(`Accessing ${prop}`);
                    return target[prop];
                },
            };

            const proxiedRequest = new Proxy(originalObject, handler);
            ContextClsStoreMap.setByRaw(proxiedRequest, store);

            // If middleware re-wraps the same object in a new Proxy
            const reProxied = new Proxy(originalObject, handler);

            const retrieved = ContextClsStoreMap.getByRaw(reProxied);
            // ✅ After Issue #9: Symbol is set on original target, accessible through any Proxy
            expect(retrieved).toBe(store);
        });
    });

    describe('Scenario 2: Object.create() Clones', () => {
        it('should retrieve store from Object.create() clone via prototype chain', () => {
            ContextClsStoreMap.setByRaw(originalObject, store);

            // Create a new object with original as prototype
            const clonedObject = Object.create(originalObject);
            clonedObject.id = 'test-request'; // Same properties

            const retrieved = ContextClsStoreMap.getByRaw(clonedObject);
            // ✅ Symbol is found via prototype chain (Object.create inherits)
            expect(retrieved).toBe(store);
        });

        it('should retrieve store with Object.assign() shallow copy (Symbol is copied!)', () => {
            ContextClsStoreMap.setByRaw(originalObject, store);

            // Shallow copy (common in middleware transformations)
            const copied = Object.assign({}, originalObject);

            const retrieved = ContextClsStoreMap.getByRaw(copied);
            // ✅ Object.assign() copies Symbol properties (better than expected!)
            // This is BETTER than the WeakMap-only approach
            expect(retrieved).toBe(store);
        });
    });

    describe('Scenario 3: Request Transformers', () => {
        it('should retrieve store when middleware transforms request with spread (Symbol copied!)', () => {
            const request = { url: '/test', method: 'GET' };
            ContextClsStoreMap.setByRaw(request, store);

            // Middleware adds properties by creating new object
            const transformedRequest = {
                ...request,
                user: { id: 123 },
                timestamp: Date.now(),
            };

            const retrieved = ContextClsStoreMap.getByRaw(transformedRequest);
            // ✅ Spread operator copies Symbol properties (better than expected!)
            // This handles a common middleware pattern seamlessly
            expect(retrieved).toBe(store);
        });

        it('should fail when request is destructured and reconstructed (new object)', () => {
            ContextClsStoreMap.setByRaw(originalObject, store);

            // Common pattern in middleware
            const { id, headers } = originalObject;
            const reconstructed = { id, headers };

            const retrieved = ContextClsStoreMap.getByRaw(reconstructed);
            // ⚠️ New object created, Symbol not transferred (acceptable limitation)
            expect(retrieved).toBeUndefined();
        });
    });

    describe('Scenario 4: Mocking Libraries', () => {
        it('should retrieve store with jest.mock() wrapped objects (Proxy)', () => {
            const mockRequest = {
                id: 'test',
                headers: {},
                get: jest.fn(),
            };

            ContextClsStoreMap.setByRaw(mockRequest, store);

            // Jest may wrap the mock in a Proxy internally
            // Simulating this behavior
            const wrappedMock = new Proxy(mockRequest, {
                get(target, prop) {
                    if (prop === 'get') {
                        return jest.fn();
                    }
                    return target[prop];
                },
            });

            const retrieved = ContextClsStoreMap.getByRaw(wrappedMock);
            // ✅ After Issue #9: Symbol works through Proxy wrapper
            expect(retrieved).toBe(store);
        });

        it('should work with spied objects (jest.spyOn)', () => {
            const request = {
                id: 'test',
                getHeader: () => 'value',
            };

            ContextClsStoreMap.setByRaw(request, store);

            // Spy may replace the method, creating subtle identity changes
            jest.spyOn(request, 'getHeader');

            // In this case, jest.spyOn doesn't replace the object itself
            const retrieved = ContextClsStoreMap.getByRaw(request);
            // ✅ This works because object identity is preserved
            expect(retrieved).toBe(store);
        });
    });

    describe('Scenario 5: Frozen/Sealed Objects', () => {
        it('should work with frozen objects via WeakMap fallback', () => {
            const frozenObject = Object.freeze({ id: 'frozen' });
            ContextClsStoreMap.setByRaw(frozenObject, store);

            const retrieved = ContextClsStoreMap.getByRaw(frozenObject);
            // ✅ WeakMap fallback handles frozen objects (cannot accept Symbol properties)
            expect(retrieved).toBe(store);
        });

        it('should work with sealed objects via WeakMap fallback', () => {
            const sealedObject = Object.seal({ id: 'sealed' });
            ContextClsStoreMap.setByRaw(sealedObject, store);

            const retrieved = ContextClsStoreMap.getByRaw(sealedObject);
            // ✅ WeakMap fallback handles sealed objects (cannot accept new Symbol properties)
            expect(retrieved).toBe(store);
        });

        it('should fail when frozen object is cloned (creates new object)', () => {
            const frozenObject = Object.freeze({ id: 'frozen' });
            ContextClsStoreMap.setByRaw(frozenObject, store);

            // Clone the frozen object
            const cloned = { ...frozenObject };

            const retrieved = ContextClsStoreMap.getByRaw(cloned);
            // ⚠️ Cloning creates new object without Symbol (acceptable limitation)
            expect(retrieved).toBeUndefined();
        });
    });

    describe('Scenario 6: Framework-specific Wrappers', () => {
        it('should fail with Express-style request wrapping (different object)', () => {
            const rawRequest = { url: '/test' };
            ContextClsStoreMap.setByRaw(rawRequest, store);

            // Express wraps raw request
            const expressRequest = {
                raw: rawRequest,
                app: {},
                route: {},
            };

            // If we try to access via wrapped object
            const retrieved = ContextClsStoreMap.getByRaw(expressRequest);
            // ⚠️ Different wrapper object without Symbol (acceptable limitation)
            // Solution: Use RequestIdentityResolver.getIdentity() from Issue #6
            // which resolves the canonical object reference before calling setByRaw/getByRaw
            expect(retrieved).toBeUndefined();
        });

        it('should fail with Fastify raw vs full request mismatch (different object)', () => {
            const rawRequest = { url: '/test' };
            ContextClsStoreMap.setByRaw(rawRequest, store);

            // Fastify full request has 'raw' property
            const fastifyRequest = {
                raw: rawRequest,
                params: {},
                query: {},
            };

            const retrieved = ContextClsStoreMap.getByRaw(fastifyRequest);
            // ⚠️ Different wrapper object (acceptable limitation)
            // Solution: RequestIdentityResolver.getIdentity() from Issue #6 handles this
            // by using canonical object reference (request.raw ?? request)
            expect(retrieved).toBeUndefined();
        });
    });

    describe('Scenario 7: Multiple Wrappers Chain', () => {
        it('should retrieve store through multiple layers of proxies', () => {
            ContextClsStoreMap.setByRaw(originalObject, store);

            // Middleware A wraps in proxy
            const layer1 = new Proxy(originalObject, {});

            // Middleware B wraps again
            const layer2 = new Proxy(layer1, {});

            const retrieved = ContextClsStoreMap.getByRaw(layer2);
            // ✅ After Issue #9: Symbol accessible through nested Proxy chains
            expect(retrieved).toBe(store);
        });
    });
});

/**
 * Demonstration of why Symbol tagging would solve these issues
 */
describe('Symbol Tagging Solution (Conceptual)', () => {
    const CLS_STORE_SYMBOL = Symbol.for('__CLS_STORE__');

    it('demonstrates how Symbol tagging would work with Proxies', () => {
        const originalObject = { id: 'test' };

        // With Symbol tagging
        (originalObject as any)[CLS_STORE_SYMBOL] = { user: 'test-user' };

        // Proxy still accesses the underlying object's properties
        const proxied = new Proxy(originalObject, {
            get(target, prop) {
                return target[prop];
            },
        });

        // Symbol is accessible through the proxy
        const retrieved = (proxied as any)[CLS_STORE_SYMBOL];
        expect(retrieved).toEqual({ user: 'test-user' }); // PASSES
    });

    it('demonstrates Symbol persistence through spread operator', () => {
        const originalObject = { id: 'test' };
        (originalObject as any)[CLS_STORE_SYMBOL] = { user: 'test-user' };

        // Spread operator copies enumerable properties only
        // Symbols are NOT enumerable, but Symbol.for() creates a global symbol
        // that can be accessed from the spread object if it references the same object
        const spread = { ...originalObject };

        // Note: The Symbol is accessible because Symbol.for() creates a global symbol
        // However, this demonstrates that for truly new objects, we'd need WeakMap fallback
        const retrieved = (spread as any)[CLS_STORE_SYMBOL];
        // The spread object has a reference to the original object's symbol
        expect(retrieved).toBeDefined();

        // Both the original and spread have access to the global symbol
        expect((originalObject as any)[CLS_STORE_SYMBOL]).toEqual({
            user: 'test-user',
        });
    });

    it('demonstrates WeakMap as fallback for frozen objects', () => {
        const weakMap = new WeakMap();
        const frozenObject = Object.freeze({ id: 'frozen' });

        // Cannot add Symbol to frozen object
        expect(() => {
            (frozenObject as any)[CLS_STORE_SYMBOL] = { user: 'test' };
        }).toThrow();

        // But WeakMap still works
        weakMap.set(frozenObject, { user: 'test-user' });
        expect(weakMap.get(frozenObject)).toEqual({ user: 'test-user' });
    });
});
