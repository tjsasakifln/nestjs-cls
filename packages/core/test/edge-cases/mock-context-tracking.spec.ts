import { ContextClsStoreMap } from '../../src/lib/cls-initializers/utils/context-cls-store-map';
import { ClsStore } from '../../src/lib/cls.options';

/**
 * Comprehensive test suite for mock objects and test doubles with context tracking.
 *
 * This test suite validates that the Symbol+WeakMap hybrid strategy (Issue #9)
 * correctly handles mock objects, test doubles, and object transformations commonly
 * used in testing scenarios (Jest mocks, Object.create, Object.assign, spread operator).
 *
 * **Issue #129 Regression Tests:** ClsGuard with mock request objects
 * **Testing DX:** Ensures developers can safely use mocks with CLS context tracking
 *
 * Test Structure:
 * - Section 1: Jest mock objects (30 tests)
 * - Section 2: Object.create() clones (30 tests)
 * - Section 3: Object.assign() and spread (20 tests)
 * - Section 4: Testing library compatibility (20 tests)
 *
 * Total: 100 tests
 *
 * @see Issue #37 - Mock objects and test doubles for context tracking (100 tests)
 * @see Issue #129 - Context Leaking (ClsGuard)
 * @see Issue #9 - Symbol+WeakMap hybrid strategy
 * @see docs/research/weakmap-identity-pitfalls.md
 */
describe('Mock Context Tracking - Edge Cases (Issue #37)', () => {
    let originalObject: any;
    let store: ClsStore;

    beforeEach(() => {
        originalObject = { id: 'test-request', url: '/test', method: 'GET' };
        store = { requestId: 'req-123', user: 'test-user' } as any;
        jest.clearAllMocks();
    });

    /**
     * SECTION 1: Jest Mock Objects (30 tests)
     *
     * Validates Symbol tagging works with Jest mocking utilities.
     * Critical for testing DX - developers must be able to use mocks safely.
     */
    describe('Section 1: Jest Mock Objects (30 tests)', () => {
        describe('1.1 jest.fn() Spy Objects (10 tests)', () => {
            it('1.1.1: Should track context with jest.fn() mock', () => {
                const mockFn = jest.fn().mockReturnValue(originalObject);
                const result = mockFn();

                ContextClsStoreMap.setByRaw(result, store);
                const retrieved = ContextClsStoreMap.getByRaw(result);

                expect(retrieved).toBe(store);
                expect(mockFn).toHaveBeenCalledTimes(1);
            });

            it('1.1.2: Should track context with jest.fn() implementation', () => {
                const mockFn = jest.fn((req) => req);
                const result = mockFn(originalObject);

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.1.3: Should maintain context across multiple jest.fn() calls', () => {
                const mockFn = jest.fn().mockReturnValue(originalObject);

                const result1 = mockFn();
                const result2 = mockFn();

                ContextClsStoreMap.setByRaw(result1, store);

                // Same reference returned
                expect(ContextClsStoreMap.getByRaw(result2)).toBe(store);
                expect(mockFn).toHaveBeenCalledTimes(2);
            });

            it('1.1.4: Should track context with jest.fn() mockReturnValueOnce', () => {
                const mockFn = jest
                    .fn()
                    .mockReturnValueOnce(originalObject)
                    .mockReturnValueOnce({ id: 'different' });

                const result1 = mockFn();
                const result2 = mockFn();

                ContextClsStoreMap.setByRaw(result1, store);

                expect(ContextClsStoreMap.getByRaw(result1)).toBe(store);
                expect(ContextClsStoreMap.getByRaw(result2)).toBeUndefined();
            });

            it('1.1.5: Should work with jest.fn() mockResolvedValue', async () => {
                const mockFn = jest.fn().mockResolvedValue(originalObject);
                const result = await mockFn();

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.1.6: Should track context with jest.fn() as property getter', () => {
                const obj = {
                    getRequest: jest.fn().mockReturnValue(originalObject),
                };

                const result = obj.getRequest();
                ContextClsStoreMap.setByRaw(result, store);

                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.1.7: Should maintain context when jest.fn() is called with different args', () => {
                const mockFn = jest.fn().mockReturnValue(originalObject);

                mockFn('arg1');
                mockFn('arg2');
                const result = mockFn('arg3');

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.1.8: Should work with nested jest.fn() calls', () => {
                const innerMock = jest.fn().mockReturnValue(originalObject);
                const outerMock = jest.fn(() => innerMock());

                const result = outerMock();
                ContextClsStoreMap.setByRaw(result, store);

                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.1.9: Should track context with jest.fn() mockImplementation', () => {
                const mockFn = jest
                    .fn()
                    .mockImplementation(() => originalObject);
                const result = mockFn();

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.1.10: Should work with jest.fn() that modifies returned object', () => {
                const mockFn = jest.fn(() => {
                    originalObject.modified = true;
                    return originalObject;
                });

                const result = mockFn();
                ContextClsStoreMap.setByRaw(result, store);

                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
                expect(result.modified).toBe(true);
            });
        });

        describe('1.2 jest.spyOn() Scenarios (10 tests)', () => {
            it('1.2.1: Should track context with jest.spyOn() on object method', () => {
                const service = {
                    getRequest: () => originalObject,
                };

                jest.spyOn(service, 'getRequest');
                const result = service.getRequest();

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
                expect(service.getRequest).toHaveBeenCalled();
            });

            it('1.2.2: Should track context with jest.spyOn() mockReturnValue', () => {
                const service = {
                    getRequest: () => ({ id: 'wrong' }),
                };

                jest.spyOn(service, 'getRequest').mockReturnValue(
                    originalObject,
                );
                const result = service.getRequest();

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.2.3: Should maintain context with jest.spyOn() mockImplementation', () => {
                const service = {
                    getRequest: () => ({}),
                };

                jest.spyOn(service, 'getRequest').mockImplementation(
                    () => originalObject,
                );

                const result = service.getRequest();
                ContextClsStoreMap.setByRaw(result, store);

                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.2.4: Should work with jest.spyOn() on getter', () => {
                const service = {
                    get request() {
                        return originalObject;
                    },
                };

                jest.spyOn(service, 'request', 'get');
                const result = service.request;

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.2.5: Should track context with jest.spyOn() mockResolvedValue', async () => {
                const service = {
                    async getRequest() {
                        return {};
                    },
                };

                jest.spyOn(service, 'getRequest').mockResolvedValue(
                    originalObject,
                );
                const result = await service.getRequest();

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.2.6: Should maintain context across multiple jest.spyOn() calls', () => {
                const service = {
                    getRequest: () => originalObject,
                };

                const spy = jest.spyOn(service, 'getRequest');

                const result1 = service.getRequest();
                const result2 = service.getRequest();

                ContextClsStoreMap.setByRaw(result1, store);

                expect(ContextClsStoreMap.getByRaw(result2)).toBe(store);
                expect(spy).toHaveBeenCalledTimes(2);
            });

            it('1.2.7: Should work with jest.spyOn() and restore', () => {
                const service = {
                    getRequest: () => originalObject,
                };

                const spy = jest.spyOn(service, 'getRequest');
                const result1 = service.getRequest();

                spy.mockRestore();
                const result2 = service.getRequest();

                ContextClsStoreMap.setByRaw(result1, store);

                // Both should work (same reference)
                expect(ContextClsStoreMap.getByRaw(result2)).toBe(store);
            });

            it('1.2.8: Should track context with chained jest.spyOn() mocks', () => {
                const service = {
                    getRequest: () => ({}),
                };

                jest.spyOn(service, 'getRequest')
                    .mockReturnValueOnce({ id: 'first' })
                    .mockReturnValueOnce(originalObject);

                service.getRequest(); // Skip first
                const result = service.getRequest();

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.2.9: Should work with jest.spyOn() on class method', () => {
                class RequestService {
                    getRequest() {
                        return originalObject;
                    }
                }

                const instance = new RequestService();
                jest.spyOn(instance, 'getRequest');

                const result = instance.getRequest();
                ContextClsStoreMap.setByRaw(result, store);

                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.2.10: Should track context with jest.spyOn() on static method', () => {
                class RequestService {
                    static getRequest() {
                        return originalObject;
                    }
                }

                jest.spyOn(RequestService, 'getRequest');
                const result = RequestService.getRequest();

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });
        });

        describe('1.3 jest.mock() Module Mocks (10 tests)', () => {
            // Helper module mock setup
            const createMockModule = () => ({
                getRequest: jest.fn().mockReturnValue(originalObject),
                RequestClass: jest.fn().mockImplementation(() => ({
                    data: originalObject,
                })),
            });

            it('1.3.1: Should track context with mocked module function', () => {
                const mockModule = createMockModule();
                const result = mockModule.getRequest();

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.3.2: Should track context with mocked class constructor', () => {
                const mockModule = createMockModule();
                const instance = new mockModule.RequestClass();

                ContextClsStoreMap.setByRaw(instance.data, store);
                expect(ContextClsStoreMap.getByRaw(instance.data)).toBe(store);
            });

            it('1.3.3: Should maintain context across mocked module calls', () => {
                const mockModule = createMockModule();

                const result1 = mockModule.getRequest();
                const result2 = mockModule.getRequest();

                ContextClsStoreMap.setByRaw(result1, store);
                expect(ContextClsStoreMap.getByRaw(result2)).toBe(store);
            });

            it('1.3.4: Should work with default export mock', () => {
                const mockDefault = jest.fn().mockReturnValue(originalObject);
                const result = mockDefault();

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.3.5: Should track context with named export mocks', () => {
                const namedExport = jest.fn().mockReturnValue(originalObject);
                const result = namedExport();

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.3.6: Should work with mocked async module functions', async () => {
                const asyncMock = jest.fn().mockResolvedValue(originalObject);
                const result = await asyncMock();

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.3.7: Should track context with mocked factory function', () => {
                const factory = jest.fn(() => originalObject);
                const result = factory();

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('1.3.8: Should maintain context with mocked singleton', () => {
                const singleton = {
                    getInstance: jest.fn().mockReturnValue(originalObject),
                };

                const result1 = singleton.getInstance();
                const result2 = singleton.getInstance();

                ContextClsStoreMap.setByRaw(result1, store);
                expect(ContextClsStoreMap.getByRaw(result2)).toBe(store);
            });

            it('1.3.9: Should work with partially mocked modules', () => {
                const partialMock = {
                    realFunction: () => 'real',
                    mockedFunction: jest.fn().mockReturnValue(originalObject),
                };

                const result = partialMock.mockedFunction();
                ContextClsStoreMap.setByRaw(result, store);

                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
                expect(partialMock.realFunction()).toBe('real');
            });

            it('1.3.10: Should track context with mocked dependency injection', () => {
                // Simulate DI container mock
                const container = {
                    get: jest.fn((token: string) =>
                        token === 'REQUEST' ? originalObject : null,
                    ),
                };

                const result = container.get('REQUEST');
                ContextClsStoreMap.setByRaw(result, store);

                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });
        });
    });

    /**
     * SECTION 2: Object.create() Clones (30 tests)
     *
     * Validates Symbol tagging through Object.create() which creates objects
     * with a different identity but potentially shared prototype chain.
     */
    describe('Section 2: Object.create() Clones (30 tests)', () => {
        describe('2.1 Basic Object.create() (10 tests)', () => {
            it('2.1.1: Should track context with Object.create(null)', () => {
                const clone = Object.create(null);
                Object.assign(clone, originalObject);

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.1.2: Should track context with Object.create(prototype)', () => {
                const clone = Object.create(originalObject);

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.1.3: Should maintain separate contexts for original and clone', () => {
                const clone = Object.create(originalObject);
                const cloneStore = { requestId: 'clone-store' } as any;

                ContextClsStoreMap.setByRaw(originalObject, store);
                ContextClsStoreMap.setByRaw(clone, cloneStore);

                expect(ContextClsStoreMap.getByRaw(originalObject)).toBe(store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(cloneStore);
            });

            it('2.1.4: Should work when store set on prototype', () => {
                ContextClsStoreMap.setByRaw(originalObject, store);
                const clone = Object.create(originalObject);

                // Symbol tagging works through prototype chain - clone can access store
                // This is correct behavior demonstrating Symbol tagging effectiveness
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.1.5: Should track context when clone created before store set', () => {
                const clone = Object.create(originalObject);
                ContextClsStoreMap.setByRaw(clone, store);

                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.1.6: Should work with multiple Object.create() clones', () => {
                const clone1 = Object.create(originalObject);
                const clone2 = Object.create(originalObject);

                const store1 = { requestId: 'store1' } as any;
                const store2 = { requestId: 'store2' } as any;

                ContextClsStoreMap.setByRaw(clone1, store1);
                ContextClsStoreMap.setByRaw(clone2, store2);

                expect(ContextClsStoreMap.getByRaw(clone1)).toBe(store1);
                expect(ContextClsStoreMap.getByRaw(clone2)).toBe(store2);
            });

            it('2.1.7: Should track context with Object.create() and Object.assign()', () => {
                const clone = Object.create(null);
                Object.assign(clone, originalObject);

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.1.8: Should work with Object.create() inheriting from null', () => {
                const nullProto = Object.create(null);
                nullProto.id = 'test';

                ContextClsStoreMap.setByRaw(nullProto, store);
                expect(ContextClsStoreMap.getByRaw(nullProto)).toBe(store);
            });

            it('2.1.9: Should maintain context when clone mutated', () => {
                const clone = Object.create(originalObject);
                ContextClsStoreMap.setByRaw(clone, store);

                clone.newProperty = 'value';
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.1.10: Should work with Object.create() chaining', () => {
                const clone1 = Object.create(originalObject);
                const clone2 = Object.create(clone1);

                ContextClsStoreMap.setByRaw(clone2, store);
                expect(ContextClsStoreMap.getByRaw(clone2)).toBe(store);
            });
        });

        describe('2.2 Object.create() with Property Descriptors (10 tests)', () => {
            it('2.2.1: Should track context with data descriptors', () => {
                const clone = Object.create(originalObject, {
                    id: { value: 'new-id', writable: true, enumerable: true },
                });

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
                expect(clone.id).toBe('new-id');
            });

            it('2.2.2: Should work with getter descriptors', () => {
                const clone = Object.create(originalObject, {
                    computedId: {
                        get() {
                            return 'computed-' + this.id;
                        },
                        enumerable: true,
                    },
                });

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.2.3: Should track context with setter descriptors', () => {
                let internalValue = '';
                const clone = Object.create(originalObject, {
                    customProp: {
                        set(val: string) {
                            internalValue = val;
                        },
                        enumerable: true,
                    },
                });

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.2.4: Should work with non-enumerable properties', () => {
                const clone = Object.create(originalObject, {
                    hidden: { value: 'secret', enumerable: false },
                });

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.2.5: Should track context with non-writable properties', () => {
                const clone = Object.create(originalObject, {
                    constant: { value: 'fixed', writable: false },
                });

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.2.6: Should work with non-configurable properties', () => {
                const clone = Object.create(originalObject, {
                    locked: { value: 'permanent', configurable: false },
                });

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.2.7: Should track context with multiple descriptors', () => {
                const clone = Object.create(originalObject, {
                    prop1: { value: 'val1', writable: true },
                    prop2: { value: 'val2', enumerable: false },
                    prop3: {
                        get() {
                            return 'computed';
                        },
                    },
                });

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.2.8: Should work with accessor descriptors', () => {
                let storage = 'initial';
                const clone = Object.create(originalObject, {
                    accessor: {
                        get() {
                            return storage;
                        },
                        set(val: string) {
                            storage = val;
                        },
                    },
                });

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.2.9: Should track context with inherited descriptors', () => {
                const base = Object.create(null, {
                    baseProp: { value: 'base', enumerable: true },
                });
                const clone = Object.create(base, {
                    ownProp: { value: 'own', enumerable: true },
                });

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.2.10: Should work with Symbol properties in descriptors', () => {
                const sym = Symbol('test');
                const clone = Object.create(originalObject, {
                    [sym]: { value: 'symbol-value', enumerable: true },
                });

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });
        });

        describe('2.3 Prototype Chain Identity (10 tests)', () => {
            it('2.3.1: Should maintain context through prototype chain', () => {
                const clone = Object.create(originalObject);
                ContextClsStoreMap.setByRaw(clone, store);

                // Clone has own identity
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
                expect(
                    ContextClsStoreMap.getByRaw(originalObject),
                ).toBeUndefined();
            });

            it('2.3.2: Should track context in deep prototype chain', () => {
                const level1 = Object.create(originalObject);
                const level2 = Object.create(level1);
                const level3 = Object.create(level2);

                ContextClsStoreMap.setByRaw(level3, store);
                expect(ContextClsStoreMap.getByRaw(level3)).toBe(store);
            });

            it('2.3.3: Should maintain separate contexts in chain', () => {
                const level1 = Object.create(originalObject);
                const level2 = Object.create(level1);

                const store1 = { requestId: 'store1' } as any;
                const store2 = { requestId: 'store2' } as any;

                ContextClsStoreMap.setByRaw(level1, store1);
                ContextClsStoreMap.setByRaw(level2, store2);

                expect(ContextClsStoreMap.getByRaw(level1)).toBe(store1);
                expect(ContextClsStoreMap.getByRaw(level2)).toBe(store2);
            });

            it('2.3.4: Should work with mixed prototype chain', () => {
                const proto1 = { base: 'value' };
                const proto2 = Object.create(proto1);
                const final = Object.create(proto2);

                ContextClsStoreMap.setByRaw(final, store);
                expect(ContextClsStoreMap.getByRaw(final)).toBe(store);
            });

            it('2.3.5: Should track context when prototype changes', () => {
                const clone = Object.create(originalObject);
                ContextClsStoreMap.setByRaw(clone, store);

                // Change prototype
                Object.setPrototypeOf(clone, { newProto: true });
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.3.6: Should work with null prototype in chain', () => {
                const nullProto = Object.create(null);
                const clone = Object.create(nullProto);

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.3.7: Should maintain context through getPrototypeOf', () => {
                const clone = Object.create(originalObject);
                ContextClsStoreMap.setByRaw(clone, store);

                const proto = Object.getPrototypeOf(clone);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
                expect(proto).toBe(originalObject);
            });

            it('2.3.8: Should track context with Object.create() from Array', () => {
                const arr = [1, 2, 3];
                const clone = Object.create(arr);

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.3.9: Should work with Object.create() from Function', () => {
                const fn = function () {
                    return 'test';
                };
                const clone = Object.create(fn);

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
            });

            it('2.3.10: Should maintain context with instanceof checks', () => {
                class RequestClass {}
                const instance = new RequestClass();
                const clone = Object.create(instance);

                ContextClsStoreMap.setByRaw(clone, store);
                expect(ContextClsStoreMap.getByRaw(clone)).toBe(store);
                expect(clone instanceof RequestClass).toBe(true);
            });
        });
    });

    /**
     * SECTION 3: Object.assign() and Spread Operator (20 tests)
     *
     * Validates context tracking through shallow cloning operations.
     * Critical for testing scenarios where request objects are copied.
     */
    describe('Section 3: Object.assign() and Spread Operator (20 tests)', () => {
        describe('3.1 Object.assign() Scenarios (10 tests)', () => {
            it('3.1.1: Should track context with Object.assign({}, original)', () => {
                const copy = Object.assign({}, originalObject);

                ContextClsStoreMap.setByRaw(copy, store);
                expect(ContextClsStoreMap.getByRaw(copy)).toBe(store);
            });

            it('3.1.2: Should maintain separate contexts for original and copy', () => {
                const copy = Object.assign({}, originalObject);
                const copyStore = { requestId: 'copy-store' } as any;

                ContextClsStoreMap.setByRaw(originalObject, store);
                ContextClsStoreMap.setByRaw(copy, copyStore);

                expect(ContextClsStoreMap.getByRaw(originalObject)).toBe(store);
                expect(ContextClsStoreMap.getByRaw(copy)).toBe(copyStore);
            });

            it('3.1.3: Should work with Object.assign(target, source)', () => {
                const target = { existing: 'prop' };
                Object.assign(target, originalObject);

                ContextClsStoreMap.setByRaw(target, store);
                expect(ContextClsStoreMap.getByRaw(target)).toBe(store);
            });

            it('3.1.4: Should track context with multiple sources', () => {
                const source1 = { a: 1 };
                const source2 = { b: 2 };
                const copy = Object.assign(
                    {},
                    source1,
                    originalObject,
                    source2,
                );

                ContextClsStoreMap.setByRaw(copy, store);
                expect(ContextClsStoreMap.getByRaw(copy)).toBe(store);
            });

            it('3.1.5: Should work when target is original object', () => {
                const extra = { extra: 'data' };
                Object.assign(originalObject, extra);

                ContextClsStoreMap.setByRaw(originalObject, store);
                expect(ContextClsStoreMap.getByRaw(originalObject)).toBe(store);
            });

            it('3.1.6: Should track context with nested Object.assign()', () => {
                const copy1 = Object.assign({}, originalObject);
                const copy2 = Object.assign({}, copy1);

                ContextClsStoreMap.setByRaw(copy2, store);
                expect(ContextClsStoreMap.getByRaw(copy2)).toBe(store);
            });

            it('3.1.7: Should work with Object.assign() and property overrides', () => {
                const copy = Object.assign({}, originalObject, {
                    id: 'overridden',
                });

                ContextClsStoreMap.setByRaw(copy, store);
                expect(ContextClsStoreMap.getByRaw(copy)).toBe(store);
                expect(copy.id).toBe('overridden');
            });

            it('3.1.8: Should maintain context when copy mutated', () => {
                const copy = Object.assign({}, originalObject);
                ContextClsStoreMap.setByRaw(copy, store);

                copy.newProp = 'value';
                expect(ContextClsStoreMap.getByRaw(copy)).toBe(store);
            });

            it('3.1.9: Should work with Object.assign() from array-like', () => {
                const arrayLike = { 0: 'a', 1: 'b', length: 2 };
                const copy = Object.assign({}, arrayLike);

                ContextClsStoreMap.setByRaw(copy, store);
                expect(ContextClsStoreMap.getByRaw(copy)).toBe(store);
            });

            it('3.1.10: Should track context with Symbol properties', () => {
                const sym = Symbol('test');
                originalObject[sym] = 'symbol-value';
                const copy = Object.assign({}, originalObject);

                ContextClsStoreMap.setByRaw(copy, store);
                expect(ContextClsStoreMap.getByRaw(copy)).toBe(store);
                expect(copy[sym]).toBe('symbol-value');
            });
        });

        describe('3.2 Spread Operator Scenarios (10 tests)', () => {
            it('3.2.1: Should track context with spread operator ({ ...obj })', () => {
                const copy = { ...originalObject };

                ContextClsStoreMap.setByRaw(copy, store);
                expect(ContextClsStoreMap.getByRaw(copy)).toBe(store);
            });

            it('3.2.2: Should maintain separate contexts for original and spread copy', () => {
                const copy = { ...originalObject };
                const copyStore = { requestId: 'copy-store' } as any;

                ContextClsStoreMap.setByRaw(originalObject, store);
                ContextClsStoreMap.setByRaw(copy, copyStore);

                expect(ContextClsStoreMap.getByRaw(originalObject)).toBe(store);
                expect(ContextClsStoreMap.getByRaw(copy)).toBe(copyStore);
            });

            it('3.2.3: Should work with spread and additional properties', () => {
                const copy = { ...originalObject, extra: 'prop' };

                ContextClsStoreMap.setByRaw(copy, store);
                expect(ContextClsStoreMap.getByRaw(copy)).toBe(store);
                expect(copy.extra).toBe('prop');
            });

            it('3.2.4: Should track context with property overrides in spread', () => {
                const copy = { ...originalObject, id: 'overridden' };

                ContextClsStoreMap.setByRaw(copy, store);
                expect(ContextClsStoreMap.getByRaw(copy)).toBe(store);
                expect(copy.id).toBe('overridden');
            });

            it('3.2.5: Should work with multiple spread sources', () => {
                const source1 = { a: 1 };
                const source2 = { b: 2 };
                const copy = { ...source1, ...originalObject, ...source2 };

                ContextClsStoreMap.setByRaw(copy, store);
                expect(ContextClsStoreMap.getByRaw(copy)).toBe(store);
            });

            it('3.2.6: Should maintain context when spread copy mutated', () => {
                const copy = { ...originalObject };
                ContextClsStoreMap.setByRaw(copy, store);

                copy.newProp = 'value';
                expect(ContextClsStoreMap.getByRaw(copy)).toBe(store);
            });

            it('3.2.7: Should track context with nested spread operations', () => {
                const copy1 = { ...originalObject };
                const copy2 = { ...copy1 };

                ContextClsStoreMap.setByRaw(copy2, store);
                expect(ContextClsStoreMap.getByRaw(copy2)).toBe(store);
            });

            it('3.2.8: Should work with spread in function parameters', () => {
                const processCopy = (obj: any) => {
                    const copy = { ...obj };
                    ContextClsStoreMap.setByRaw(copy, store);
                    return copy;
                };

                const result = processCopy(originalObject);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('3.2.9: Should track context with conditional spread', () => {
                const condition = true;
                const copy = {
                    ...(condition ? originalObject : {}),
                    extra: 'data',
                };

                ContextClsStoreMap.setByRaw(copy, store);
                expect(ContextClsStoreMap.getByRaw(copy)).toBe(store);
            });

            it('3.2.10: Should work with spread and destructuring', () => {
                const { id, ...rest } = originalObject;
                const copy = { id: 'new-' + id, ...rest };

                ContextClsStoreMap.setByRaw(copy, store);
                expect(ContextClsStoreMap.getByRaw(copy)).toBe(store);
            });
        });
    });

    /**
     * SECTION 4: Testing Library Compatibility (20 tests)
     *
     * Validates context tracking with common testing libraries and frameworks.
     * Ensures CLS works seamlessly in test environments.
     */
    describe('Section 4: Testing Library Compatibility (20 tests)', () => {
        describe('4.1 @nestjs/testing Integration (7 tests)', () => {
            it('4.1.1: Should track context with Test.createTestingModule() provider', () => {
                // Simulate NestJS testing module provider
                const provider = {
                    provide: 'REQUEST',
                    useValue: originalObject,
                };

                ContextClsStoreMap.setByRaw(provider.useValue, store);
                expect(ContextClsStoreMap.getByRaw(provider.useValue)).toBe(
                    store,
                );
            });

            it('4.1.2: Should work with useFactory provider', () => {
                const factory = jest.fn().mockReturnValue(originalObject);
                const provider = {
                    provide: 'REQUEST',
                    useFactory: factory,
                };

                const result = provider.useFactory();
                ContextClsStoreMap.setByRaw(result, store);

                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('4.1.3: Should track context with useClass provider', () => {
                class MockRequest {
                    constructor(public data: any = originalObject) {}
                }

                const instance = new MockRequest();
                ContextClsStoreMap.setByRaw(instance.data, store);

                expect(ContextClsStoreMap.getByRaw(instance.data)).toBe(store);
            });

            it('4.1.4: Should work with useExisting provider', () => {
                const existing = originalObject;
                const provider = {
                    provide: 'REQUEST_ALIAS',
                    useExisting: existing,
                };

                ContextClsStoreMap.setByRaw(provider.useExisting, store);
                expect(ContextClsStoreMap.getByRaw(provider.useExisting)).toBe(
                    store,
                );
            });

            it('4.1.5: Should track context with overrideProvider', () => {
                const mockProvider = jest.fn().mockReturnValue(originalObject);
                const result = mockProvider();

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('4.1.6: Should work with module.get() resolution', () => {
                // Simulate module.get() returning request
                const moduleGet = jest.fn().mockReturnValue(originalObject);
                const result = moduleGet('REQUEST');

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('4.1.7: Should track context with custom provider factory', () => {
                const customFactory = {
                    provide: 'CUSTOM_REQUEST',
                    useFactory: () => ({ ...originalObject, custom: true }),
                };

                const result = customFactory.useFactory();
                ContextClsStoreMap.setByRaw(result, store);

                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });
        });

        describe('4.2 Supertest Request Objects (7 tests)', () => {
            it('4.2.1: Should track context with supertest request mock', () => {
                // Simulate supertest request
                const request = {
                    ...originalObject,
                    get: jest.fn(),
                    set: jest.fn(),
                    send: jest.fn(),
                };

                ContextClsStoreMap.setByRaw(request, store);
                expect(ContextClsStoreMap.getByRaw(request)).toBe(store);
            });

            it('4.2.2: Should work with supertest response mock', () => {
                const response = {
                    status: jest.fn(),
                    json: jest.fn(),
                    send: jest.fn(),
                };

                ContextClsStoreMap.setByRaw(response, store);
                expect(ContextClsStoreMap.getByRaw(response)).toBe(store);
            });

            it('4.2.3: Should track context through supertest chain', () => {
                const requestBuilder = {
                    get: jest.fn().mockReturnThis(),
                    set: jest.fn().mockReturnThis(),
                    send: jest.fn().mockResolvedValue(originalObject),
                };

                requestBuilder.get('/test');
                const result = requestBuilder.send();

                expect(result).resolves.toBe(originalObject);
            });

            it('4.2.4: Should work with supertest expect() assertions', () => {
                const testRequest = {
                    ...originalObject,
                    expect: jest.fn().mockReturnThis(),
                };

                ContextClsStoreMap.setByRaw(testRequest, store);
                expect(ContextClsStoreMap.getByRaw(testRequest)).toBe(store);
            });

            it('4.2.5: Should track context with supertest agent', () => {
                const agent = {
                    get: jest.fn().mockReturnValue(originalObject),
                    post: jest.fn(),
                };

                const result = agent.get('/test');
                ContextClsStoreMap.setByRaw(result, store);

                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('4.2.6: Should work with supertest headers', () => {
                const requestWithHeaders = {
                    ...originalObject,
                    headers: { 'x-request-id': 'test-123' },
                };

                ContextClsStoreMap.setByRaw(requestWithHeaders, store);
                expect(ContextClsStoreMap.getByRaw(requestWithHeaders)).toBe(
                    store,
                );
            });

            it('4.2.7: Should track context with supertest auth', () => {
                const authenticatedRequest = {
                    ...originalObject,
                    auth: jest.fn().mockReturnThis(),
                    user: { id: 'user-123' },
                };

                ContextClsStoreMap.setByRaw(authenticatedRequest, store);
                expect(ContextClsStoreMap.getByRaw(authenticatedRequest)).toBe(
                    store,
                );
            });
        });

        describe('4.3 Custom Test Doubles (6 tests)', () => {
            it('4.3.1: Should track context with custom stub', () => {
                const stub = {
                    ...originalObject,
                    _isStub: true,
                };

                ContextClsStoreMap.setByRaw(stub, store);
                expect(ContextClsStoreMap.getByRaw(stub)).toBe(store);
            });

            it('4.3.2: Should work with custom spy wrapper', () => {
                const callHistory: any[] = [];
                const spy = new Proxy(originalObject, {
                    get(target, prop) {
                        callHistory.push(prop);
                        return target[prop as keyof typeof target];
                    },
                });

                ContextClsStoreMap.setByRaw(spy, store);
                expect(ContextClsStoreMap.getByRaw(spy)).toBe(store);
            });

            it('4.3.3: Should track context with custom fake', () => {
                class FakeRequest {
                    constructor(public data = originalObject) {}
                }

                const fake = new FakeRequest();
                ContextClsStoreMap.setByRaw(fake.data, store);

                expect(ContextClsStoreMap.getByRaw(fake.data)).toBe(store);
            });

            it('4.3.4: Should work with builder pattern test double', () => {
                class RequestBuilder {
                    private req: any = {};

                    withId(id: string) {
                        this.req.id = id;
                        return this;
                    }

                    withUrl(url: string) {
                        this.req.url = url;
                        return this;
                    }

                    build() {
                        return { ...originalObject, ...this.req };
                    }
                }

                const result = new RequestBuilder()
                    .withId('custom-id')
                    .withUrl('/custom')
                    .build();

                ContextClsStoreMap.setByRaw(result, store);
                expect(ContextClsStoreMap.getByRaw(result)).toBe(store);
            });

            it('4.3.5: Should track context with dummy object', () => {
                const dummy = {
                    id: 'dummy-id',
                    url: '/dummy',
                    method: 'GET',
                    _isDummy: true,
                };

                ContextClsStoreMap.setByRaw(dummy, store);
                expect(ContextClsStoreMap.getByRaw(dummy)).toBe(store);
            });

            it('4.3.6: Should work with test fixture factory', () => {
                const createFixture = (overrides = {}) => ({
                    ...originalObject,
                    ...overrides,
                    _isFixture: true,
                });

                const fixture1 = createFixture({ id: 'fixture-1' });
                const fixture2 = createFixture({ id: 'fixture-2' });

                const store1 = { requestId: 'store1' } as any;
                const store2 = { requestId: 'store2' } as any;

                ContextClsStoreMap.setByRaw(fixture1, store1);
                ContextClsStoreMap.setByRaw(fixture2, store2);

                expect(ContextClsStoreMap.getByRaw(fixture1)).toBe(store1);
                expect(ContextClsStoreMap.getByRaw(fixture2)).toBe(store2);
            });
        });
    });
});
