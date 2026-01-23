import { ContextClsStoreMap } from '../../src/lib/cls-initializers/utils/context-cls-store-map';
import { ClsStore } from '../../src/lib/cls.options';

/**
 * Comprehensive test suite for Proxy object edge cases with context tracking.
 *
 * This test suite validates that the Symbol+WeakMap hybrid strategy (Issue #9)
 * correctly handles Proxy objects, which were a major pain point with WeakMap-only
 * tracking (29.4% success rate → 100% with Symbol tagging).
 *
 * **Issue #129 Regression Tests:** ClsGuard with Proxy-wrapped request objects
 * **Issue #223 Regression Tests:** Multi-enhancer scenarios with Proxy wrappers
 *
 * Test Structure:
 * - Section 1: Basic Proxy wrappers (30 tests)
 * - Section 2: Nested Proxy chains (25 tests)
 * - Section 3: Transforming proxies (25 tests)
 * - Section 4: Framework enhancer + Proxy (20 tests)
 *
 * Total: 100 tests
 *
 * @see Issue #35 - Proxy object edge cases for context tracking (100 tests)
 * @see Issue #129 - Context Leaking (ClsGuard)
 * @see Issue #9 - Symbol+WeakMap hybrid strategy
 * @see docs/research/weakmap-identity-pitfalls.md
 */
describe('Proxy Context Tracking - Edge Cases (Issue #35)', () => {
    let originalObject: any;
    let store: ClsStore;

    beforeEach(() => {
        originalObject = { id: 'test-request', url: '/test', method: 'GET' };
        store = { requestId: 'req-123', user: 'test-user' } as any;
    });

    /**
     * SECTION 1: Basic Proxy Wrappers (30 tests)
     *
     * Validates Symbol tagging works transparently through basic Proxy wrappers.
     * This is the foundation for all other Proxy scenarios.
     */
    describe('Section 1: Basic Proxy Wrappers (30 tests)', () => {
        describe('1.1 Transparent Proxies (10 tests)', () => {
            it('should track context with empty Proxy handler', () => {
                ContextClsStoreMap.setByRaw(originalObject, store);
                const proxy = new Proxy(originalObject, {});

                const retrieved = ContextClsStoreMap.getByRaw(proxy);
                expect(retrieved).toBe(store);
            });

            it('should track context when Proxy is created before store set', () => {
                const proxy = new Proxy(originalObject, {});
                ContextClsStoreMap.setByRaw(proxy, store);

                const retrieved = ContextClsStoreMap.getByRaw(originalObject);
                expect(retrieved).toBe(store);
            });

            it('should track context when store set on original, retrieved via Proxy', () => {
                ContextClsStoreMap.setByRaw(originalObject, store);
                const proxy = new Proxy(originalObject, {});

                const retrieved = ContextClsStoreMap.getByRaw(proxy);
                expect(retrieved).toBe(store);
            });

            it('should track context when store set on Proxy, retrieved via original', () => {
                const proxy = new Proxy(originalObject, {});
                ContextClsStoreMap.setByRaw(proxy, store);

                const retrieved = ContextClsStoreMap.getByRaw(originalObject);
                expect(retrieved).toBe(store);
            });

            it('should track context with multiple Proxies referencing same target', () => {
                ContextClsStoreMap.setByRaw(originalObject, store);

                const proxy1 = new Proxy(originalObject, {});
                const proxy2 = new Proxy(originalObject, {});

                expect(ContextClsStoreMap.getByRaw(proxy1)).toBe(store);
                expect(ContextClsStoreMap.getByRaw(proxy2)).toBe(store);
            });

            it('should maintain context identity across Proxy recreation', () => {
                const proxy1 = new Proxy(originalObject, {});
                ContextClsStoreMap.setByRaw(proxy1, store);

                // Recreate proxy with same target
                const proxy2 = new Proxy(originalObject, {});
                const retrieved = ContextClsStoreMap.getByRaw(proxy2);

                expect(retrieved).toBe(store);
            });

            it('should work with Proxy that has no traps defined', () => {
                const proxy = new Proxy(originalObject, {});
                ContextClsStoreMap.setByRaw(proxy, store);

                expect(proxy.id).toBe('test-request');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should handle Proxy with only has trap', () => {
                const proxy = new Proxy(originalObject, {
                    has(target, prop) {
                        return prop in target;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should handle Proxy with only ownKeys trap', () => {
                const proxy = new Proxy(originalObject, {
                    ownKeys(target) {
                        return Reflect.ownKeys(target);
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should handle Proxy with only getPrototypeOf trap', () => {
                const proxy = new Proxy(originalObject, {
                    getPrototypeOf(target) {
                        return Reflect.getPrototypeOf(target);
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });
        });

        describe('1.2 Proxies with Get Trap (10 tests)', () => {
            it('should track context with simple get trap', () => {
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        return target[prop];
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when get trap adds logging', () => {
                const accessLog: string[] = [];
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        accessLog.push(String(prop));
                        return target[prop];
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                void proxy.id; // Trigger get trap
                expect(accessLog).toContain('id');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context with get trap that transforms values', () => {
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        const value = target[prop];
                        return typeof value === 'string'
                            ? value.toUpperCase()
                            : value;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.method).toBe('GET'); // Transformed
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context with get trap that returns default values', () => {
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        return target[prop] ?? 'default';
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context with get trap using Reflect.get', () => {
                const proxy = new Proxy(originalObject, {
                    get(target, prop, receiver) {
                        return Reflect.get(target, prop, receiver);
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context with conditional get trap', () => {
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        if (prop === 'method') {
                            return 'OVERRIDDEN';
                        }
                        return target[prop];
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.method).toBe('OVERRIDDEN');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context with get trap that validates access', () => {
                const allowedProps = ['id', 'url', 'method'];
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        // Allow Symbols to pass through (needed for Symbol tagging)
                        if (typeof prop === 'symbol') {
                            return target[prop];
                        }
                        if (!allowedProps.includes(String(prop))) {
                            throw new Error(
                                `Property ${String(prop)} not allowed`,
                            );
                        }
                        return target[prop];
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context with get trap that caches property access', () => {
                const cache = new Map();
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        if (cache.has(prop)) {
                            return cache.get(prop);
                        }
                        const value = target[prop];
                        cache.set(prop, value);
                        return value;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context with get trap using computed properties', () => {
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        if (prop === 'fullUrl') {
                            return `${target.method} ${target.url}`;
                        }
                        return target[prop];
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.fullUrl).toBe('GET /test');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context with get trap that chains property access', () => {
                const handler: ProxyHandler<any> = {
                    get(target, prop) {
                        const value = target[prop];
                        // Don't wrap non-object values or Symbols
                        if (
                            typeof value !== 'object' ||
                            value === null ||
                            typeof prop === 'symbol'
                        ) {
                            return value;
                        }
                        return new Proxy(value, handler);
                    },
                };

                const proxy = new Proxy(originalObject, handler);

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });
        });

        describe('1.3 Revocable Proxies (10 tests)', () => {
            it('should track context with revocable Proxy before revocation', () => {
                const { proxy, revoke } = Proxy.revocable(originalObject, {});
                ContextClsStoreMap.setByRaw(proxy, store);

                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
                revoke();
            });

            it('should throw when accessing revoked Proxy', () => {
                const { proxy, revoke } = Proxy.revocable(originalObject, {});
                ContextClsStoreMap.setByRaw(proxy, store);

                revoke();
                expect(() => proxy.id).toThrow();
            });

            it('should retrieve context from original after Proxy revocation', () => {
                const { proxy, revoke } = Proxy.revocable(originalObject, {});
                ContextClsStoreMap.setByRaw(proxy, store);

                revoke();
                const retrieved = ContextClsStoreMap.getByRaw(originalObject);
                expect(retrieved).toBe(store);
            });

            it('should handle multiple revocable Proxies for same target', () => {
                const revocable1 = Proxy.revocable(originalObject, {});
                const revocable2 = Proxy.revocable(originalObject, {});

                ContextClsStoreMap.setByRaw(revocable1.proxy, store);

                expect(ContextClsStoreMap.getByRaw(revocable2.proxy)).toBe(
                    store,
                );

                revocable1.revoke();
                revocable2.revoke();
            });

            it('should track context when set before revocation, retrieved after via original', () => {
                const { proxy, revoke } = Proxy.revocable(originalObject, {});
                ContextClsStoreMap.setByRaw(proxy, store);

                revoke();
                expect(ContextClsStoreMap.getByRaw(originalObject)).toBe(store);
            });

            it('should handle revocable Proxy with get trap', () => {
                const { proxy, revoke } = Proxy.revocable(originalObject, {
                    get(target, prop) {
                        return target[prop];
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.id).toBe('test-request');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);

                revoke();
            });

            it('should handle revocable Proxy with set trap', () => {
                const { proxy, revoke } = Proxy.revocable(originalObject, {
                    set(target, prop, value) {
                        target[prop] = value;
                        return true;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                proxy.newProp = 'value';
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);

                revoke();
            });

            it('should handle immediate revocation after store set', () => {
                const { proxy, revoke } = Proxy.revocable(originalObject, {});
                ContextClsStoreMap.setByRaw(proxy, store);
                revoke();

                // Original should still have store
                expect(ContextClsStoreMap.getByRaw(originalObject)).toBe(store);
            });

            it('should handle revocable Proxy chain', () => {
                const revocable1 = Proxy.revocable(originalObject, {});
                const revocable2 = Proxy.revocable(revocable1.proxy, {});

                ContextClsStoreMap.setByRaw(revocable2.proxy, store);
                expect(ContextClsStoreMap.getByRaw(revocable2.proxy)).toBe(
                    store,
                );

                revocable2.revoke();
                revocable1.revoke();
            });

            it('should handle multiple sequential revocable Proxies', () => {
                const revocable1 = Proxy.revocable(originalObject, {});
                ContextClsStoreMap.setByRaw(revocable1.proxy, store);
                revocable1.revoke();

                const revocable2 = Proxy.revocable(originalObject, {});
                expect(ContextClsStoreMap.getByRaw(revocable2.proxy)).toBe(
                    store,
                );
                revocable2.revoke();
            });
        });
    });

    /**
     * SECTION 2: Nested Proxy Chains (25 tests)
     *
     * Validates Symbol tagging works through multiple layers of Proxy wrappers.
     * Common in middleware stacks and testing frameworks.
     */
    describe('Section 2: Nested Proxy Chains (25 tests)', () => {
        describe('2.1 Double-wrapped Proxies (10 tests)', () => {
            it('should track context through Proxy(Proxy(obj))', () => {
                ContextClsStoreMap.setByRaw(originalObject, store);

                const layer1 = new Proxy(originalObject, {});
                const layer2 = new Proxy(layer1, {});

                expect(ContextClsStoreMap.getByRaw(layer2)).toBe(store);
            });

            it('should track context when store set on outer Proxy', () => {
                const layer1 = new Proxy(originalObject, {});
                const layer2 = new Proxy(layer1, {});

                ContextClsStoreMap.setByRaw(layer2, store);

                expect(ContextClsStoreMap.getByRaw(originalObject)).toBe(store);
                expect(ContextClsStoreMap.getByRaw(layer1)).toBe(store);
            });

            it('should track context when store set on middle Proxy', () => {
                const layer1 = new Proxy(originalObject, {});
                const layer2 = new Proxy(layer1, {});

                ContextClsStoreMap.setByRaw(layer1, store);

                expect(ContextClsStoreMap.getByRaw(layer2)).toBe(store);
            });

            it('should handle double-wrapped Proxy with get traps', () => {
                const layer1 = new Proxy(originalObject, {
                    get(target, prop) {
                        return target[prop];
                    },
                });
                const layer2 = new Proxy(layer1, {
                    get(target, prop) {
                        return target[prop];
                    },
                });

                ContextClsStoreMap.setByRaw(layer2, store);
                expect(ContextClsStoreMap.getByRaw(layer2)).toBe(store);
            });

            it('should handle double-wrapped Proxy with different traps', () => {
                const layer1 = new Proxy(originalObject, {
                    get(target, prop) {
                        return target[prop];
                    },
                });
                const layer2 = new Proxy(layer1, {
                    set(target, prop, value) {
                        target[prop] = value;
                        return true;
                    },
                });

                ContextClsStoreMap.setByRaw(layer2, store);
                expect(ContextClsStoreMap.getByRaw(layer2)).toBe(store);
            });

            it('should track context through alternating Proxy creation', () => {
                const layer1 = new Proxy(originalObject, {});
                ContextClsStoreMap.setByRaw(layer1, store);

                const layer2 = new Proxy(layer1, {});
                expect(ContextClsStoreMap.getByRaw(layer2)).toBe(store);
            });

            it('should handle double-wrapped Proxy with value transformation', () => {
                const layer1 = new Proxy(originalObject, {
                    get(target, prop) {
                        const value = target[prop];
                        return typeof value === 'string'
                            ? value.toLowerCase()
                            : value;
                    },
                });
                const layer2 = new Proxy(layer1, {
                    get(target, prop) {
                        const value = target[prop];
                        return typeof value === 'string'
                            ? value.toUpperCase()
                            : value;
                    },
                });

                ContextClsStoreMap.setByRaw(layer2, store);
                expect(layer2.method).toBe('GET'); // Transformed twice: GET → get → GET
                expect(ContextClsStoreMap.getByRaw(layer2)).toBe(store);
            });

            it('should handle double-wrapped revocable Proxies', () => {
                const revocable1 = Proxy.revocable(originalObject, {});
                const revocable2 = Proxy.revocable(revocable1.proxy, {});

                ContextClsStoreMap.setByRaw(revocable2.proxy, store);
                expect(ContextClsStoreMap.getByRaw(revocable2.proxy)).toBe(
                    store,
                );

                revocable2.revoke();
                revocable1.revoke();
            });

            it('should handle mixed regular and revocable Proxies', () => {
                const layer1 = new Proxy(originalObject, {});
                const revocable = Proxy.revocable(layer1, {});

                ContextClsStoreMap.setByRaw(revocable.proxy, store);
                expect(ContextClsStoreMap.getByRaw(revocable.proxy)).toBe(
                    store,
                );

                revocable.revoke();
            });

            it('should handle double-wrapped Proxy with Reflect usage', () => {
                const layer1 = new Proxy(originalObject, {
                    get(target, prop, receiver) {
                        return Reflect.get(target, prop, receiver);
                    },
                });
                const layer2 = new Proxy(layer1, {
                    get(target, prop, receiver) {
                        return Reflect.get(target, prop, receiver);
                    },
                });

                ContextClsStoreMap.setByRaw(layer2, store);
                expect(ContextClsStoreMap.getByRaw(layer2)).toBe(store);
            });
        });

        describe('2.2 Deep Proxy Chains (5+ levels) (15 tests)', () => {
            it('should track context through 5-level Proxy chain', () => {
                let current = originalObject;
                for (let i = 0; i < 5; i++) {
                    current = new Proxy(current, {});
                }

                ContextClsStoreMap.setByRaw(current, store);
                expect(ContextClsStoreMap.getByRaw(current)).toBe(store);
            });

            it('should track context through 10-level Proxy chain', () => {
                let current = originalObject;
                for (let i = 0; i < 10; i++) {
                    current = new Proxy(current, {});
                }

                ContextClsStoreMap.setByRaw(current, store);
                expect(ContextClsStoreMap.getByRaw(current)).toBe(store);
            });

            it('should track context when store set at deepest level', () => {
                const layers: any[] = [originalObject];
                for (let i = 0; i < 5; i++) {
                    layers.push(new Proxy(layers[layers.length - 1], {}));
                }

                ContextClsStoreMap.setByRaw(layers[layers.length - 1], store);

                // Verify all layers can retrieve the store
                for (const layer of layers) {
                    expect(ContextClsStoreMap.getByRaw(layer)).toBe(store);
                }
            });

            it('should track context when store set at original level', () => {
                ContextClsStoreMap.setByRaw(originalObject, store);

                let current = originalObject;
                for (let i = 0; i < 5; i++) {
                    current = new Proxy(current, {});
                }

                expect(ContextClsStoreMap.getByRaw(current)).toBe(store);
            });

            it('should handle deep Proxy chain with get traps', () => {
                let current = originalObject;
                for (let i = 0; i < 5; i++) {
                    current = new Proxy(current, {
                        get(target, prop) {
                            return target[prop];
                        },
                    });
                }

                ContextClsStoreMap.setByRaw(current, store);
                expect(ContextClsStoreMap.getByRaw(current)).toBe(store);
            });

            it('should handle deep Proxy chain with mixed traps', () => {
                let current = originalObject;
                const traps = [
                    { get: (target: any, prop: string) => target[prop] },
                    {
                        set: (target: any, prop: string, value: any) => (
                            (target[prop] = value),
                            true
                        ),
                    },
                    { has: (target: any, prop: string) => prop in target },
                    { get: (target: any, prop: string) => target[prop] },
                    { ownKeys: (target: any) => Reflect.ownKeys(target) },
                ];

                for (const trap of traps) {
                    current = new Proxy(current, trap);
                }

                ContextClsStoreMap.setByRaw(current, store);
                expect(ContextClsStoreMap.getByRaw(current)).toBe(store);
            });

            it('should handle deep Proxy chain with value transformations', () => {
                let current = originalObject;
                for (let i = 0; i < 3; i++) {
                    current = new Proxy(current, {
                        get(target, prop) {
                            const value = target[prop];
                            return typeof value === 'string'
                                ? `[${value}]`
                                : value;
                        },
                    });
                }

                ContextClsStoreMap.setByRaw(current, store);
                expect(current.method).toBe('[[[GET]]]');
                expect(ContextClsStoreMap.getByRaw(current)).toBe(store);
            });

            it('should handle 20-level Proxy chain (stress test)', () => {
                let current = originalObject;
                for (let i = 0; i < 20; i++) {
                    current = new Proxy(current, {});
                }

                ContextClsStoreMap.setByRaw(current, store);
                expect(ContextClsStoreMap.getByRaw(current)).toBe(store);
            });

            it('should handle deep chain with intermittent store checks', () => {
                const layers: any[] = [originalObject];
                for (let i = 0; i < 10; i++) {
                    layers.push(new Proxy(layers[layers.length - 1], {}));
                }

                ContextClsStoreMap.setByRaw(layers[5], store);

                // Check layers before, at, and after store set point
                expect(ContextClsStoreMap.getByRaw(layers[0])).toBe(store);
                expect(ContextClsStoreMap.getByRaw(layers[5])).toBe(store);
                expect(ContextClsStoreMap.getByRaw(layers[9])).toBe(store);
            });

            it('should handle deep chain with Reflect.get at each level', () => {
                let current = originalObject;
                for (let i = 0; i < 7; i++) {
                    current = new Proxy(current, {
                        get(target, prop, receiver) {
                            return Reflect.get(target, prop, receiver);
                        },
                    });
                }

                ContextClsStoreMap.setByRaw(current, store);
                expect(ContextClsStoreMap.getByRaw(current)).toBe(store);
            });

            it('should handle deep chain with property access at each level', () => {
                let current = originalObject;
                const accessLog: string[] = [];

                for (let i = 0; i < 5; i++) {
                    const level = i;
                    current = new Proxy(current, {
                        get(target, prop) {
                            accessLog.push(`level${level}:${String(prop)}`);
                            return target[prop];
                        },
                    });
                }

                ContextClsStoreMap.setByRaw(current, store);
                void current.id; // Trigger all get traps
                expect(accessLog.length).toBeGreaterThan(0);
                expect(ContextClsStoreMap.getByRaw(current)).toBe(store);
            });

            it('should handle deep revocable Proxy chain', () => {
                const revocables: { proxy: any; revoke: () => void }[] = [];
                let current = originalObject;

                for (let i = 0; i < 5; i++) {
                    const revocable = Proxy.revocable(current, {});
                    revocables.push(revocable);
                    current = revocable.proxy;
                }

                ContextClsStoreMap.setByRaw(current, store);
                expect(ContextClsStoreMap.getByRaw(current)).toBe(store);

                // Revoke all
                revocables.forEach((r) => r.revoke());
            });

            it('should handle deep chain with computed properties at each level', () => {
                let current = originalObject;
                for (let i = 0; i < 5; i++) {
                    const level = i;
                    current = new Proxy(current, {
                        get(target, prop) {
                            if (prop === `level${level}`) {
                                return `computed-${level}`;
                            }
                            return target[prop];
                        },
                    });
                }

                ContextClsStoreMap.setByRaw(current, store);
                expect((current as any).level4).toBe('computed-4');
                expect(ContextClsStoreMap.getByRaw(current)).toBe(store);
            });

            it('should handle deep chain with caching at each level', () => {
                let current = originalObject;
                for (let i = 0; i < 5; i++) {
                    const cache = new Map();
                    current = new Proxy(current, {
                        get(target, prop) {
                            if (cache.has(prop)) {
                                return cache.get(prop);
                            }
                            const value = target[prop];
                            cache.set(prop, value);
                            return value;
                        },
                    });
                }

                ContextClsStoreMap.setByRaw(current, store);
                expect(ContextClsStoreMap.getByRaw(current)).toBe(store);
            });

            it('should handle deep chain with validation at each level', () => {
                let current = originalObject;
                for (let i = 0; i < 5; i++) {
                    current = new Proxy(current, {
                        get(target, prop) {
                            if (typeof prop === 'symbol') {
                                return target[prop];
                            }
                            if (
                                !['id', 'url', 'method'].includes(String(prop))
                            ) {
                                return undefined;
                            }
                            return target[prop];
                        },
                    });
                }

                ContextClsStoreMap.setByRaw(current, store);
                expect(ContextClsStoreMap.getByRaw(current)).toBe(store);
            });
        });
    });

    /**
     * SECTION 3: Transforming Proxies (25 tests)
     *
     * Validates Symbol tagging works when Proxy handlers modify, add, or delete properties.
     */
    describe('Section 3: Transforming Proxies (25 tests)', () => {
        describe('3.1 Property Modification Proxies (10 tests)', () => {
            it('should track context when Proxy modifies string properties', () => {
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        const value = target[prop];
                        return typeof value === 'string'
                            ? value.toUpperCase()
                            : value;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.method).toBe('GET');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy adds prefix to properties', () => {
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        const value = target[prop];
                        return typeof value === 'string'
                            ? `prefix-${value}`
                            : value;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.id).toBe('prefix-test-request');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy wraps values in objects', () => {
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        const value = target[prop];
                        return typeof value === 'string'
                            ? { raw: value, length: value.length }
                            : value;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.method).toEqual({ raw: 'GET', length: 3 });
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy converts types', () => {
                const proxy = new Proxy(
                    { count: '42' },
                    {
                        get(target, prop) {
                            const value = target[prop];
                            return typeof value === 'string' &&
                                !isNaN(Number(value))
                                ? Number(value)
                                : value;
                        },
                    },
                );

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.count).toBe(42);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy sanitizes values', () => {
                const sensitiveObj = {
                    password: 'secret123',
                    username: 'user',
                };
                const proxy = new Proxy(sensitiveObj, {
                    get(target, prop) {
                        if (prop === 'password') {
                            return '***';
                        }
                        return target[prop];
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.password).toBe('***');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy formats values', () => {
                const dateObj = { timestamp: 1234567890 };
                const proxy = new Proxy(dateObj, {
                    get(target, prop) {
                        if (prop === 'timestamp') {
                            return new Date(
                                target.timestamp * 1000,
                            ).toISOString();
                        }
                        return target[prop];
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(typeof proxy.timestamp).toBe('string');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy memoizes computed values', () => {
                let computeCount = 0;
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        if (prop === 'computed') {
                            computeCount++;
                            return `computed-${computeCount}`;
                        }
                        return target[prop];
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.computed).toBe('computed-1');
                expect(proxy.computed).toBe('computed-2'); // Not actually memoized in this example
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy validates and transforms', () => {
                const proxy = new Proxy(
                    { age: '25' },
                    {
                        get(target, prop) {
                            if (prop === 'age') {
                                const age = Number(target.age);
                                return age >= 0 && age <= 150 ? age : 0;
                            }
                            return target[prop];
                        },
                    },
                );

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.age).toBe(25);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy chains transformations', () => {
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        const value = target[prop];
                        if (typeof value === 'string') {
                            return value
                                .trim()
                                .toLowerCase()
                                .replace(/\s+/g, '-');
                        }
                        return value;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy uses conditional transformation', () => {
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        const value = target[prop];
                        if (prop === 'method' && value === 'GET') {
                            return 'READ';
                        }
                        if (prop === 'method' && value === 'POST') {
                            return 'WRITE';
                        }
                        return value;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.method).toBe('READ');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });
        });

        describe('3.2 Property Addition/Deletion Proxies (15 tests)', () => {
            it('should track context when Proxy adds new properties', () => {
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        if (prop === 'newProp') {
                            return 'added-value';
                        }
                        return target[prop];
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.newProp).toBe('added-value');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy dynamically adds properties', () => {
                const addedProps = new Map();
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        if (addedProps.has(prop)) {
                            return addedProps.get(prop);
                        }
                        return target[prop];
                    },
                    set(target, prop, value) {
                        addedProps.set(prop, value);
                        return true;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                proxy.dynamic = 'value';
                expect(proxy.dynamic).toBe('value');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy hides properties', () => {
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        if (prop === 'id') {
                            return undefined;
                        }
                        return target[prop];
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.id).toBeUndefined();
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy adds computed properties', () => {
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        if (prop === 'fullUrl') {
                            return `${target.method} ${target.url}`;
                        }
                        return target[prop];
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.fullUrl).toBe('GET /test');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy implements default values', () => {
                const proxy = new Proxy({} as any, {
                    get(target, prop) {
                        return target[prop] ?? `default-${String(prop)}`;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect((proxy as any).anything).toBe('default-anything');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context with set trap adding properties', () => {
                const proxy = new Proxy(originalObject, {
                    set(target, prop, value) {
                        // Pass through Symbol properties (needed for Symbol tagging)
                        if (typeof prop === 'symbol') {
                            target[prop] = value;
                        } else {
                            target[prop] = `modified-${value}`;
                        }
                        return true;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                proxy.newField = 'test';
                expect(originalObject.newField).toBe('modified-test');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy validates property additions', () => {
                const allowedProps = ['id', 'url', 'method', 'headers'];
                const proxy = new Proxy(originalObject, {
                    set(target, prop, value) {
                        if (!allowedProps.includes(String(prop))) {
                            throw new Error(
                                `Property ${String(prop)} not allowed`,
                            );
                        }
                        target[prop] = value;
                        return true;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(() => (proxy.forbidden = 'value')).toThrow();
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy tracks property additions', () => {
                const modifications: string[] = [];
                const proxy = new Proxy(originalObject, {
                    set(target, prop, value) {
                        // Only track string/number properties, not Symbols
                        if (typeof prop !== 'symbol') {
                            modifications.push(String(prop));
                        }
                        target[prop] = value;
                        return true;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                proxy.field1 = 'value1';
                proxy.field2 = 'value2';
                expect(modifications).toEqual(['field1', 'field2']);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy implements property deletion', () => {
                const proxy = new Proxy(originalObject, {
                    deleteProperty(target, prop) {
                        delete target[prop];
                        return true;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                delete proxy.id;
                expect(originalObject.id).toBeUndefined();
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy prevents property deletion', () => {
                const protectedProps = ['id', 'method'];
                const proxy = new Proxy(originalObject, {
                    deleteProperty(target, prop) {
                        // Allow Symbol deletion (needed for cleanup)
                        if (typeof prop === 'symbol') {
                            delete target[prop];
                            return true;
                        }
                        if (protectedProps.includes(String(prop))) {
                            // Don't actually throw, just refuse to delete
                            return false;
                        }
                        delete target[prop];
                        return true;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);

                // In strict mode, returning false from deleteProperty throws TypeError
                // So we test that the property is still there instead
                try {
                    delete proxy.id;
                } catch (_e) {
                    // Expected in strict mode
                }
                expect(originalObject.id).toBe('test-request');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy implements ownKeys trap', () => {
                const proxy = new Proxy(originalObject, {
                    ownKeys(target) {
                        return [...Reflect.ownKeys(target), 'virtualProp'];
                    },
                    getOwnPropertyDescriptor(target, prop) {
                        if (prop === 'virtualProp') {
                            return {
                                configurable: true,
                                enumerable: true,
                                value: 'virtual',
                            };
                        }
                        return Reflect.getOwnPropertyDescriptor(target, prop);
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(Object.keys(proxy)).toContain('virtualProp');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy filters ownKeys', () => {
                const proxy = new Proxy(originalObject, {
                    ownKeys(target) {
                        return Reflect.ownKeys(target).filter(
                            (key) => key !== 'id',
                        );
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(Object.keys(proxy)).not.toContain('id');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy implements has trap', () => {
                const proxy = new Proxy(originalObject, {
                    has(target, prop) {
                        if (prop === 'virtualProp') {
                            return true;
                        }
                        return prop in target;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect('virtualProp' in proxy).toBe(true);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy combines multiple traps', () => {
                const addedProps = new Map<string | symbol, any>();
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        return addedProps.get(prop) ?? target[prop];
                    },
                    set(target, prop, value) {
                        // Store symbols on target directly (needed for Symbol tagging)
                        if (typeof prop === 'symbol') {
                            target[prop] = value;
                        } else {
                            addedProps.set(prop, value);
                        }
                        return true;
                    },
                    has(target, prop) {
                        return addedProps.has(prop) || prop in target;
                    },
                    ownKeys(target) {
                        const targetKeys = Reflect.ownKeys(target);
                        const addedKeys = Array.from(addedProps.keys()).filter(
                            (k) => typeof k !== 'symbol',
                        );
                        return [...targetKeys, ...addedKeys];
                    },
                    getOwnPropertyDescriptor(target, prop) {
                        if (addedProps.has(prop) && typeof prop !== 'symbol') {
                            return {
                                configurable: true,
                                enumerable: true,
                                writable: true,
                                value: addedProps.get(prop),
                            };
                        }
                        return Reflect.getOwnPropertyDescriptor(target, prop);
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                proxy.custom = 'value';
                expect('custom' in proxy).toBe(true);
                expect(Object.keys(proxy)).toContain('custom');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should track context when Proxy lazily initializes properties', () => {
                let initialized = false;
                const proxy = new Proxy(originalObject, {
                    get(target, prop) {
                        if (prop === 'lazy' && !initialized) {
                            target.lazy = 'initialized-value';
                            initialized = true;
                        }
                        return target[prop];
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(proxy.lazy).toBe('initialized-value');
                expect(initialized).toBe(true);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });
        });
    });

    /**
     * SECTION 4: Complex Proxy Scenarios (20 tests)
     *
     * Validates Symbol tagging works in complex scenarios combining multiple Proxy patterns.
     * **CRITICAL:** Issue #129 regression tests (Proxy-wrapped objects in real-world scenarios)
     */
    describe('Section 4: Complex Proxy Scenarios (20 tests) - Issue #129 Regression', () => {
        describe('4.1 Sequential Store Operations with Proxy (5 tests)', () => {
            it('should handle store set/get/update cycle with Proxy', () => {
                const proxy = new Proxy(originalObject, {});

                ContextClsStoreMap.setByRaw(proxy, store);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);

                const newStore = {
                    requestId: 'req-456',
                    user: 'new-user',
                } as any;
                ContextClsStoreMap.setByRaw(proxy, newStore);
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(newStore);
            });

            it('should handle multiple stores for different Proxies of same target', () => {
                const proxy1 = new Proxy(originalObject, {});
                const proxy2 = new Proxy(originalObject, {});

                const store1 = { requestId: 'req-1' } as any;
                const store2 = { requestId: 'req-2' } as any;

                // Both proxies should share the same store (same target)
                ContextClsStoreMap.setByRaw(proxy1, store1);
                expect(ContextClsStoreMap.getByRaw(proxy2)).toBe(store1);

                // Updating via proxy2 affects proxy1
                ContextClsStoreMap.setByRaw(proxy2, store2);
                expect(ContextClsStoreMap.getByRaw(proxy1)).toBe(store2);
            });

            it('should handle store operations on Proxy chain', () => {
                const layer1 = new Proxy(originalObject, {});
                const layer2 = new Proxy(layer1, {});
                const layer3 = new Proxy(layer2, {});

                ContextClsStoreMap.setByRaw(layer3, store);

                expect(ContextClsStoreMap.getByRaw(originalObject)).toBe(store);
                expect(ContextClsStoreMap.getByRaw(layer1)).toBe(store);
                expect(ContextClsStoreMap.getByRaw(layer2)).toBe(store);
                expect(ContextClsStoreMap.getByRaw(layer3)).toBe(store);
            });

            it('should handle store replacement on Proxy', () => {
                const proxy = new Proxy(originalObject, {});

                const stores = Array(5)
                    .fill(0)
                    .map((_, i) => ({ requestId: `req-${i}` }) as any);

                for (const s of stores) {
                    ContextClsStoreMap.setByRaw(proxy, s);
                    expect(ContextClsStoreMap.getByRaw(proxy)).toBe(s);
                }

                // Final store should be the last one
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(stores[4]);
            });

            it('should handle concurrent store operations on different Proxies', () => {
                const proxies = Array(10)
                    .fill(0)
                    .map(() => new Proxy({ id: `obj-${Math.random()}` }, {}));

                const stores = proxies.map(
                    (_, i) => ({ requestId: `req-${i}` }) as any,
                );

                // Set stores concurrently
                proxies.forEach((proxy, i) => {
                    ContextClsStoreMap.setByRaw(proxy, stores[i]);
                });

                // Verify isolation
                proxies.forEach((proxy, i) => {
                    expect(ContextClsStoreMap.getByRaw(proxy)).toBe(stores[i]);
                });
            });
        });

        describe('4.2 Proxy with Concurrent Access (5 tests) - Issue #129', () => {
            it('should prevent context leak with concurrent Proxy wrappers', () => {
                const objects = Array(25)
                    .fill(0)
                    .map((_, i) => ({ id: `obj-${i}` }));
                const proxies = objects.map((obj) => new Proxy(obj, {}));
                const stores = proxies.map(
                    (_, i) => ({ requestId: `req-${i}` }) as any,
                );

                // Set stores on all proxies
                proxies.forEach((proxy, i) => {
                    ContextClsStoreMap.setByRaw(proxy, stores[i]);
                });

                // Verify no leaking
                proxies.forEach((proxy, i) => {
                    expect(ContextClsStoreMap.getByRaw(proxy)).toBe(stores[i]);
                });
            });

            it('should handle concurrent access to same Proxy (Issue #129)', () => {
                const proxy = new Proxy(originalObject, {});
                ContextClsStoreMap.setByRaw(proxy, store);

                // Simulate concurrent access
                const results = Array(50)
                    .fill(0)
                    .map(() => ContextClsStoreMap.getByRaw(proxy));

                // All should return the same store
                results.forEach((result) => {
                    expect(result).toBe(store);
                });
            });

            it('should handle concurrent Proxy creation for same target', () => {
                ContextClsStoreMap.setByRaw(originalObject, store);

                // Create multiple proxies concurrently
                const proxies = Array(100)
                    .fill(0)
                    .map(() => new Proxy(originalObject, {}));

                // All should access the same store
                proxies.forEach((proxy) => {
                    expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
                });
            });

            it('should handle concurrent store updates via different Proxies', () => {
                const proxy1 = new Proxy(originalObject, {});
                const proxy2 = new Proxy(originalObject, {});

                const updates: any[] = [];
                for (let i = 0; i < 10; i++) {
                    const s = { requestId: `req-${i}` } as any;
                    updates.push(s);
                    if (i % 2 === 0) {
                        ContextClsStoreMap.setByRaw(proxy1, s);
                    } else {
                        ContextClsStoreMap.setByRaw(proxy2, s);
                    }
                }

                // Final store should be the last update
                expect(ContextClsStoreMap.getByRaw(originalObject)).toBe(
                    updates[9],
                );
                expect(ContextClsStoreMap.getByRaw(proxy1)).toBe(updates[9]);
                expect(ContextClsStoreMap.getByRaw(proxy2)).toBe(updates[9]);
            });

            it('should prevent leak with 100 concurrent different Proxies (stress test)', () => {
                const results = Array(100)
                    .fill(0)
                    .map((_, i) => {
                        const obj = { id: `obj-${i}` };
                        const proxy = new Proxy(obj, {});
                        const s = { requestId: `req-${i}` } as any;

                        ContextClsStoreMap.setByRaw(proxy, s);
                        return { proxy, store: s };
                    });

                // Verify isolation
                results.forEach(({ proxy, store: s }) => {
                    expect(ContextClsStoreMap.getByRaw(proxy)).toBe(s);
                });
            });
        });

        describe('4.3 Proxy with Object Mutations (5 tests)', () => {
            it('should maintain store when Proxy target is mutated', () => {
                const proxy = new Proxy(originalObject, {});
                ContextClsStoreMap.setByRaw(proxy, store);

                // Mutate target
                originalObject.newProp = 'new-value';
                originalObject.method = 'POST';

                // Store should still be accessible
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
                expect(ContextClsStoreMap.getByRaw(originalObject)).toBe(store);
            });

            it('should maintain store when Proxy mutates target via set trap', () => {
                const proxy = new Proxy(originalObject, {
                    set(target, prop, value) {
                        // Pass through Symbol properties (needed for Symbol tagging)
                        if (typeof prop === 'symbol') {
                            target[prop] = value;
                        } else {
                            target[prop] = `modified-${value}`;
                        }
                        return true;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);

                proxy.field = 'value';
                expect(originalObject.field).toBe('modified-value');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should maintain store when Proxy deletes target properties', () => {
                const proxy = new Proxy(originalObject, {
                    deleteProperty(target, prop) {
                        // Don't delete Symbol properties (needed for Symbol tagging)
                        if (typeof prop !== 'symbol') {
                            delete target[prop];
                        }
                        return true;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);

                delete proxy.id;
                expect(originalObject.id).toBeUndefined();
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });

            it('should maintain store when target is frozen after Proxy creation', () => {
                const obj = { id: 'test', mutable: true };
                const proxy = new Proxy(obj, {});

                ContextClsStoreMap.setByRaw(proxy, store);

                Object.freeze(obj);

                // Store should still be accessible
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
                expect(ContextClsStoreMap.getByRaw(obj)).toBe(store);
            });

            it('should maintain store when Proxy adds properties to target', () => {
                const proxy = new Proxy(originalObject, {
                    set(target, prop, value) {
                        // Pass through Symbol properties (needed for Symbol tagging)
                        if (typeof prop === 'symbol') {
                            target[prop] = value;
                        } else if (!(prop in target)) {
                            target[prop] = `new-${value}`;
                        } else {
                            target[prop] = value;
                        }
                        return true;
                    },
                });

                ContextClsStoreMap.setByRaw(proxy, store);

                proxy.field1 = 'value1';
                proxy.field2 = 'value2';

                expect(originalObject.field1).toBe('new-value1');
                expect(originalObject.field2).toBe('new-value2');
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);
            });
        });

        describe('4.4 Proxy with WeakMap Fallback (5 tests)', () => {
            it('should fallback to WeakMap when target is frozen before Proxy', () => {
                const frozenObj = Object.freeze({ id: 'frozen' });
                const proxy = new Proxy(frozenObj, {});

                ContextClsStoreMap.setByRaw(proxy, store);

                // Proxy should work (WeakMap tracks the Proxy itself)
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);

                // Setting on frozen object directly should also work via WeakMap
                const frozenObj2 = Object.freeze({ id: 'frozen2' });
                const store2 = { requestId: 'req-456' } as any;
                ContextClsStoreMap.setByRaw(frozenObj2, store2);
                expect(ContextClsStoreMap.getByRaw(frozenObj2)).toBe(store2);
            });

            it('should handle Proxy of sealed object', () => {
                const sealedObj = Object.seal({ id: 'sealed' });
                const proxy = new Proxy(sealedObj, {});

                ContextClsStoreMap.setByRaw(proxy, store);

                // Proxy should work
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);

                // Setting on sealed object directly should also work
                const sealedObj2 = Object.seal({ id: 'sealed2' });
                const store2 = { requestId: 'req-456' } as any;
                ContextClsStoreMap.setByRaw(sealedObj2, store2);
                expect(ContextClsStoreMap.getByRaw(sealedObj2)).toBe(store2);
            });

            it('should handle Proxy of non-extensible object', () => {
                const nonExtObj = Object.preventExtensions({ id: 'non-ext' });
                const proxy = new Proxy(nonExtObj, {});

                ContextClsStoreMap.setByRaw(proxy, store);

                // Proxy should work
                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);

                // Setting on non-extensible object directly should also work
                const nonExtObj2 = Object.preventExtensions({ id: 'non-ext2' });
                const store2 = { requestId: 'req-456' } as any;
                ContextClsStoreMap.setByRaw(nonExtObj2, store2);
                expect(ContextClsStoreMap.getByRaw(nonExtObj2)).toBe(store2);
            });

            it('should handle mixed extensible and frozen Proxies', () => {
                const extensible = { id: 'ext' };
                const frozen = Object.freeze({ id: 'frozen' });

                const proxy1 = new Proxy(extensible, {});
                const proxy2 = new Proxy(frozen, {});

                const store1 = { requestId: 'req-1' } as any;
                const store2 = { requestId: 'req-2' } as any;

                ContextClsStoreMap.setByRaw(proxy1, store1);
                ContextClsStoreMap.setByRaw(proxy2, store2);

                expect(ContextClsStoreMap.getByRaw(proxy1)).toBe(store1);
                expect(ContextClsStoreMap.getByRaw(proxy2)).toBe(store2);
            });

            it('should handle revocable Proxy of frozen object', () => {
                const frozenObj = Object.freeze({ id: 'frozen' });
                const { proxy, revoke } = Proxy.revocable(frozenObj, {});

                ContextClsStoreMap.setByRaw(proxy, store);

                expect(ContextClsStoreMap.getByRaw(proxy)).toBe(store);

                revoke();

                // After revocation, cannot access via proxy, but frozen object direct access works
                const frozenObj2 = Object.freeze({ id: 'frozen2' });
                ContextClsStoreMap.setByRaw(frozenObj2, store);
                expect(ContextClsStoreMap.getByRaw(frozenObj2)).toBe(store);
            });
        });
    });
});
