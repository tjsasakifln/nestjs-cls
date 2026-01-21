import { ContextClsStoreMap } from '../../src/lib/cls-initializers/utils/context-cls-store-map';
import { ClsStore } from '../../src/lib/cls.options';

/**
 * This test suite demonstrates WeakMap identity comparison failures
 * that can occur when objects are wrapped, cloned, or transformed.
 *
 * These tests are EXPECTED TO FAIL with the current WeakMap-only implementation.
 * They document the scenarios where Symbol+WeakMap hybrid approach is needed.
 */
describe('WeakMap Object Identity Failures (Expected Failures)', () => {
    let originalObject: any;
    let store: ClsStore;

    beforeEach(() => {
        originalObject = { id: 'test-request', headers: {} };
        store = { user: 'test-user' } as any;
    });

    describe('Scenario 1: Proxy Objects', () => {
        it('should fail to retrieve store when object is wrapped in Proxy', () => {
            // Store the original object
            ContextClsStoreMap.setByRaw(originalObject, store);

            // Create a Proxy wrapper (common in testing frameworks and middleware)
            const proxiedObject = new Proxy(originalObject, {
                get(target, prop) {
                    return target[prop];
                },
            });

            // WeakMap uses identity comparison, so it fails to recognize the Proxy
            const retrieved = ContextClsStoreMap.getByRaw(proxiedObject);

            // This assertion WILL FAIL - demonstrating the bug
            expect(retrieved).toBe(store);
        });

        it('should fail with Proxy that intercepts property access', () => {
            const handler = {
                get(target: any, prop: string) {
                    console.log(`Accessing ${prop}`);
                    return target[prop];
                },
            };

            const proxiedRequest = new Proxy(originalObject, handler);
            ContextClsStoreMap.setByRaw(proxiedRequest, store);

            // If middleware re-wraps the same object in a new Proxy
            const reProxied = new Proxy(originalObject, handler);

            const retrieved = ContextClsStoreMap.getByRaw(reProxied);
            expect(retrieved).toBe(store); // FAILS: Different Proxy instances
        });
    });

    describe('Scenario 2: Object.create() Clones', () => {
        it('should fail when object is cloned with Object.create()', () => {
            ContextClsStoreMap.setByRaw(originalObject, store);

            // Create a new object with original as prototype
            const clonedObject = Object.create(originalObject);
            clonedObject.id = 'test-request'; // Same properties

            const retrieved = ContextClsStoreMap.getByRaw(clonedObject);
            expect(retrieved).toBe(store); // FAILS: Different object identity
        });

        it('should fail with Object.assign() shallow copy', () => {
            ContextClsStoreMap.setByRaw(originalObject, store);

            // Shallow copy (common in middleware transformations)
            const copied = Object.assign({}, originalObject);

            const retrieved = ContextClsStoreMap.getByRaw(copied);
            expect(retrieved).toBe(store); // FAILS: Different object identity
        });
    });

    describe('Scenario 3: Request Transformers', () => {
        it('should fail when middleware transforms request object', () => {
            const request = { url: '/test', method: 'GET' };
            ContextClsStoreMap.setByRaw(request, store);

            // Middleware adds properties by creating new object
            const transformedRequest = {
                ...request,
                user: { id: 123 },
                timestamp: Date.now(),
            };

            const retrieved = ContextClsStoreMap.getByRaw(transformedRequest);
            expect(retrieved).toBe(store); // FAILS: Spread creates new object
        });

        it('should fail when request is destructured and reconstructed', () => {
            ContextClsStoreMap.setByRaw(originalObject, store);

            // Common pattern in middleware
            const { id, headers } = originalObject;
            const reconstructed = { id, headers };

            const retrieved = ContextClsStoreMap.getByRaw(reconstructed);
            expect(retrieved).toBe(store); // FAILS: New object created
        });
    });

    describe('Scenario 4: Mocking Libraries', () => {
        it('should fail with jest.mock() wrapped objects', () => {
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
            expect(retrieved).toBe(store); // FAILS: Mock proxy wrapper
        });

        it('should fail with spied objects (jest.spyOn)', () => {
            const request = {
                id: 'test',
                getHeader: () => 'value',
            };

            ContextClsStoreMap.setByRaw(request, store);

            // Spy may replace the method, creating subtle identity changes
            jest.spyOn(request, 'getHeader');

            // In some frameworks, spying may replace the object
            const retrieved = ContextClsStoreMap.getByRaw(request);
            expect(retrieved).toBe(store); // May fail depending on spy implementation
        });
    });

    describe('Scenario 5: Frozen/Sealed Objects', () => {
        it('should work with frozen objects (baseline test)', () => {
            const frozenObject = Object.freeze({ id: 'frozen' });
            ContextClsStoreMap.setByRaw(frozenObject, store);

            const retrieved = ContextClsStoreMap.getByRaw(frozenObject);
            expect(retrieved).toBe(store); // Should PASS - same object reference
        });

        it('should work with sealed objects (baseline test)', () => {
            const sealedObject = Object.seal({ id: 'sealed' });
            ContextClsStoreMap.setByRaw(sealedObject, store);

            const retrieved = ContextClsStoreMap.getByRaw(sealedObject);
            expect(retrieved).toBe(store); // Should PASS - same object reference
        });

        it('should fail when frozen object is cloned', () => {
            const frozenObject = Object.freeze({ id: 'frozen' });
            ContextClsStoreMap.setByRaw(frozenObject, store);

            // Clone the frozen object
            const cloned = { ...frozenObject };

            const retrieved = ContextClsStoreMap.getByRaw(cloned);
            expect(retrieved).toBe(store); // FAILS: Different object
        });
    });

    describe('Scenario 6: Framework-specific Wrappers', () => {
        it('should fail with Express-style request wrapping', () => {
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
            expect(retrieved).toBe(store); // FAILS: Different wrapper object
        });

        it('should demonstrate Fastify raw vs full request mismatch', () => {
            const rawRequest = { url: '/test' };
            ContextClsStoreMap.setByRaw(rawRequest, store);

            // Fastify full request has 'raw' property
            const fastifyRequest = {
                raw: rawRequest,
                params: {},
                query: {},
            };

            // Current workaround: request.raw ?? request
            // But this fails if you don't know about the 'raw' property
            const retrieved = ContextClsStoreMap.getByRaw(fastifyRequest);
            expect(retrieved).toBe(store); // FAILS without .raw workaround
        });
    });

    describe('Scenario 7: Multiple Wrappers Chain', () => {
        it('should fail with multiple layers of proxies', () => {
            ContextClsStoreMap.setByRaw(originalObject, store);

            // Middleware A wraps in proxy
            const layer1 = new Proxy(originalObject, {});

            // Middleware B wraps again
            const layer2 = new Proxy(layer1, {});

            const retrieved = ContextClsStoreMap.getByRaw(layer2);
            expect(retrieved).toBe(store); // FAILS: Multiple wrapper layers
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
        // Symbols are NOT enumerable by default
        const spread = { ...originalObject };

        // Symbol is NOT copied (this is why we need WeakMap as fallback)
        const retrieved = (spread as any)[CLS_STORE_SYMBOL];
        expect(retrieved).toBeUndefined(); // Symbol not copied

        // But the original still has it
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
