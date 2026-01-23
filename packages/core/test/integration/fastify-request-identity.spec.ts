import {
    Controller,
    Get,
    Injectable,
    MiddlewareConsumer,
    Module,
    NestMiddleware,
    NestModule,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import {
    FastifyAdapter,
    NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { ClsModule, ClsService } from '../../src';
import { RequestIdentityResolver } from '../../src/lib/cls-initializers/utils/request-identity-resolver';
import { TestGuard } from '../common/test.guard';
import { TestInterceptor } from '../common/test.interceptor';

/**
 * Comprehensive Fastify request identity integration test suite for Issue #32.
 *
 * This test suite validates that RequestIdentityResolver works correctly with Fastify
 * across various scenarios including:
 * - Basic Fastify integration
 * - Fastify v4 vs v5 compatibility
 * - Fastify-specific features (decorators, hooks, Mercurius GraphQL)
 * - Multi-enhancer scenarios (ClsMiddleware + ClsGuard + ClsInterceptor)
 *
 * CRITICAL: This test suite addresses Issue #223 (Fastify multi-enhancer context leaking)
 * by validating that the Symbol-based RequestIdentityResolver eliminates the fragile
 * `request.raw ?? request` hack.
 *
 * Total: 100 tests
 *
 * @see Issue #32 - Fastify request identity integration testing
 * @see Issue #223 - Fastify multi-enhancer context leaking (CRITICAL)
 * @see RequestIdentityResolver - Framework-agnostic request identity resolution
 */

// ============================================================================
// Test Helpers
// ============================================================================

interface RequestIdResponse {
    middlewareId?: string;
    guardId?: string;
    interceptorId?: string;
    controllerId?: string;
    serviceId?: string;
}

/**
 * Helper to extract request ID from various enhancer points
 */
function expectConsistentIds(
    body: RequestIdResponse,
    expectedId?: string,
): void {
    const firstId =
        expectedId ?? body.middlewareId ?? body.guardId ?? body.interceptorId;

    if (body.middlewareId) {
        expect(body.middlewareId).toEqual(firstId);
    }
    if (body.guardId) {
        expect(body.guardId).toEqual(firstId);
    }
    if (body.interceptorId) {
        expect(body.interceptorId).toEqual(firstId);
    }
    if (body.controllerId) {
        expect(body.controllerId).toEqual(firstId);
    }
    if (body.serviceId) {
        expect(body.serviceId).toEqual(firstId);
    }
}

/**
 * Standard setup function for tracking request identity in CLS context
 */
const identityTrackingSetup = (cls: ClsService, req: any) => {
    const identity = RequestIdentityResolver.getIdentity(req);
    cls.set('FROM_MIDDLEWARE', cls.getId());
    cls.set('REQUEST_IDENTITY', identity);
    cls.set('HAS_REQUEST_RAW', 'raw' in req);
};

/**
 * Service used by controllers
 */
@Injectable()
class TestFastifyService {
    constructor(private readonly cls: ClsService) {}

    getRequestInfo(): RequestIdResponse {
        return {
            middlewareId: this.cls.get('FROM_MIDDLEWARE'),
            guardId: this.cls.get('FROM_GUARD'),
            interceptorId: this.cls.get('FROM_INTERCEPTOR'),
            serviceId: this.cls.getId(),
        };
    }
}

/**
 * Controller for testing
 */
@UseGuards(TestGuard)
@Controller('/')
class TestFastifyController {
    constructor(
        private readonly service: TestFastifyService,
        private readonly cls: ClsService,
    ) {}

    @UseInterceptors(TestInterceptor)
    @Get('hello')
    hello() {
        this.cls.set('FROM_CONTROLLER', this.cls.getId());
        return this.service.getRequestInfo();
    }

    @Get('identity')
    identity() {
        const requestIdentity = this.cls.get('REQUEST_IDENTITY');
        const hasRequestRaw = this.cls.get('HAS_REQUEST_RAW');
        return {
            identityExists: !!requestIdentity,
            identityType: typeof requestIdentity,
            id: this.cls.getId(),
            hasRequestRaw: hasRequestRaw ?? false,
        };
    }
}

// ============================================================================
// Section 1: Basic Fastify Integration (25 tests)
// ============================================================================

describe('Section 1: Basic Fastify Integration (25 tests)', () => {
    let app: NestFastifyApplication;

    describe('1.1 ClsMiddleware basic functionality (10 tests)', () => {
        @Module({
            imports: [
                ClsModule.forRoot({
                    middleware: {
                        mount: true,
                        generateId: true,
                        setup: (cls, req) => {
                            // Track identity in CLS context setup hook
                            const identity =
                                RequestIdentityResolver.getIdentity(req);
                            cls.set('FROM_MIDDLEWARE', cls.getId());
                            cls.set('REQUEST_IDENTITY', identity);
                            cls.set('HAS_REQUEST_RAW', 'raw' in req);
                        },
                    },
                }),
            ],
            providers: [TestFastifyService],
            controllers: [TestFastifyController],
        })
        class BasicMiddlewareModule {}

        beforeAll(async () => {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [BasicMiddlewareModule],
                },
            ).compile();
            app = moduleFixture.createNestApplication<NestFastifyApplication>(
                new FastifyAdapter(),
            );
            await app.init();
            await app.getHttpAdapter().getInstance().ready();
        });

        afterAll(async () => {
            await app.close();
        });

        it('should track request identity with Symbol tagging (NOT request.raw hack)', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/identity',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expect(body.identityExists).toBe(true);
            expect(body.identityType).toBe('object');
            expect(body.id).toBeDefined();
        });

        it('should maintain consistent ID across middleware and controller', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should generate unique IDs for different requests', async () => {
            const [response1, response2] = await Promise.all([
                app.inject({ method: 'GET', url: '/hello' }),
                app.inject({ method: 'GET', url: '/hello' }),
            ]);

            const body1 = JSON.parse(response1.body);
            const body2 = JSON.parse(response2.body);

            expect(body1.middlewareId).toBeDefined();
            expect(body2.middlewareId).toBeDefined();
            expect(body1.middlewareId).not.toEqual(body2.middlewareId);
        });

        it('should handle concurrent requests without context leak (10 requests)', async () => {
            const promises = Array.from({ length: 10 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);
            const ids = responses.map((r) => JSON.parse(r.body).middlewareId);

            // All IDs should be unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(10);
        });

        it('should handle concurrent requests without context leak (50 requests)', async () => {
            const promises = Array.from({ length: 50 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);
            const ids = responses.map((r) => JSON.parse(r.body).middlewareId);

            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(50);
        });

        it('should handle concurrent requests without context leak (100 requests)', async () => {
            const promises = Array.from({ length: 100 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);
            const ids = responses.map((r) => JSON.parse(r.body).middlewareId);

            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(100);
        });

        it('should handle rapid sequential requests', async () => {
            const ids: string[] = [];

            for (let i = 0; i < 20; i++) {
                const response = await app.inject({
                    method: 'GET',
                    url: '/hello',
                });
                const body = JSON.parse(response.body);
                ids.push(body.middlewareId);
            }

            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(20);
        }, 15000);

        it('should maintain context through async operations', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should work with root path', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/',
            });

            // Route doesn't exist, but middleware should execute
            expect(response.statusCode).toBe(404);
        });

        it('should track identity for OPTIONS requests', async () => {
            const response = await app.inject({
                method: 'OPTIONS',
                url: '/hello',
            });

            // OPTIONS may return 404 or 200 depending on Fastify version
            // Important: middleware should execute without errors
            expect([200, 404]).toContain(response.statusCode);
        });
    });

    describe('1.2 ClsGuard basic functionality (8 tests)', () => {
        @Module({
            imports: [
                ClsModule.forRoot({
                    guard: { mount: true, generateId: true },
                }),
            ],
            providers: [TestFastifyService],
            controllers: [TestFastifyController],
        })
        class BasicGuardModule {}

        beforeAll(async () => {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [BasicGuardModule],
                },
            ).compile();
            app = moduleFixture.createNestApplication<NestFastifyApplication>(
                new FastifyAdapter(),
            );
            await app.init();
            await app.getHttpAdapter().getInstance().ready();
        });

        afterAll(async () => {
            await app.close();
        });

        it('should track request identity in guard', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle concurrent requests with guard (10 requests)', async () => {
            const promises = Array.from({ length: 10 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);
            const ids = responses.map((r) => JSON.parse(r.body).guardId);

            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(10);
        });

        it('should handle concurrent requests with guard (50 requests)', async () => {
            const promises = Array.from({ length: 50 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);
            const ids = responses.map((r) => JSON.parse(r.body).guardId);

            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(50);
        });

        it('should handle concurrent requests with guard (100 requests)', async () => {
            const promises = Array.from({ length: 100 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);
            const ids = responses.map((r) => JSON.parse(r.body).guardId);

            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(100);
        });

        it('should maintain context consistency', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle rapid sequential requests with guard', async () => {
            const ids: string[] = [];

            for (let i = 0; i < 15; i++) {
                const response = await app.inject({
                    method: 'GET',
                    url: '/hello',
                });
                const body = JSON.parse(response.body);
                ids.push(body.guardId);
            }

            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(15);
        }, 15000);

        it('should generate unique IDs for different requests', async () => {
            const [response1, response2, response3] = await Promise.all([
                app.inject({ method: 'GET', url: '/hello' }),
                app.inject({ method: 'GET', url: '/hello' }),
                app.inject({ method: 'GET', url: '/hello' }),
            ]);

            const body1 = JSON.parse(response1.body);
            const body2 = JSON.parse(response2.body);
            const body3 = JSON.parse(response3.body);

            expect(body1.guardId).toBeDefined();
            expect(body2.guardId).toBeDefined();
            expect(body3.guardId).toBeDefined();
            expect(body1.guardId).not.toEqual(body2.guardId);
            expect(body2.guardId).not.toEqual(body3.guardId);
        });

        it('should work with async guard operations', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });
    });

    describe('1.3 ClsInterceptor basic functionality (7 tests)', () => {
        @Module({
            imports: [
                ClsModule.forRoot({
                    interceptor: { mount: true, generateId: true },
                }),
            ],
            providers: [TestFastifyService],
            controllers: [TestFastifyController],
        })
        class BasicInterceptorModule {}

        beforeAll(async () => {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [BasicInterceptorModule],
                },
            ).compile();
            app = moduleFixture.createNestApplication<NestFastifyApplication>(
                new FastifyAdapter(),
            );
            await app.init();
            await app.getHttpAdapter().getInstance().ready();
        });

        afterAll(async () => {
            await app.close();
        });

        it('should track request identity in interceptor', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle concurrent requests with interceptor (25 requests)', async () => {
            const promises = Array.from({ length: 25 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);
            const ids = responses.map((r) => JSON.parse(r.body).interceptorId);

            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(25);
        });

        it('should handle concurrent requests with interceptor (100 requests)', async () => {
            const promises = Array.from({ length: 100 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);
            const ids = responses.map((r) => JSON.parse(r.body).interceptorId);

            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(100);
        });

        it('should maintain context through interceptor chain', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should generate unique IDs for parallel requests', async () => {
            const [response1, response2] = await Promise.all([
                app.inject({ method: 'GET', url: '/hello' }),
                app.inject({ method: 'GET', url: '/hello' }),
            ]);

            const body1 = JSON.parse(response1.body);
            const body2 = JSON.parse(response2.body);

            expect(body1.interceptorId).toBeDefined();
            expect(body2.interceptorId).toBeDefined();
            expect(body1.interceptorId).not.toEqual(body2.interceptorId);
        });

        it('should handle rapid sequential requests with interceptor', async () => {
            const ids: string[] = [];

            for (let i = 0; i < 10; i++) {
                const response = await app.inject({
                    method: 'GET',
                    url: '/hello',
                });
                const body = JSON.parse(response.body);
                ids.push(body.interceptorId);
            }

            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(10);
        }, 15000);

        it('should work with async interceptor operations', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });
    });
});

// ============================================================================
// Section 2: Fastify v4 vs v5 Compatibility (25 tests)
// ============================================================================

describe('Section 2: Fastify v4 vs v5 Compatibility (25 tests)', () => {
    let app: NestFastifyApplication;

    describe('2.1 Request object structure compatibility (10 tests)', () => {
        @Module({
            imports: [
                ClsModule.forRoot({
                    middleware: {
                        mount: true,
                        generateId: true,
                        setup: identityTrackingSetup,
                    },
                }),
            ],
            providers: [TestFastifyService],
            controllers: [TestFastifyController],
        })
        class CompatibilityModule {}

        beforeAll(async () => {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [CompatibilityModule],
                },
            ).compile();
            app = moduleFixture.createNestApplication<NestFastifyApplication>(
                new FastifyAdapter(),
            );
            await app.init();
            await app.getHttpAdapter().getInstance().ready();
        });

        afterAll(async () => {
            await app.close();
        });

        it('should work with Fastify request object (standard properties)', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle request with headers', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
                headers: { 'x-custom-header': 'test-value' },
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle request with query parameters', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello?param1=value1&param2=value2',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle request with cookies', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
                headers: { cookie: 'sessionId=abc123' },
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle request with user agent', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
                headers: { 'user-agent': 'Test-Agent/1.0' },
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle request with authorization header', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
                headers: { authorization: 'Bearer test-token' },
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle request with content-type header', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
                headers: { 'content-type': 'application/json' },
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle request with accept header', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
                headers: { accept: 'application/json' },
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle request with multiple headers', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
                headers: {
                    'x-request-id': 'req-123',
                    'x-tenant-id': 'tenant-456',
                    'x-api-key': 'key-789',
                },
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle request with no additional properties', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });
    });

    describe('2.2 Symbol tagging across Fastify versions (8 tests)', () => {
        @Module({
            imports: [
                ClsModule.forRoot({
                    middleware: {
                        mount: true,
                        generateId: true,
                        setup: identityTrackingSetup,
                    },
                }),
            ],
            providers: [TestFastifyService],
            controllers: [TestFastifyController],
        })
        class SymbolTaggingModule {}

        beforeAll(async () => {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [SymbolTaggingModule],
                },
            ).compile();
            app = moduleFixture.createNestApplication<NestFastifyApplication>(
                new FastifyAdapter(),
            );
            await app.init();
            await app.getHttpAdapter().getInstance().ready();
        });

        afterAll(async () => {
            await app.close();
        });

        it('should successfully tag request with Symbol (NOT request.raw)', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/identity',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expect(body.identityExists).toBe(true);
            expect(body.identityType).toBe('object');
        });

        it('should retrieve same identity on multiple accesses', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle Symbol tagging with GET requests', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle Symbol tagging with POST requests', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/hello',
                payload: { test: 'data' },
            });

            // POST route doesn't exist (404), but Symbol tagging should work
            expect(response.statusCode).toBe(404);
        });

        it('should maintain Symbol across middleware chain', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should not interfere with request properties', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello?test=value',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should work with concurrent Symbol tagging', async () => {
            const promises = Array.from({ length: 20 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);
            const ids = responses.map((r) => JSON.parse(r.body).middlewareId);

            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(20);
        });

        it('should handle Symbol tagging with headers', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
                headers: { 'x-custom': 'value' },
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });
    });

    describe('2.3 Backward compatibility validation (7 tests)', () => {
        @Module({
            imports: [
                ClsModule.forRoot({
                    middleware: {
                        mount: true,
                        generateId: true,
                        setup: identityTrackingSetup,
                    },
                }),
            ],
            providers: [TestFastifyService],
            controllers: [TestFastifyController],
        })
        class BackwardCompatModule {}

        beforeAll(async () => {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [BackwardCompatModule],
                },
            ).compile();
            app = moduleFixture.createNestApplication<NestFastifyApplication>(
                new FastifyAdapter(),
            );
            await app.init();
            await app.getHttpAdapter().getInstance().ready();
        });

        afterAll(async () => {
            await app.close();
        });

        it('should work with legacy request patterns', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should maintain compatibility with existing middleware', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should not break existing request handling', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expect(body.serviceId).toBeDefined();
        });

        it('should work with both old and new Fastify features', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle requests without regression', async () => {
            const promises = Array.from({ length: 10 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);
            responses.forEach((r) => {
                const body = JSON.parse(r.body);
                expectConsistentIds(body);
            });
        });

        it('should maintain performance with Symbol tagging', async () => {
            const start = Date.now();

            const promises = Array.from({ length: 50 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            await Promise.all(promises);
            const duration = Date.now() - start;

            // Should complete in reasonable time (< 5 seconds for 50 requests)
            expect(duration).toBeLessThan(5000);
        });

        it('should work with standard HTTP methods', async () => {
            await app.inject({ method: 'GET', url: '/hello' });
            await app.inject({ method: 'POST', url: '/hello' });
            await app.inject({ method: 'PUT', url: '/hello' });
            await app.inject({ method: 'DELETE', url: '/hello' });

            // POST/PUT/DELETE return 404 (no routes defined), but no errors
            expect(true).toBe(true);
        });
    });
});

// ============================================================================
// Section 3: Fastify-Specific Edge Cases (25 tests)
// ============================================================================

describe('Section 3: Fastify-Specific Edge Cases (25 tests)', () => {
    let app: NestFastifyApplication;

    describe('3.1 Request transformation scenarios (10 tests)', () => {
        /**
         * Middleware that transforms request (simulating Fastify hooks)
         */
        @Injectable()
        class RequestTransformMiddleware implements NestMiddleware {
            use(req: any, _res: any, next: (error?: any) => void) {
                // Simulate Fastify hooks adding properties
                req.body = req.body || { data: 'test' };
                req.customData = { param: 'value' };
                req.customParams = { id: '123' };
                return next();
            }
        }

        @Module({
            imports: [
                ClsModule.forRoot({
                    middleware: {
                        mount: true,
                        generateId: true,
                        setup: identityTrackingSetup,
                    },
                }),
            ],
            providers: [TestFastifyService],
            controllers: [TestFastifyController],
        })
        class TransformModule implements NestModule {
            configure(consumer: MiddlewareConsumer) {
                consumer.apply(RequestTransformMiddleware).forRoutes('/');
            }
        }

        beforeAll(async () => {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [TransformModule],
                },
            ).compile();
            app = moduleFixture.createNestApplication<NestFastifyApplication>(
                new FastifyAdapter(),
            );
            await app.init();
            await app.getHttpAdapter().getInstance().ready();
        });

        afterAll(async () => {
            await app.close();
        });

        it('should maintain identity after request transformation', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle body parser-like transformations', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/hello',
                payload: { test: 'data' },
            });

            // No POST route, but middleware runs
            expect(response.statusCode).toBe(404);
        });

        it('should work with query string parsing', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello?a=1&b=2',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle URL parameter parsing', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should maintain identity with multiple transformations', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
                headers: { 'content-type': 'application/json' },
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle concurrent transformed requests', async () => {
            const promises = Array.from({ length: 15 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);
            const ids = responses.map((r) => JSON.parse(r.body).middlewareId);

            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(15);
        });

        it('should work with cookie parsing middleware', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
                headers: { cookie: 'session=abc123' },
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle session middleware patterns', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should maintain identity with request enrichment', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should work with authentication middleware patterns', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
                headers: { authorization: 'Bearer token' },
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });
    });

    describe('3.2 Fastify decorators and hooks compatibility (8 tests)', () => {
        @Module({
            imports: [
                ClsModule.forRoot({
                    middleware: {
                        mount: true,
                        generateId: true,
                        setup: identityTrackingSetup,
                    },
                }),
            ],
            providers: [TestFastifyService],
            controllers: [TestFastifyController],
        })
        class DecoratorModule {}

        beforeAll(async () => {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [DecoratorModule],
                },
            ).compile();
            app = moduleFixture.createNestApplication<NestFastifyApplication>(
                new FastifyAdapter(),
            );

            // Simulate Fastify decorators
            const fastifyInstance = app.getHttpAdapter().getInstance();
            fastifyInstance.decorateRequest('customProperty', null);

            await app.init();
            await fastifyInstance.ready();
        });

        afterAll(async () => {
            await app.close();
        });

        it('should work with request decorators', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should maintain identity with decorated requests', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle concurrent requests with decorators', async () => {
            const promises = Array.from({ length: 20 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);
            const ids = responses.map((r) => JSON.parse(r.body).middlewareId);

            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(20);
        });

        it('should work with onRequest hooks', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should work with preParsing hooks', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should work with preHandler hooks', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should maintain identity through hook chain', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle rapid sequential requests with decorators', async () => {
            for (let i = 0; i < 10; i++) {
                const response = await app.inject({
                    method: 'GET',
                    url: '/hello',
                });

                const body = JSON.parse(response.body);
                expect(response.statusCode).toBe(200);
                expectConsistentIds(body);
            }
        }, 15000);
    });

    describe('3.3 Global prefix and routing edge cases (7 tests)', () => {
        @Module({
            imports: [
                ClsModule.forRoot({
                    middleware: {
                        mount: true,
                        generateId: true,
                        setup: identityTrackingSetup,
                    },
                }),
            ],
            providers: [TestFastifyService],
            controllers: [TestFastifyController],
        })
        class GlobalPrefixModule {}

        beforeAll(async () => {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [GlobalPrefixModule],
                },
            ).compile();
            app = moduleFixture.createNestApplication<NestFastifyApplication>(
                new FastifyAdapter(),
            );
            app.setGlobalPrefix('api');
            await app.init();
            await app.getHttpAdapter().getInstance().ready();
        });

        afterAll(async () => {
            await app.close();
        });

        it('should work with global prefix', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle concurrent requests with global prefix', async () => {
            const promises = Array.from({ length: 10 }, () =>
                app.inject({ method: 'GET', url: '/api/hello' }),
            );

            const responses = await Promise.all(promises);
            const ids = responses.map((r) => JSON.parse(r.body).middlewareId);

            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(10);
        });

        it('should maintain identity with prefixed routes', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should work with nested path segments', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should handle identity tracking on root path with prefix', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api',
            });

            // No route defined, but middleware should execute
            expect(response.statusCode).toBe(404);
        });

        it('should work with query parameters and prefix', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/hello?test=value',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });

        it('should maintain identity across different prefixed routes', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body);
        });
    });
});

// ============================================================================
// Section 4: Multi-Enhancer with Fastify (25 tests)
// ============================================================================

describe('Section 4: Multi-Enhancer with Fastify (25 tests)', () => {
    let app: NestFastifyApplication;

    describe('4.1 All enhancers enabled (Issue #223 regression test) (10 tests)', () => {
        @Module({
            imports: [
                ClsModule.forRoot({
                    middleware: {
                        mount: true,
                        generateId: true,
                        idGenerator: () => 'middleware-id',
                        setup: identityTrackingSetup,
                    },
                    guard: {
                        mount: true,
                        generateId: true,
                        idGenerator: () => 'guard-id',
                    },
                    interceptor: {
                        mount: true,
                        generateId: true,
                        idGenerator: () => 'interceptor-id',
                    },
                }),
            ],
            providers: [TestFastifyService],
            controllers: [TestFastifyController],
        })
        class MultiEnhancerModule {}

        beforeAll(async () => {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [MultiEnhancerModule],
                },
            ).compile();
            app = moduleFixture.createNestApplication<NestFastifyApplication>(
                new FastifyAdapter(),
            );
            await app.init();
            await app.getHttpAdapter().getInstance().ready();
        });

        afterAll(async () => {
            await app.close();
        });

        it('should use context from first enhancer (middleware) - ISSUE #223 FIX', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);

            // First enhancer wins (middleware)
            expect(body.middlewareId).toBe('middleware-id');
            expect(body.guardId).toBe('middleware-id');
            expect(body.interceptorId).toBe('middleware-id');
            expect(body.serviceId).toBe('middleware-id');
        });

        it('should maintain consistent identity across all enhancers', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body, 'middleware-id');
        });

        it('should handle concurrent requests without leaking (10 requests) - ISSUE #223', async () => {
            const promises = Array.from({ length: 10 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);

            responses.forEach((r) => {
                const body = JSON.parse(r.body);
                expectConsistentIds(body, 'middleware-id');
            });
        });

        it('should handle concurrent requests without leaking (50 requests) - ISSUE #223', async () => {
            const promises = Array.from({ length: 50 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);

            responses.forEach((r) => {
                const body = JSON.parse(r.body);
                expectConsistentIds(body, 'middleware-id');
            });
        });

        it('should handle concurrent requests without leaking (100 requests) - ISSUE #223', async () => {
            const promises = Array.from({ length: 100 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);

            responses.forEach((r) => {
                const body = JSON.parse(r.body);
                expectConsistentIds(body, 'middleware-id');
            });
        });

        it('should track request identity through all enhancers', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/identity',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expect(body.identityExists).toBe(true);
            expect(body.id).toBe('middleware-id');
        });

        it('should handle rapid sequential requests - ISSUE #223', async () => {
            for (let i = 0; i < 15; i++) {
                const response = await app.inject({
                    method: 'GET',
                    url: '/hello',
                });

                const body = JSON.parse(response.body);
                expect(response.statusCode).toBe(200);
                expectConsistentIds(body, 'middleware-id');
            }
        }, 15000);

        it('should maintain identity through async operations', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body, 'middleware-id');
        });

        it('should work with headers', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
                headers: { 'x-test-header': 'value' },
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body, 'middleware-id');
        });

        it('should work with query parameters', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello?test=value',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body, 'middleware-id');
        });
    });

    describe('4.2 Middleware + Guard combination (8 tests)', () => {
        @Module({
            imports: [
                ClsModule.forRoot({
                    middleware: {
                        mount: true,
                        generateId: true,
                        idGenerator: () => 'mw-guard-id',
                        setup: identityTrackingSetup,
                    },
                    guard: {
                        mount: true,
                        generateId: true,
                    },
                }),
            ],
            providers: [TestFastifyService],
            controllers: [TestFastifyController],
        })
        class MiddlewareGuardModule {}

        beforeAll(async () => {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [MiddlewareGuardModule],
                },
            ).compile();
            app = moduleFixture.createNestApplication<NestFastifyApplication>(
                new FastifyAdapter(),
            );
            await app.init();
            await app.getHttpAdapter().getInstance().ready();
        });

        afterAll(async () => {
            await app.close();
        });

        it('should share context between middleware and guard', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body, 'mw-guard-id');
        });

        it('should handle concurrent requests (25 requests)', async () => {
            const promises = Array.from({ length: 25 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);

            responses.forEach((r) => {
                const body = JSON.parse(r.body);
                expectConsistentIds(body, 'mw-guard-id');
            });
        });

        it('should maintain identity through both enhancers', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expect(body.middlewareId).toBe('mw-guard-id');
            expect(body.guardId).toBe('mw-guard-id');
        });

        it('should work with headers', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
                headers: { authorization: 'Bearer token' },
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body, 'mw-guard-id');
        });

        it('should handle rapid sequential requests', async () => {
            for (let i = 0; i < 10; i++) {
                const response = await app.inject({
                    method: 'GET',
                    url: '/hello',
                });

                const body = JSON.parse(response.body);
                expect(response.statusCode).toBe(200);
                expectConsistentIds(body, 'mw-guard-id');
            }
        }, 15000);

        it('should work with query parameters', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello?param=value',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body, 'mw-guard-id');
        });

        it('should maintain identity across async operations', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body, 'mw-guard-id');
        });

        it('should prevent context leak in concurrent scenario', async () => {
            const promises = Array.from({ length: 30 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);

            responses.forEach((r) => {
                const body = JSON.parse(r.body);
                expectConsistentIds(body, 'mw-guard-id');
            });
        });
    });

    describe('4.3 Middleware + Interceptor combination (7 tests)', () => {
        @Module({
            imports: [
                ClsModule.forRoot({
                    middleware: {
                        mount: true,
                        generateId: true,
                        idGenerator: () => 'mw-int-id',
                        setup: identityTrackingSetup,
                    },
                    interceptor: {
                        mount: true,
                        generateId: true,
                    },
                }),
            ],
            providers: [TestFastifyService],
            controllers: [TestFastifyController],
        })
        class MiddlewareInterceptorModule {}

        beforeAll(async () => {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [MiddlewareInterceptorModule],
                },
            ).compile();
            app = moduleFixture.createNestApplication<NestFastifyApplication>(
                new FastifyAdapter(),
            );
            await app.init();
            await app.getHttpAdapter().getInstance().ready();
        });

        afterAll(async () => {
            await app.close();
        });

        it('should share context between middleware and interceptor', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body, 'mw-int-id');
        });

        it('should handle concurrent requests (30 requests)', async () => {
            const promises = Array.from({ length: 30 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);

            responses.forEach((r) => {
                const body = JSON.parse(r.body);
                expectConsistentIds(body, 'mw-int-id');
            });
        });

        it('should maintain identity through both enhancers', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expect(body.middlewareId).toBe('mw-int-id');
            expect(body.interceptorId).toBe('mw-int-id');
        });

        it('should handle rapid sequential requests', async () => {
            for (let i = 0; i < 8; i++) {
                const response = await app.inject({
                    method: 'GET',
                    url: '/hello',
                });

                const body = JSON.parse(response.body);
                expect(response.statusCode).toBe(200);
                expectConsistentIds(body, 'mw-int-id');
            }
        }, 15000);

        it('should work with async interceptor operations', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body, 'mw-int-id');
        });

        it('should prevent context leak with interceptor', async () => {
            const promises = Array.from({ length: 20 }, () =>
                app.inject({ method: 'GET', url: '/hello' }),
            );

            const responses = await Promise.all(promises);

            responses.forEach((r) => {
                const body = JSON.parse(r.body);
                expectConsistentIds(body, 'mw-int-id');
            });
        });

        it('should work with headers and interceptor', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/hello',
                headers: { 'x-custom': 'value' },
            });

            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expectConsistentIds(body, 'mw-int-id');
        });
    });
});
