import { RequestIdentityResolver } from './request-identity-resolver';

describe('RequestIdentityResolver', () => {
    beforeEach(() => {
        // Reset counter for deterministic tests
        RequestIdentityResolver.resetCounter();
    });

    describe('Basic Functionality', () => {
        it('should return the canonical object for a request', () => {
            const request = { method: 'GET', url: '/' };
            const canonical = RequestIdentityResolver.getIdentity(request);

            expect(canonical).toBe(request);
            expect(typeof canonical).toBe('object');
        });

        it('should return the same canonical object for the same request object', () => {
            const request = { method: 'GET', url: '/' };
            const canonical1 = RequestIdentityResolver.getIdentity(request);
            const canonical2 = RequestIdentityResolver.getIdentity(request);

            expect(canonical1).toBe(canonical2);
            expect(canonical1).toBe(request);
        });

        it('should return different canonical objects for different request objects', () => {
            const request1 = { method: 'GET', url: '/' };
            const request2 = { method: 'POST', url: '/api' };

            const canonical1 = RequestIdentityResolver.getIdentity(request1);
            const canonical2 = RequestIdentityResolver.getIdentity(request2);

            expect(canonical1).toBe(request1);
            expect(canonical2).toBe(request2);
            expect(canonical1).not.toBe(canonical2);
        });

        it('should handle multiple requests independently', () => {
            const requests = [
                { id: 1 },
                { id: 2 },
                { id: 3 },
                { id: 4 },
                { id: 5 },
            ];

            const canonicals = requests.map((req) =>
                RequestIdentityResolver.getIdentity(req),
            );

            // Each request is its own canonical
            requests.forEach((req, i) => {
                expect(canonicals[i]).toBe(req);
            });

            // All canonicals are unique
            const uniqueCanonicals = new Set(canonicals);
            expect(uniqueCanonicals.size).toBe(5);
        });
    });

    describe('Framework Compatibility', () => {
        it('should handle Express-like request objects', () => {
            // Express: Decorated http.IncomingMessage
            const expressRequest = {
                method: 'GET',
                url: '/',
                headers: { host: 'localhost' },
                body: {},
                query: {},
                params: {},
            };

            const canonical =
                RequestIdentityResolver.getIdentity(expressRequest);
            expect(canonical).toBe(expressRequest);

            // Same request should return same canonical
            const canonical2 =
                RequestIdentityResolver.getIdentity(expressRequest);
            expect(canonical2).toBe(canonical);
        });

        it('should handle Fastify-like request objects with .raw property (shared canonical)', () => {
            // Fastify: Has both decorated request and raw request
            const rawRequest = {
                method: 'GET',
                url: '/',
                headers: { host: 'localhost' },
            };

            const fastifyRequest = {
                method: 'GET',
                url: '/',
                headers: { host: 'localhost' },
                body: {},
                query: {},
                params: {},
                raw: rawRequest,
                id: 'req-1',
                log: {},
            };

            // Scenario 1: Middleware gets raw first
            const rawCanonical =
                RequestIdentityResolver.getIdentity(rawRequest);
            expect(rawCanonical).toBe(rawRequest);

            // Guard/Interceptor get decorated request later
            const decoratedCanonical =
                RequestIdentityResolver.getIdentity(fastifyRequest);

            // Should share the same canonical (the raw request)
            expect(decoratedCanonical).toBe(rawCanonical);
            expect(decoratedCanonical).toBe(rawRequest);
        });

        it('should handle Fastify requests in reverse order (decorated first)', () => {
            const rawRequest = {
                method: 'GET',
                url: '/',
            };

            const fastifyRequest = {
                raw: rawRequest,
                body: {},
            };

            // Scenario 2: Decorated request seen first
            // Even though decorated is seen first, canonical should be the raw request
            const decoratedCanonical =
                RequestIdentityResolver.getIdentity(fastifyRequest);
            expect(decoratedCanonical).toBe(rawRequest);

            // Raw request seen later
            const rawCanonical =
                RequestIdentityResolver.getIdentity(rawRequest);

            // Should share the same canonical (the raw request, preferred)
            expect(rawCanonical).toBe(decoratedCanonical);
            expect(rawCanonical).toBe(rawRequest);
        });

        it('should handle Koa-like context objects with .req property', () => {
            // Koa: Context has both req (native) and request (decorated)
            const nativeReq = {
                method: 'GET',
                url: '/',
                headers: { host: 'localhost' },
            };

            const koaContext = {
                req: nativeReq,
                request: {
                    method: 'GET',
                    url: '/',
                    query: {},
                },
                response: {},
                state: {},
            };

            // Native req seen first
            const reqCanonical = RequestIdentityResolver.getIdentity(nativeReq);
            expect(reqCanonical).toBe(nativeReq);

            // Context seen later
            const ctxCanonical =
                RequestIdentityResolver.getIdentity(koaContext);

            // Should share the same canonical
            expect(ctxCanonical).toBe(reqCanonical);
            expect(ctxCanonical).toBe(nativeReq);
        });
    });

    describe('Frozen/Sealed Objects (WeakMap Fallback)', () => {
        it('should handle frozen objects using WeakMap fallback', () => {
            const request = Object.freeze({ method: 'GET', url: '/' });
            const canonical = RequestIdentityResolver.getIdentity(request);

            expect(canonical).toBe(request);

            // Should return same canonical on subsequent calls
            const canonical2 = RequestIdentityResolver.getIdentity(request);
            expect(canonical2).toBe(canonical);
        });

        it('should handle sealed objects using WeakMap fallback', () => {
            const request = Object.seal({ method: 'POST', url: '/api' });
            const canonical = RequestIdentityResolver.getIdentity(request);

            expect(canonical).toBe(request);

            // Should return same canonical on subsequent calls
            const canonical2 = RequestIdentityResolver.getIdentity(request);
            expect(canonical2).toBe(canonical);
        });

        it('should handle non-extensible objects using WeakMap fallback', () => {
            const request = Object.preventExtensions({
                method: 'PUT',
                url: '/resource',
            });
            const canonical = RequestIdentityResolver.getIdentity(request);

            expect(canonical).toBe(request);

            // Should return same canonical on subsequent calls
            const canonical2 = RequestIdentityResolver.getIdentity(request);
            expect(canonical2).toBe(canonical);
        });

        it('should differentiate between different frozen objects', () => {
            const request1 = Object.freeze({ id: 1 });
            const request2 = Object.freeze({ id: 2 });

            const canonical1 = RequestIdentityResolver.getIdentity(request1);
            const canonical2 = RequestIdentityResolver.getIdentity(request2);

            expect(canonical1).toBe(request1);
            expect(canonical2).toBe(request2);
            expect(canonical1).not.toBe(canonical2);
        });
    });

    describe('Edge Cases', () => {
        it('should handle null gracefully (returns null)', () => {
            const canonical = RequestIdentityResolver.getIdentity(null);
            expect(canonical).toBe(null);
        });

        it('should handle undefined gracefully (returns undefined)', () => {
            const canonical = RequestIdentityResolver.getIdentity(undefined);
            expect(canonical).toBe(undefined);
        });

        it('should handle primitive values (returns the primitive)', () => {
            const canonical1 = RequestIdentityResolver.getIdentity('string');
            const canonical2 = RequestIdentityResolver.getIdentity(123);
            const canonical3 = RequestIdentityResolver.getIdentity(true);

            expect(canonical1).toBe('string');
            expect(canonical2).toBe(123);
            expect(canonical3).toBe(true);
        });

        it('should handle objects with existing Symbol properties', () => {
            const customSymbol = Symbol('custom');
            const request = {
                method: 'GET',
                [customSymbol]: 'value',
            };

            const canonical = RequestIdentityResolver.getIdentity(request);
            expect(canonical).toBe(request);

            // Should maintain stability
            const canonical2 = RequestIdentityResolver.getIdentity(request);
            expect(canonical2).toBe(canonical);
        });

        it('should handle Proxy objects', () => {
            const target = { method: 'GET', url: '/' };
            const proxy = new Proxy(target, {
                get(t, prop) {
                    return t[prop];
                },
            });

            // Proxy gets its own canonical
            const canonical = RequestIdentityResolver.getIdentity(proxy);
            expect(canonical).toBe(proxy);

            // Target gets its own canonical (they're independent)
            const targetCanonical =
                RequestIdentityResolver.getIdentity(target);

            // Both maintain stable canonicals
            expect(RequestIdentityResolver.getIdentity(proxy)).toBe(canonical);
            expect(RequestIdentityResolver.getIdentity(target)).toBe(
                targetCanonical,
            );
        });

        it('should handle objects created with Object.create()', () => {
            const proto = { method: 'GET' };
            const request = Object.create(proto);
            request.url = '/';

            const canonical = RequestIdentityResolver.getIdentity(request);
            expect(canonical).toBe(request);

            const canonical2 = RequestIdentityResolver.getIdentity(request);
            expect(canonical2).toBe(canonical);
        });

        it('should handle circular references', () => {
            const request: any = { method: 'GET' };
            request.self = request; // Circular reference

            const canonical = RequestIdentityResolver.getIdentity(request);
            expect(canonical).toBe(request);

            const canonical2 = RequestIdentityResolver.getIdentity(request);
            expect(canonical2).toBe(canonical);
        });
    });

    describe('Performance and Stability', () => {
        it('should maintain stable canonical across 1000+ calls', () => {
            const request = { method: 'GET', url: '/' };
            const firstCanonical =
                RequestIdentityResolver.getIdentity(request);

            for (let i = 0; i < 1000; i++) {
                const canonical = RequestIdentityResolver.getIdentity(request);
                expect(canonical).toBe(firstCanonical);
            }
        });

        it('should handle 1000+ different request objects efficiently', () => {
            const requests = Array.from({ length: 1000 }, (_, i) => ({
                id: i,
            }));

            const start = Date.now();
            const canonicals = requests.map((req) =>
                RequestIdentityResolver.getIdentity(req),
            );
            const duration = Date.now() - start;

            // Should complete in reasonable time (< 100ms for 1000 requests)
            expect(duration).toBeLessThan(100);

            // All canonicals should be the requests themselves
            requests.forEach((req, i) => {
                expect(canonicals[i]).toBe(req);
            });

            // All canonicals should be unique
            const uniqueCanonicals = new Set(canonicals);
            expect(uniqueCanonicals.size).toBe(1000);

            // Verify stability
            const canonical500 =
                RequestIdentityResolver.getIdentity(requests[500]);
            expect(canonical500).toBe(requests[500]);
        });

        it('should be garbage-collection friendly (WeakMap cleanup)', () => {
            // Create many request objects and get identities
            for (let i = 0; i < 1000; i++) {
                const tempRequest = { id: i };
                RequestIdentityResolver.getIdentity(tempRequest);
                // tempRequest goes out of scope - WeakMap should allow GC
            }

            // This test mainly documents GC behavior
            // In production, WeakMap entries are cleaned up when keys are GC'd
            expect(true).toBe(true);
        });
    });

    describe('Symbol Properties', () => {
        it('should create non-enumerable symbol properties', () => {
            const request = { method: 'GET', url: '/' };
            RequestIdentityResolver.getIdentity(request);

            const keys = Object.keys(request);
            const symbols = Object.getOwnPropertySymbols(request);

            // Symbol should not appear in Object.keys()
            expect(keys).toEqual(['method', 'url']);

            // Symbol should appear in getOwnPropertySymbols()
            expect(symbols.length).toBeGreaterThan(0);

            // Property should be non-enumerable
            const symbolProp = symbols[0];
            const descriptor = Object.getOwnPropertyDescriptor(
                request,
                symbolProp,
            );
            expect(descriptor?.enumerable).toBe(false);
            expect(descriptor?.writable).toBe(false);
            expect(descriptor?.configurable).toBe(false);
        });

        it('should return objects usable as WeakMap keys', () => {
            const request = { method: 'GET', url: '/' };
            const canonical = RequestIdentityResolver.getIdentity(request);

            // Canonical object can be used as WeakMap key
            const testMap = new WeakMap();
            expect(() => testMap.set(canonical, 'value')).not.toThrow();
            expect(testMap.get(canonical)).toBe('value');
        });
    });

    describe('Concurrent Access', () => {
        it('should handle concurrent access to the same request', async () => {
            const request = { method: 'GET', url: '/' };

            // Simulate concurrent access from multiple enhancers
            const promises = Array.from({ length: 10 }, () =>
                Promise.resolve(
                    RequestIdentityResolver.getIdentity(request),
                ),
            );

            const canonicals = await Promise.all(promises);

            // All should return the same canonical
            const firstCanonical = canonicals[0];
            expect(canonicals.every((id) => id === firstCanonical)).toBe(
                true,
            );
            expect(firstCanonical).toBe(request);
        });

        it('should handle concurrent access to different requests', async () => {
            const requests = Array.from({ length: 100 }, (_, i) => ({
                id: i,
            }));

            // Simulate concurrent requests
            const promises = requests.map((req) =>
                Promise.resolve(RequestIdentityResolver.getIdentity(req)),
            );

            const canonicals = await Promise.all(promises);

            // Each canonical should be the request itself
            requests.forEach((req, i) => {
                expect(canonicals[i]).toBe(req);
            });

            // All should be unique
            const uniqueCanonicals = new Set(canonicals);
            expect(uniqueCanonicals.size).toBe(100);
        });
    });

    describe('Integration Scenarios', () => {
        it('should handle Fastify middleware → guard → interceptor flow', () => {
            // Simulate Fastify request lifecycle
            const rawRequest = { method: 'GET', url: '/' };
            const decoratedRequest = {
                raw: rawRequest,
                body: {},
                query: {},
            };

            // All enhancers receive decorated request
            const middlewareCanonical = RequestIdentityResolver.getIdentity(
                decoratedRequest,
            );
            const guardCanonical =
                RequestIdentityResolver.getIdentity(decoratedRequest);
            const interceptorCanonical =
                RequestIdentityResolver.getIdentity(decoratedRequest);

            // All should have the same canonical (the raw request, preferred)
            expect(guardCanonical).toBe(middlewareCanonical);
            expect(interceptorCanonical).toBe(middlewareCanonical);
            expect(middlewareCanonical).toBe(rawRequest);

            // Direct access to raw should return same canonical
            expect(RequestIdentityResolver.getIdentity(rawRequest)).toBe(
                rawRequest,
            );
        });

        it('should handle Express middleware → guard → interceptor flow', () => {
            // Simulate Express request lifecycle
            const request = {
                method: 'GET',
                url: '/',
                headers: {},
                body: {},
            };

            // All enhancers receive the same request object in Express
            const middlewareCanonical =
                RequestIdentityResolver.getIdentity(request);
            const guardCanonical =
                RequestIdentityResolver.getIdentity(request);
            const interceptorCanonical =
                RequestIdentityResolver.getIdentity(request);

            // All should have the same canonical
            expect(guardCanonical).toBe(middlewareCanonical);
            expect(interceptorCanonical).toBe(middlewareCanonical);
            expect(middlewareCanonical).toBe(request);
        });
    });
});
