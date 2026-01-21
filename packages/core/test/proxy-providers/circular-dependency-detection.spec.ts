import {
    Global,
    INestApplication,
    Module,
    ModuleMetadata,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClsModule, ClsServiceManager, InjectableProxy } from '../../src';
import { ProxyProviderCircularDependencyException } from '../../src/lib/proxy-provider/proxy-provider.exceptions';

@Global()
@Module({})
class BaseModule {}

async function createAndInitTestingApp(imports: ModuleMetadata['imports']) {
    const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
            BaseModule,
            ClsModule.forRoot({ middleware: { mount: true } }),
            ...(imports ?? []),
        ],
    }).compile();
    const app = moduleFixture.createNestApplication();
    await app.init();
    return app;
}

const cls = ClsServiceManager.getClsService();

describe('Circular Dependency Detection', () => {
    let app: INestApplication;

    afterEach(async () => {
        if (app) {
            await app.close();
        }
    });

    describe('Detects Circular Dependencies', () => {
        it('detects A→A self-reference', async () => {
            @InjectableProxy()
            class ProxySelf {
                constructor() {
                    // Self-reference via metadata
                }
            }

            // Manually set circular dependency metadata
            Reflect.defineMetadata('design:paramtypes', [ProxySelf], ProxySelf);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxySelf),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    /Circular dependency detected.*ProxySelf.*ProxySelf/,
                );
            });
        });
    });

    describe('Valid DAGs (No False Positives)', () => {
        it('allows linear dependency chain (A→B→C)', async () => {
            @InjectableProxy()
            class ProxyC {
                value = 'C';
            }

            @InjectableProxy()
            class ProxyB {
                constructor(public c: ProxyC) {}
            }

            @InjectableProxy()
            class ProxyA {
                constructor(public b: ProxyB) {}
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyA, ProxyB, ProxyC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                expect(app.get(ProxyA).b.c.value).toBe('C');
            });
        });

        it('allows diamond dependency (A→B,C; B,C→D)', async () => {
            @InjectableProxy()
            class ProxyD {
                value = 'D';
            }

            @InjectableProxy()
            class ProxyB {
                constructor(public d: ProxyD) {}
            }

            @InjectableProxy()
            class ProxyC {
                constructor(public d: ProxyD) {}
            }

            @InjectableProxy()
            class ProxyA {
                constructor(
                    public b: ProxyB,
                    public c: ProxyC,
                ) {}
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyA, ProxyB, ProxyC, ProxyD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const a = app.get(ProxyA);
                expect(a.b.d.value).toBe('D');
                expect(a.c.d.value).toBe('D');
                // Both paths should resolve to the same instance of D
                expect(a.b.d).toBe(a.c.d);
            });
        });

        it('allows providers with no dependencies', async () => {
            @InjectableProxy()
            class ProxyA {
                value = 'A';
            }

            @InjectableProxy()
            class ProxyB {
                value = 'B';
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyA, ProxyB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                expect(app.get(ProxyA).value).toBe('A');
                expect(app.get(ProxyB).value).toBe('B');
            });
        });
    });

    describe('Performance', () => {
        it('detects cycle quickly (fail-fast)', async () => {
            @InjectableProxy()
            class ProxySelf {
                constructor() {
                    // Will have self-reference
                }
            }

            // Set up self-reference
            Reflect.defineMetadata('design:paramtypes', [ProxySelf], ProxySelf);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxySelf),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
                const duration = performance.now() - start;

                // Should fail in less than 100ms (vs 10s timeout before)
                expect(duration).toBeLessThan(100);
            });
        });
    });

    describe('Caching', () => {
        it('uses cached cycle analysis across contexts', async () => {
            @InjectableProxy()
            class ProxyA {
                value = 'A';
            }

            @InjectableProxy()
            class ProxyB {
                constructor(public a: ProxyA) {}
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyA, ProxyB),
            ]);

            // First context - performs cycle analysis
            await cls.run(async () => {
                const start1 = performance.now();
                await cls.proxy.resolve();
                const duration1 = performance.now() - start1;
                expect(duration1).toBeLessThan(1000);
            });

            // Second context - should use cached analysis
            await cls.run(async () => {
                const start2 = performance.now();
                await cls.proxy.resolve();
                const duration2 = performance.now() - start2;
                // Second should be reasonably fast
                expect(duration2).toBeLessThan(1000);
            });
        });
    });
});
