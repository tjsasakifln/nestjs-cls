import { ContextClsStoreMap } from '../../src/lib/cls-initializers/utils/context-cls-store-map';
import { ClsStore } from '../../src/lib/cls.options';

/**
 * Comprehensive test suite for frozen/sealed object edge cases with context tracking.
 *
 * This test suite validates that the Symbol+WeakMap hybrid strategy (Issue #9)
 * correctly handles frozen, sealed, and non-extensible objects where Symbol tagging
 * is impossible and WeakMap fallback is required.
 *
 * **Issue #129 Regression Tests:** ClsGuard with frozen request objects
 * **Symbol Tagging Limitation:** Cannot add Symbol properties to frozen/sealed objects
 * **WeakMap Fallback:** Must gracefully degrade to WeakMap for non-extensible objects
 *
 * Test Structure:
 * - Section 1: Frozen objects (35 tests)
 * - Section 2: Sealed objects (35 tests)
 * - Section 3: Non-extensible objects (15 tests)
 * - Section 4: Mixed scenarios (15 tests)
 *
 * Total: 100 tests
 *
 * @see Issue #36 - Frozen/sealed objects for context tracking (100 tests)
 * @see Issue #129 - Context Leaking (ClsGuard)
 * @see Issue #9 - Symbol+WeakMap hybrid strategy
 * @see docs/research/weakmap-identity-pitfalls.md
 */
describe('Frozen/Sealed Context Tracking - Edge Cases (Issue #36)', () => {
    let originalObject: any;
    let store: ClsStore;

    beforeEach(() => {
        originalObject = { id: 'test-request', url: '/test', method: 'GET' };
        store = { requestId: 'req-123', user: 'test-user' } as any;
    });

    // Note: ContextClsStoreMap uses a singleton WeakMap, which is fine for these tests
    // since WeakMap automatically handles garbage collection

    /**
     * SECTION 1: Frozen Objects (35 tests)
     *
     * Validates WeakMap fallback when Object.freeze() prevents Symbol tagging.
     * Frozen objects are completely immutable - no properties can be added, removed, or modified.
     */
    describe('Section 1: Frozen Objects (35 tests)', () => {
        describe('1.1 Basic Frozen Objects (10 tests)', () => {
            it('1.1.1: Should track context with Object.freeze()', () => {
                const frozen = Object.freeze({ ...originalObject });
                ContextClsStoreMap.setByRaw(frozen, store);

                const retrieved = ContextClsStoreMap.getByRaw(frozen);
                expect(retrieved).toBe(store);
            });

            it('1.1.2: Should track context when frozen after store set', () => {
                ContextClsStoreMap.setByRaw(originalObject, store);
                const frozen = Object.freeze(originalObject);

                const retrieved = ContextClsStoreMap.getByRaw(frozen);
                expect(retrieved).toBe(store);
            });

            it('1.1.3: Should track context when store set on frozen object', () => {
                const frozen = Object.freeze({ ...originalObject });
                ContextClsStoreMap.setByRaw(frozen, store);

                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store);
            });

            it('1.1.4: Should maintain context across multiple frozen objects', () => {
                const frozen1 = Object.freeze({ id: 'req1' });
                const frozen2 = Object.freeze({ id: 'req2' });

                const store1 = { requestId: 'store1' } as any;
                const store2 = { requestId: 'store2' } as any;

                ContextClsStoreMap.setByRaw(frozen1, store1);
                ContextClsStoreMap.setByRaw(frozen2, store2);

                expect(ContextClsStoreMap.getByRaw(frozen1)).toBe(store1);
                expect(ContextClsStoreMap.getByRaw(frozen2)).toBe(store2);
            });

            it('1.1.5: Should prevent false positives with different frozen objects', () => {
                const frozen1 = Object.freeze({ id: 'req1' });
                const frozen2 = Object.freeze({ id: 'req1' }); // Same content

                ContextClsStoreMap.setByRaw(frozen1, store);

                // Different object despite same content
                expect(ContextClsStoreMap.getByRaw(frozen2)).toBeUndefined();
            });

            it('1.1.6: Should work with deeply frozen objects', () => {
                const nested = { user: { name: 'test', roles: ['admin'] } };
                const frozen = Object.freeze(nested);
                Object.freeze(nested.user);
                Object.freeze(nested.user.roles);

                ContextClsStoreMap.setByRaw(frozen, store);
                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store);
            });

            it('1.1.7: Should handle frozen empty object', () => {
                const frozen = Object.freeze({});
                ContextClsStoreMap.setByRaw(frozen, store);

                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store);
            });

            it('1.1.8: Should handle frozen object with null prototype', () => {
                const obj = Object.create(null);
                obj.id = 'test';
                const frozen = Object.freeze(obj);

                ContextClsStoreMap.setByRaw(frozen, store);
                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store);
            });

            it('1.1.9: Should work with frozen array-like object', () => {
                const arrayLike = Object.freeze({ 0: 'a', 1: 'b', length: 2 });
                ContextClsStoreMap.setByRaw(arrayLike, store);

                expect(ContextClsStoreMap.getByRaw(arrayLike)).toBe(store);
            });

            it('1.1.10: Should handle frozen object with getters', () => {
                const obj = Object.freeze({
                    _value: 42,
                    get value() {
                        return this._value;
                    },
                });

                ContextClsStoreMap.setByRaw(obj, store);
                expect(ContextClsStoreMap.getByRaw(obj)).toBe(store);
            });
        });

        describe('1.2 Frozen Objects Across Enhancers (10 tests)', () => {
            it('1.2.1: Should maintain context from ClsMiddleware to ClsGuard (frozen)', () => {
                const frozenRequest = Object.freeze({ ...originalObject });
                ContextClsStoreMap.setByRaw(frozenRequest, store);

                // Simulate ClsGuard accessing same frozen object
                const retrievedInGuard =
                    ContextClsStoreMap.getByRaw(frozenRequest);
                expect(retrievedInGuard).toBe(store);
            });

            it('1.2.2: Should maintain context from ClsMiddleware to ClsInterceptor (frozen)', () => {
                const frozenRequest = Object.freeze({ ...originalObject });
                ContextClsStoreMap.setByRaw(frozenRequest, store);

                // Simulate ClsInterceptor accessing same frozen object
                const retrievedInInterceptor =
                    ContextClsStoreMap.getByRaw(frozenRequest);
                expect(retrievedInInterceptor).toBe(store);
            });

            it('1.2.3: Should track context through middleware → guard → interceptor (frozen)', () => {
                const frozenRequest = Object.freeze({ ...originalObject });

                // Middleware sets store
                ContextClsStoreMap.setByRaw(frozenRequest, store);

                // Guard retrieves
                expect(ContextClsStoreMap.getByRaw(frozenRequest)).toBe(store);

                // Interceptor retrieves
                expect(ContextClsStoreMap.getByRaw(frozenRequest)).toBe(store);
            });

            it('1.2.4: Should handle frozen request with multiple enhancer passes', () => {
                const frozenRequest = Object.freeze({ ...originalObject });
                ContextClsStoreMap.setByRaw(frozenRequest, store);

                // Simulate multiple enhancer passes
                for (let i = 0; i < 5; i++) {
                    expect(ContextClsStoreMap.getByRaw(frozenRequest)).toBe(
                        store,
                    );
                }
            });

            it('1.2.5: Should work with frozen request in async enhancers', async () => {
                const frozenRequest = Object.freeze({ ...originalObject });
                ContextClsStoreMap.setByRaw(frozenRequest, store);

                // Simulate async enhancer
                await new Promise((resolve) => setTimeout(resolve, 10));
                expect(ContextClsStoreMap.getByRaw(frozenRequest)).toBe(store);
            });

            it('1.2.6: Should handle concurrent frozen requests', () => {
                const frozen1 = Object.freeze({ id: 'req1' });
                const frozen2 = Object.freeze({ id: 'req2' });
                const frozen3 = Object.freeze({ id: 'req3' });

                const store1 = { requestId: 'store1' } as any;
                const store2 = { requestId: 'store2' } as any;
                const store3 = { requestId: 'store3' } as any;

                ContextClsStoreMap.setByRaw(frozen1, store1);
                ContextClsStoreMap.setByRaw(frozen2, store2);
                ContextClsStoreMap.setByRaw(frozen3, store3);

                expect(ContextClsStoreMap.getByRaw(frozen1)).toBe(store1);
                expect(ContextClsStoreMap.getByRaw(frozen2)).toBe(store2);
                expect(ContextClsStoreMap.getByRaw(frozen3)).toBe(store3);
            });

            it('1.2.7: Should track context after error in enhancer (frozen)', () => {
                const frozenRequest = Object.freeze({ ...originalObject });
                ContextClsStoreMap.setByRaw(frozenRequest, store);

                // Simulate error in enhancer
                try {
                    throw new Error('Enhancer error');
                } catch (_err) {
                    // Context should still be retrievable
                }

                expect(ContextClsStoreMap.getByRaw(frozenRequest)).toBe(store);
            });

            it('1.2.8: Should handle frozen request in exception filters', () => {
                const frozenRequest = Object.freeze({ ...originalObject });
                ContextClsStoreMap.setByRaw(frozenRequest, store);

                // Simulate exception filter accessing context
                const retrievedInFilter =
                    ContextClsStoreMap.getByRaw(frozenRequest);
                expect(retrievedInFilter).toBe(store);
            });

            it('1.2.9: Should work with frozen request in pipes', () => {
                const frozenRequest = Object.freeze({ ...originalObject });
                ContextClsStoreMap.setByRaw(frozenRequest, store);

                // Simulate pipe transformation
                const retrievedInPipe =
                    ContextClsStoreMap.getByRaw(frozenRequest);
                expect(retrievedInPipe).toBe(store);
            });

            it('1.2.10: Should maintain context from controller to service (frozen)', () => {
                const frozenRequest = Object.freeze({ ...originalObject });
                ContextClsStoreMap.setByRaw(frozenRequest, store);

                // Simulate service layer accessing context
                const retrievedInService =
                    ContextClsStoreMap.getByRaw(frozenRequest);
                expect(retrievedInService).toBe(store);
            });
        });

        describe('1.3 Frozen Objects with Partial Properties (10 tests)', () => {
            it('1.3.1: Should track frozen object with subset of properties', () => {
                const partial = Object.freeze({ id: originalObject.id });
                ContextClsStoreMap.setByRaw(partial, store);

                expect(ContextClsStoreMap.getByRaw(partial)).toBe(store);
            });

            it('1.3.2: Should handle frozen object created from destructuring', () => {
                const { id, url } = originalObject;
                const frozen = Object.freeze({ id, url });

                ContextClsStoreMap.setByRaw(frozen, store);
                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store);
            });

            it('1.3.3: Should work with frozen object missing optional properties', () => {
                const minimal = Object.freeze({ id: 'req-minimal' });
                ContextClsStoreMap.setByRaw(minimal, store);

                expect(ContextClsStoreMap.getByRaw(minimal)).toBe(store);
            });

            it('1.3.4: Should track frozen object with renamed properties', () => {
                const renamed = Object.freeze({
                    requestId: originalObject.id,
                    path: originalObject.url,
                });

                ContextClsStoreMap.setByRaw(renamed, store);
                expect(ContextClsStoreMap.getByRaw(renamed)).toBe(store);
            });

            it('1.3.5: Should handle frozen object with computed properties', () => {
                const computed = Object.freeze({
                    id: originalObject.id,
                    fullUrl: `${originalObject.method} ${originalObject.url}`,
                });

                ContextClsStoreMap.setByRaw(computed, store);
                expect(ContextClsStoreMap.getByRaw(computed)).toBe(store);
            });

            it('1.3.6: Should work with frozen object from spread operator', () => {
                const spread = Object.freeze({ ...originalObject });
                ContextClsStoreMap.setByRaw(spread, store);

                expect(ContextClsStoreMap.getByRaw(spread)).toBe(store);
            });

            it('1.3.7: Should track frozen object with added metadata', () => {
                const withMetadata = Object.freeze({
                    ...originalObject,
                    timestamp: Date.now(),
                    version: '1.0',
                });

                ContextClsStoreMap.setByRaw(withMetadata, store);
                expect(ContextClsStoreMap.getByRaw(withMetadata)).toBe(store);
            });

            it('1.3.8: Should handle frozen object created via Object.assign', () => {
                const assigned = Object.freeze(
                    Object.assign({}, originalObject),
                );
                ContextClsStoreMap.setByRaw(assigned, store);

                expect(ContextClsStoreMap.getByRaw(assigned)).toBe(store);
            });

            it('1.3.9: Should work with frozen object from _.pick (lodash-style)', () => {
                const picked = Object.freeze({
                    id: originalObject.id,
                    method: originalObject.method,
                });

                ContextClsStoreMap.setByRaw(picked, store);
                expect(ContextClsStoreMap.getByRaw(picked)).toBe(store);
            });

            it('1.3.10: Should track frozen object with filtered properties', () => {
                const filtered = Object.freeze(
                    Object.fromEntries(
                        Object.entries(originalObject).filter(
                            ([key]) => key !== 'url',
                        ),
                    ),
                );

                ContextClsStoreMap.setByRaw(filtered, store);
                expect(ContextClsStoreMap.getByRaw(filtered)).toBe(store);
            });
        });

        describe('1.4 Edge Cases with Frozen Objects (5 tests)', () => {
            it('1.4.1: Should handle frozen object that was previously mutable', () => {
                ContextClsStoreMap.setByRaw(originalObject, store);
                const frozen = Object.freeze(originalObject);

                // Should retrieve via frozen reference
                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store);
            });

            it('1.4.2: Should work with frozen object containing circular references', () => {
                const circular: any = { id: 'test' };
                circular.self = circular;
                const frozen = Object.freeze(circular);

                ContextClsStoreMap.setByRaw(frozen, store);
                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store);
            });

            it('1.4.3: Should handle frozen object with Symbol properties', () => {
                const sym = Symbol('test');
                const obj = { id: 'test', [sym]: 'value' };
                const frozen = Object.freeze(obj);

                ContextClsStoreMap.setByRaw(frozen, store);
                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store);
            });

            it('1.4.4: Should work with frozen object in WeakMap', () => {
                const frozen = Object.freeze({ ...originalObject });
                const weakMap = new WeakMap();
                weakMap.set(frozen, store);

                ContextClsStoreMap.setByRaw(frozen, store);
                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store);
                expect(weakMap.get(frozen)).toBe(store);
            });

            it('1.4.5: Should handle frozen object with non-enumerable properties', () => {
                const obj = { id: 'test' };
                Object.defineProperty(obj, 'hidden', {
                    value: 'secret',
                    enumerable: false,
                });
                const frozen = Object.freeze(obj);

                ContextClsStoreMap.setByRaw(frozen, store);
                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store);
            });
        });
    });

    /**
     * SECTION 2: Sealed Objects (35 tests)
     *
     * Validates WeakMap fallback when Object.seal() prevents new properties.
     * Sealed objects allow property modification but not addition/deletion.
     */
    describe('Section 2: Sealed Objects (35 tests)', () => {
        describe('2.1 Basic Sealed Objects (10 tests)', () => {
            it('2.1.1: Should track context with Object.seal()', () => {
                const sealed = Object.seal({ ...originalObject });
                ContextClsStoreMap.setByRaw(sealed, store);

                const retrieved = ContextClsStoreMap.getByRaw(sealed);
                expect(retrieved).toBe(store);
            });

            it('2.1.2: Should track context when sealed after store set', () => {
                ContextClsStoreMap.setByRaw(originalObject, store);
                const sealed = Object.seal(originalObject);

                const retrieved = ContextClsStoreMap.getByRaw(sealed);
                expect(retrieved).toBe(store);
            });

            it('2.1.3: Should track context when store set on sealed object', () => {
                const sealed = Object.seal({ ...originalObject });
                ContextClsStoreMap.setByRaw(sealed, store);

                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('2.1.4: Should maintain context across multiple sealed objects', () => {
                const sealed1 = Object.seal({ id: 'req1' });
                const sealed2 = Object.seal({ id: 'req2' });

                const store1 = { requestId: 'store1' } as any;
                const store2 = { requestId: 'store2' } as any;

                ContextClsStoreMap.setByRaw(sealed1, store1);
                ContextClsStoreMap.setByRaw(sealed2, store2);

                expect(ContextClsStoreMap.getByRaw(sealed1)).toBe(store1);
                expect(ContextClsStoreMap.getByRaw(sealed2)).toBe(store2);
            });

            it('2.1.5: Should prevent false positives with different sealed objects', () => {
                const sealed1 = Object.seal({ id: 'req1' });
                const sealed2 = Object.seal({ id: 'req1' }); // Same content

                ContextClsStoreMap.setByRaw(sealed1, store);

                // Different object despite same content
                expect(ContextClsStoreMap.getByRaw(sealed2)).toBeUndefined();
            });

            it('2.1.6: Should allow property modification on sealed object', () => {
                const sealed = Object.seal({ id: 'initial', value: 1 });
                ContextClsStoreMap.setByRaw(sealed, store);

                // Modify property (allowed on sealed)
                sealed.value = 2;

                // Context should still be retrievable
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
                expect(sealed.value).toBe(2);
            });

            it('2.1.7: Should handle sealed empty object', () => {
                const sealed = Object.seal({});
                ContextClsStoreMap.setByRaw(sealed, store);

                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('2.1.8: Should handle sealed object with null prototype', () => {
                const obj = Object.create(null);
                obj.id = 'test';
                const sealed = Object.seal(obj);

                ContextClsStoreMap.setByRaw(sealed, store);
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('2.1.9: Should work with sealed array-like object', () => {
                const arrayLike = Object.seal({ 0: 'a', 1: 'b', length: 2 });
                ContextClsStoreMap.setByRaw(arrayLike, store);

                expect(ContextClsStoreMap.getByRaw(arrayLike)).toBe(store);
            });

            it('2.1.10: Should handle sealed object with getters/setters', () => {
                const obj = {
                    _value: 42,
                    get value() {
                        return this._value;
                    },
                    set value(v) {
                        this._value = v;
                    },
                };
                const sealed = Object.seal(obj);

                ContextClsStoreMap.setByRaw(sealed, store);
                sealed.value = 100; // Should work
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });
        });

        describe('2.2 Sealed Objects Across Enhancers (10 tests)', () => {
            it('2.2.1: Should maintain context from ClsMiddleware to ClsGuard (sealed)', () => {
                const sealedRequest = Object.seal({ ...originalObject });
                ContextClsStoreMap.setByRaw(sealedRequest, store);

                const retrievedInGuard =
                    ContextClsStoreMap.getByRaw(sealedRequest);
                expect(retrievedInGuard).toBe(store);
            });

            it('2.2.2: Should maintain context from ClsMiddleware to ClsInterceptor (sealed)', () => {
                const sealedRequest = Object.seal({ ...originalObject });
                ContextClsStoreMap.setByRaw(sealedRequest, store);

                const retrievedInInterceptor =
                    ContextClsStoreMap.getByRaw(sealedRequest);
                expect(retrievedInInterceptor).toBe(store);
            });

            it('2.2.3: Should track context through middleware → guard → interceptor (sealed)', () => {
                const sealedRequest = Object.seal({ ...originalObject });

                ContextClsStoreMap.setByRaw(sealedRequest, store);
                expect(ContextClsStoreMap.getByRaw(sealedRequest)).toBe(store);
                expect(ContextClsStoreMap.getByRaw(sealedRequest)).toBe(store);
            });

            it('2.2.4: Should handle sealed request with multiple enhancer passes', () => {
                const sealedRequest = Object.seal({ ...originalObject });
                ContextClsStoreMap.setByRaw(sealedRequest, store);

                for (let i = 0; i < 5; i++) {
                    expect(ContextClsStoreMap.getByRaw(sealedRequest)).toBe(
                        store,
                    );
                }
            });

            it('2.2.5: Should work with sealed request in async enhancers', async () => {
                const sealedRequest = Object.seal({ ...originalObject });
                ContextClsStoreMap.setByRaw(sealedRequest, store);

                await new Promise((resolve) => setTimeout(resolve, 10));
                expect(ContextClsStoreMap.getByRaw(sealedRequest)).toBe(store);
            });

            it('2.2.6: Should handle concurrent sealed requests', () => {
                const sealed1 = Object.seal({ id: 'req1' });
                const sealed2 = Object.seal({ id: 'req2' });
                const sealed3 = Object.seal({ id: 'req3' });

                const store1 = { requestId: 'store1' } as any;
                const store2 = { requestId: 'store2' } as any;
                const store3 = { requestId: 'store3' } as any;

                ContextClsStoreMap.setByRaw(sealed1, store1);
                ContextClsStoreMap.setByRaw(sealed2, store2);
                ContextClsStoreMap.setByRaw(sealed3, store3);

                expect(ContextClsStoreMap.getByRaw(sealed1)).toBe(store1);
                expect(ContextClsStoreMap.getByRaw(sealed2)).toBe(store2);
                expect(ContextClsStoreMap.getByRaw(sealed3)).toBe(store3);
            });

            it('2.2.7: Should track context after error in enhancer (sealed)', () => {
                const sealedRequest = Object.seal({ ...originalObject });
                ContextClsStoreMap.setByRaw(sealedRequest, store);

                try {
                    throw new Error('Enhancer error');
                } catch (_err) {
                    // pass
                }

                expect(ContextClsStoreMap.getByRaw(sealedRequest)).toBe(store);
            });

            it('2.2.8: Should handle sealed request in exception filters', () => {
                const sealedRequest = Object.seal({ ...originalObject });
                ContextClsStoreMap.setByRaw(sealedRequest, store);

                const retrievedInFilter =
                    ContextClsStoreMap.getByRaw(sealedRequest);
                expect(retrievedInFilter).toBe(store);
            });

            it('2.2.9: Should work with sealed request in pipes', () => {
                const sealedRequest = Object.seal({ ...originalObject });
                ContextClsStoreMap.setByRaw(sealedRequest, store);

                const retrievedInPipe =
                    ContextClsStoreMap.getByRaw(sealedRequest);
                expect(retrievedInPipe).toBe(store);
            });

            it('2.2.10: Should maintain context from controller to service (sealed)', () => {
                const sealedRequest = Object.seal({ ...originalObject });
                ContextClsStoreMap.setByRaw(sealedRequest, store);

                const retrievedInService =
                    ContextClsStoreMap.getByRaw(sealedRequest);
                expect(retrievedInService).toBe(store);
            });
        });

        describe('2.3 Partially Sealed Objects (10 tests)', () => {
            it('2.3.1: Should track sealed object with some properties frozen', () => {
                const obj = { id: 'test', value: 1, mutable: 'yes' };
                Object.defineProperty(obj, 'id', { writable: false });
                const sealed = Object.seal(obj);

                ContextClsStoreMap.setByRaw(sealed, store);
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('2.3.2: Should handle sealed object with read-only properties', () => {
                const obj = { id: 'test' };
                Object.defineProperty(obj, 'readonly', {
                    value: 'constant',
                    writable: false,
                    enumerable: true,
                    configurable: true,
                });
                const sealed = Object.seal(obj);

                ContextClsStoreMap.setByRaw(sealed, store);
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('2.3.3: Should work with sealed object containing nested mutable objects', () => {
                const obj = {
                    id: 'test',
                    nested: { value: 1 },
                };
                const sealed = Object.seal(obj);

                ContextClsStoreMap.setByRaw(sealed, store);

                // Nested object is still mutable
                sealed.nested.value = 2;
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('2.3.4: Should track sealed object after property modification', () => {
                const sealed = Object.seal({ id: 'test', counter: 0 });
                ContextClsStoreMap.setByRaw(sealed, store);

                // Modify existing property
                sealed.counter++;
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('2.3.5: Should handle sealed object with configurable properties', () => {
                const obj = { id: 'test' };
                Object.defineProperty(obj, 'configurable', {
                    value: 'test',
                    writable: true,
                    enumerable: true,
                    configurable: true,
                });
                const sealed = Object.seal(obj);

                ContextClsStoreMap.setByRaw(sealed, store);
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('2.3.6: Should work with sealed object created from spread', () => {
                const sealed = Object.seal({ ...originalObject });
                ContextClsStoreMap.setByRaw(sealed, store);

                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('2.3.7: Should track sealed object with added metadata before sealing', () => {
                const withMetadata = {
                    ...originalObject,
                    timestamp: Date.now(),
                };
                const sealed = Object.seal(withMetadata);

                ContextClsStoreMap.setByRaw(sealed, store);
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('2.3.8: Should handle sealed object created via Object.assign', () => {
                const assigned = Object.seal(Object.assign({}, originalObject));
                ContextClsStoreMap.setByRaw(assigned, store);

                expect(ContextClsStoreMap.getByRaw(assigned)).toBe(store);
            });

            it('2.3.9: Should work with sealed object from destructuring', () => {
                const { id, url } = originalObject;
                const sealed = Object.seal({ id, url });

                ContextClsStoreMap.setByRaw(sealed, store);
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('2.3.10: Should track sealed object with computed property values', () => {
                const computed = Object.seal({
                    id: originalObject.id,
                    fullUrl: `${originalObject.method} ${originalObject.url}`,
                });

                ContextClsStoreMap.setByRaw(computed, store);
                expect(ContextClsStoreMap.getByRaw(computed)).toBe(store);
            });
        });

        describe('2.4 Edge Cases with Sealed Objects (5 tests)', () => {
            it('2.4.1: Should handle sealed object that was previously mutable', () => {
                ContextClsStoreMap.setByRaw(originalObject, store);
                const sealed = Object.seal(originalObject);

                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('2.4.2: Should work with sealed object containing circular references', () => {
                const circular: any = { id: 'test' };
                circular.self = circular;
                const sealed = Object.seal(circular);

                ContextClsStoreMap.setByRaw(sealed, store);
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('2.4.3: Should handle sealed object with Symbol properties', () => {
                const sym = Symbol('test');
                const obj = { id: 'test', [sym]: 'value' };
                const sealed = Object.seal(obj);

                ContextClsStoreMap.setByRaw(sealed, store);
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('2.4.4: Should work with sealed object in WeakMap', () => {
                const sealed = Object.seal({ ...originalObject });
                const weakMap = new WeakMap();
                weakMap.set(sealed, store);

                ContextClsStoreMap.setByRaw(sealed, store);
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
                expect(weakMap.get(sealed)).toBe(store);
            });

            it('2.4.5: Should handle sealed object with non-enumerable properties', () => {
                const obj = { id: 'test' };
                Object.defineProperty(obj, 'hidden', {
                    value: 'secret',
                    enumerable: false,
                    writable: true,
                    configurable: true,
                });
                const sealed = Object.seal(obj);

                ContextClsStoreMap.setByRaw(sealed, store);
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });
        });
    });

    /**
     * SECTION 3: Non-Extensible Objects (15 tests)
     *
     * Validates WeakMap fallback when Object.preventExtensions() prevents new properties.
     * Non-extensible objects allow property modification and deletion but not addition.
     */
    describe('Section 3: Non-Extensible Objects (15 tests)', () => {
        describe('3.1 Basic Non-Extensible Objects (10 tests)', () => {
            it('3.1.1: Should track context with Object.preventExtensions()', () => {
                const nonExt = Object.preventExtensions({ ...originalObject });
                ContextClsStoreMap.setByRaw(nonExt, store);

                const retrieved = ContextClsStoreMap.getByRaw(nonExt);
                expect(retrieved).toBe(store);
            });

            it('3.1.2: Should track context when preventExtensions after store set', () => {
                ContextClsStoreMap.setByRaw(originalObject, store);
                const nonExt = Object.preventExtensions(originalObject);

                const retrieved = ContextClsStoreMap.getByRaw(nonExt);
                expect(retrieved).toBe(store);
            });

            it('3.1.3: Should track context when store set on non-extensible object', () => {
                const nonExt = Object.preventExtensions({ ...originalObject });
                ContextClsStoreMap.setByRaw(nonExt, store);

                expect(ContextClsStoreMap.getByRaw(nonExt)).toBe(store);
            });

            it('3.1.4: Should maintain context across multiple non-extensible objects', () => {
                const nonExt1 = Object.preventExtensions({ id: 'req1' });
                const nonExt2 = Object.preventExtensions({ id: 'req2' });

                const store1 = { requestId: 'store1' } as any;
                const store2 = { requestId: 'store2' } as any;

                ContextClsStoreMap.setByRaw(nonExt1, store1);
                ContextClsStoreMap.setByRaw(nonExt2, store2);

                expect(ContextClsStoreMap.getByRaw(nonExt1)).toBe(store1);
                expect(ContextClsStoreMap.getByRaw(nonExt2)).toBe(store2);
            });

            it('3.1.5: Should allow property modification on non-extensible object', () => {
                const nonExt = Object.preventExtensions({
                    id: 'test',
                    value: 1,
                });
                ContextClsStoreMap.setByRaw(nonExt, store);

                nonExt.value = 2;
                expect(ContextClsStoreMap.getByRaw(nonExt)).toBe(store);
                expect(nonExt.value).toBe(2);
            });

            it('3.1.6: Should allow property deletion on non-extensible object', () => {
                const nonExt: any = Object.preventExtensions({
                    id: 'test',
                    temp: 'delete-me',
                });
                ContextClsStoreMap.setByRaw(nonExt, store);

                delete nonExt.temp;
                expect(ContextClsStoreMap.getByRaw(nonExt)).toBe(store);
                expect(nonExt.temp).toBeUndefined();
            });

            it('3.1.7: Should handle non-extensible empty object', () => {
                const nonExt = Object.preventExtensions({});
                ContextClsStoreMap.setByRaw(nonExt, store);

                expect(ContextClsStoreMap.getByRaw(nonExt)).toBe(store);
            });

            it('3.1.8: Should handle non-extensible object with null prototype', () => {
                const obj = Object.create(null);
                obj.id = 'test';
                const nonExt = Object.preventExtensions(obj);

                ContextClsStoreMap.setByRaw(nonExt, store);
                expect(ContextClsStoreMap.getByRaw(nonExt)).toBe(store);
            });

            it('3.1.9: Should work with non-extensible array-like object', () => {
                const arrayLike = Object.preventExtensions({
                    0: 'a',
                    1: 'b',
                    length: 2,
                });
                ContextClsStoreMap.setByRaw(arrayLike, store);

                expect(ContextClsStoreMap.getByRaw(arrayLike)).toBe(store);
            });

            it('3.1.10: Should handle non-extensible object with getters/setters', () => {
                const obj = {
                    _value: 42,
                    get value() {
                        return this._value;
                    },
                    set value(v) {
                        this._value = v;
                    },
                };
                const nonExt = Object.preventExtensions(obj);

                ContextClsStoreMap.setByRaw(nonExt, store);
                nonExt.value = 100;
                expect(ContextClsStoreMap.getByRaw(nonExt)).toBe(store);
            });
        });

        describe('3.2 Edge Cases with Non-Extensible Objects (5 tests)', () => {
            it('3.2.1: Should handle non-extensible object that was previously mutable', () => {
                ContextClsStoreMap.setByRaw(originalObject, store);
                const nonExt = Object.preventExtensions(originalObject);

                expect(ContextClsStoreMap.getByRaw(nonExt)).toBe(store);
            });

            it('3.2.2: Should work with non-extensible object containing circular references', () => {
                const circular: any = { id: 'test' };
                circular.self = circular;
                const nonExt = Object.preventExtensions(circular);

                ContextClsStoreMap.setByRaw(nonExt, store);
                expect(ContextClsStoreMap.getByRaw(nonExt)).toBe(store);
            });

            it('3.2.3: Should handle non-extensible object with Symbol properties', () => {
                const sym = Symbol('test');
                const obj = { id: 'test', [sym]: 'value' };
                const nonExt = Object.preventExtensions(obj);

                ContextClsStoreMap.setByRaw(nonExt, store);
                expect(ContextClsStoreMap.getByRaw(nonExt)).toBe(store);
            });

            it('3.2.4: Should work with non-extensible object in WeakMap', () => {
                const nonExt = Object.preventExtensions({ ...originalObject });
                const weakMap = new WeakMap();
                weakMap.set(nonExt, store);

                ContextClsStoreMap.setByRaw(nonExt, store);
                expect(ContextClsStoreMap.getByRaw(nonExt)).toBe(store);
                expect(weakMap.get(nonExt)).toBe(store);
            });

            it('3.2.5: Should handle non-extensible object with non-enumerable properties', () => {
                const obj = { id: 'test' };
                Object.defineProperty(obj, 'hidden', {
                    value: 'secret',
                    enumerable: false,
                    writable: true,
                    configurable: true,
                });
                const nonExt = Object.preventExtensions(obj);

                ContextClsStoreMap.setByRaw(nonExt, store);
                expect(ContextClsStoreMap.getByRaw(nonExt)).toBe(store);
            });
        });
    });

    /**
     * SECTION 4: Mixed Scenarios (15 tests)
     *
     * Validates complex scenarios combining frozen, sealed, and extensible objects.
     */
    describe('Section 4: Mixed Scenarios (15 tests)', () => {
        describe('4.1 Transition Scenarios (5 tests)', () => {
            it('4.1.1: Should handle transition from extensible to frozen', () => {
                // Start extensible
                ContextClsStoreMap.setByRaw(originalObject, store);
                expect(ContextClsStoreMap.getByRaw(originalObject)).toBe(store);

                // Freeze mid-request
                const frozen = Object.freeze(originalObject);
                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store);
            });

            it('4.1.2: Should handle transition from extensible to sealed', () => {
                ContextClsStoreMap.setByRaw(originalObject, store);
                const sealed = Object.seal(originalObject);

                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('4.1.3: Should handle transition from extensible to non-extensible', () => {
                ContextClsStoreMap.setByRaw(originalObject, store);
                const nonExt = Object.preventExtensions(originalObject);

                expect(ContextClsStoreMap.getByRaw(nonExt)).toBe(store);
            });

            it('4.1.4: Should handle transition from sealed to frozen', () => {
                const sealed = Object.seal({ ...originalObject });
                ContextClsStoreMap.setByRaw(sealed, store);

                const frozen = Object.freeze(sealed);
                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store);
            });

            it('4.1.5: Should handle transition from non-extensible to sealed', () => {
                const nonExt = Object.preventExtensions({ ...originalObject });
                ContextClsStoreMap.setByRaw(nonExt, store);

                const sealed = Object.seal(nonExt);
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });
        });

        describe('4.2 Concurrent Mixed Requests (5 tests)', () => {
            it('4.2.1: Should handle mix of frozen/extensible requests', () => {
                const frozen = Object.freeze({ id: 'frozen' });
                const extensible = { id: 'extensible' };

                const store1 = { requestId: 'store1' } as any;
                const store2 = { requestId: 'store2' } as any;

                ContextClsStoreMap.setByRaw(frozen, store1);
                ContextClsStoreMap.setByRaw(extensible, store2);

                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store1);
                expect(ContextClsStoreMap.getByRaw(extensible)).toBe(store2);
            });

            it('4.2.2: Should handle mix of sealed/extensible requests', () => {
                const sealed = Object.seal({ id: 'sealed' });
                const extensible = { id: 'extensible' };

                const store1 = { requestId: 'store1' } as any;
                const store2 = { requestId: 'store2' } as any;

                ContextClsStoreMap.setByRaw(sealed, store1);
                ContextClsStoreMap.setByRaw(extensible, store2);

                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store1);
                expect(ContextClsStoreMap.getByRaw(extensible)).toBe(store2);
            });

            it('4.2.3: Should handle mix of frozen/sealed/extensible requests', () => {
                const frozen = Object.freeze({ id: 'frozen' });
                const sealed = Object.seal({ id: 'sealed' });
                const extensible = { id: 'extensible' };

                const store1 = { requestId: 'store1' } as any;
                const store2 = { requestId: 'store2' } as any;
                const store3 = { requestId: 'store3' } as any;

                ContextClsStoreMap.setByRaw(frozen, store1);
                ContextClsStoreMap.setByRaw(sealed, store2);
                ContextClsStoreMap.setByRaw(extensible, store3);

                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store1);
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store2);
                expect(ContextClsStoreMap.getByRaw(extensible)).toBe(store3);
            });

            it('4.2.4: Should handle concurrent frozen requests (25 requests)', () => {
                const requests = Array.from({ length: 25 }, (_, i) =>
                    Object.freeze({ id: `req-${i}` }),
                );
                const stores = Array.from({ length: 25 }, (_, i) => ({
                    requestId: `store-${i}`,
                })) as any[];

                // Set all stores
                requests.forEach((req, i) => {
                    ContextClsStoreMap.setByRaw(req, stores[i]);
                });

                // Verify all stores
                requests.forEach((req, i) => {
                    expect(ContextClsStoreMap.getByRaw(req)).toBe(stores[i]);
                });
            });

            it('4.2.5: Should handle concurrent mixed requests (50 total)', () => {
                const frozen = Array.from({ length: 15 }, (_, i) =>
                    Object.freeze({ id: `frozen-${i}` }),
                );
                const sealed = Array.from({ length: 15 }, (_, i) =>
                    Object.seal({ id: `sealed-${i}` }),
                );
                const extensible = Array.from({ length: 20 }, (_, i) => ({
                    id: `ext-${i}`,
                }));

                const allRequests = [...frozen, ...sealed, ...extensible];
                const allStores = allRequests.map((_, i) => ({
                    requestId: `store-${i}`,
                })) as any[];

                allRequests.forEach((req, i) => {
                    ContextClsStoreMap.setByRaw(req, allStores[i]);
                });

                allRequests.forEach((req, i) => {
                    expect(ContextClsStoreMap.getByRaw(req)).toBe(allStores[i]);
                });
            });
        });

        describe('4.3 Complex Nesting and Composition (5 tests)', () => {
            it('4.3.1: Should handle frozen object with nested frozen properties', () => {
                const nested = Object.freeze({
                    user: Object.freeze({ name: 'test', id: 1 }),
                });
                const frozen = Object.freeze(nested);

                ContextClsStoreMap.setByRaw(frozen, store);
                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store);
            });

            it('4.3.2: Should handle sealed object with frozen nested properties', () => {
                const nested = {
                    user: Object.freeze({ name: 'test', id: 1 }),
                };
                const sealed = Object.seal(nested);

                ContextClsStoreMap.setByRaw(sealed, store);
                expect(ContextClsStoreMap.getByRaw(sealed)).toBe(store);
            });

            it('4.3.3: Should handle frozen object with extensible nested properties', () => {
                const nested = {
                    user: { name: 'test', id: 1 }, // Extensible nested
                };
                const frozen = Object.freeze(nested);

                ContextClsStoreMap.setByRaw(frozen, store);

                // Nested object can be modified
                nested.user.name = 'updated';
                expect(ContextClsStoreMap.getByRaw(frozen)).toBe(store);
            });

            it('4.3.4: Should handle object with mix of frozen/sealed/extensible nested objects', () => {
                const complex = Object.freeze({
                    frozen: Object.freeze({ a: 1 }),
                    sealed: Object.seal({ b: 2 }),
                    extensible: { c: 3 },
                });

                ContextClsStoreMap.setByRaw(complex, store);
                expect(ContextClsStoreMap.getByRaw(complex)).toBe(store);
            });

            it('4.3.5: Should handle deeply nested frozen/sealed hierarchy', () => {
                const deep = Object.freeze({
                    level1: Object.seal({
                        level2: Object.freeze({
                            level3: Object.seal({
                                level4: { data: 'test' },
                            }),
                        }),
                    }),
                });

                ContextClsStoreMap.setByRaw(deep, store);
                expect(ContextClsStoreMap.getByRaw(deep)).toBe(store);
            });
        });
    });
});
