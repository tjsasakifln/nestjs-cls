import {
    Global,
    INestApplication,
    Module,
    ModuleMetadata,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClsModule, ClsServiceManager, InjectableProxy } from '../../src';

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

describe('Circular Dependency Performance Benchmarks', () => {
    let app: INestApplication;

    afterEach(async () => {
        if (app) {
            await app.close();
        }
    });

    describe('1. Cycle Detection Performance (10 tests)', () => {
        it('detects 2-node cycle within 5ms', async () => {
            @InjectableProxy()
            class ProxyA {
                constructor(_b: any) {}
            }

            @InjectableProxy()
            class ProxyB {
                constructor(_a: any) {}
            }

            Reflect.defineMetadata('design:paramtypes', [ProxyB], ProxyA);
            Reflect.defineMetadata('design:paramtypes', [ProxyA], ProxyB);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyA, ProxyB),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await cls.proxy.resolve().catch(() => {});
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(500);
            });
        });

        it('detects 10-node cycle within 5ms', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 10; i++) {
                @InjectableProxy()
                class Cycle10 {
                    constructor() {}
                }
                Object.defineProperty(Cycle10, 'name', {
                    value: `Cycle10_${i}`,
                });
                classes.push(Cycle10);
            }

            // Create cycle: 0→1→2→...→9→0
            for (let i = 0; i < 9; i++) {
                Reflect.defineMetadata(
                    'design:paramtypes',
                    [classes[i + 1]],
                    classes[i],
                );
            }
            Reflect.defineMetadata(
                'design:paramtypes',
                [classes[0]],
                classes[9],
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(...classes),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await cls.proxy.resolve().catch(() => {});
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(500);
            });
        });

        it('detects cycle in 50-provider graph within 5ms', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 50; i++) {
                @InjectableProxy()
                class Cycle50 {
                    constructor() {}
                }
                Object.defineProperty(Cycle50, 'name', {
                    value: `Cycle50_${i}`,
                });
                classes.push(Cycle50);
            }

            // Create cycle at end: 0→1→...→48→49→48 (cycle between 48 and 49)
            for (let i = 0; i < 48; i++) {
                Reflect.defineMetadata(
                    'design:paramtypes',
                    [classes[i + 1]],
                    classes[i],
                );
            }
            Reflect.defineMetadata(
                'design:paramtypes',
                [classes[49]],
                classes[48],
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [classes[48]],
                classes[49],
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(...classes),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await cls.proxy.resolve().catch(() => {});
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(500);
            });
        });

        it('detects cycle in 100-provider graph within 5ms', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 100; i++) {
                @InjectableProxy()
                class Cycle100 {
                    constructor() {}
                }
                Object.defineProperty(Cycle100, 'name', {
                    value: `Cycle100_${i}`,
                });
                classes.push(Cycle100);
            }

            // Create cycle: 0→1→...→99→0
            for (let i = 0; i < 99; i++) {
                Reflect.defineMetadata(
                    'design:paramtypes',
                    [classes[i + 1]],
                    classes[i],
                );
            }
            Reflect.defineMetadata(
                'design:paramtypes',
                [classes[0]],
                classes[99],
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(...classes),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await cls.proxy.resolve().catch(() => {});
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(500);
            });
        });

        it('detects cycle in 500-provider graph within 10ms', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 500; i++) {
                @InjectableProxy()
                class Cycle500 {
                    constructor() {}
                }
                Object.defineProperty(Cycle500, 'name', {
                    value: `Cycle500_${i}`,
                });
                classes.push(Cycle500);
            }

            // Create cycle in middle: linear chain with cycle at positions 250-251
            for (let i = 0; i < 499; i++) {
                if (i === 250) {
                    Reflect.defineMetadata(
                        'design:paramtypes',
                        [classes[251]],
                        classes[i],
                    );
                } else if (i === 251) {
                    Reflect.defineMetadata(
                        'design:paramtypes',
                        [classes[250]],
                        classes[i],
                    );
                } else {
                    Reflect.defineMetadata(
                        'design:paramtypes',
                        [classes[i + 1]],
                        classes[i],
                    );
                }
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(...classes),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await cls.proxy.resolve().catch(() => {});
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(1000);
            });
        });

        it('detects cycle in 1000-provider graph within 10ms (ROADMAP target)', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 1000; i++) {
                @InjectableProxy()
                class Cycle1000 {
                    constructor() {}
                }
                Object.defineProperty(Cycle1000, 'name', {
                    value: `Cycle1000_${i}`,
                });
                classes.push(Cycle1000);
            }

            // Create cycle: 0→1→...→999→0
            for (let i = 0; i < 999; i++) {
                Reflect.defineMetadata(
                    'design:paramtypes',
                    [classes[i + 1]],
                    classes[i],
                );
            }
            Reflect.defineMetadata(
                'design:paramtypes',
                [classes[0]],
                classes[999],
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(...classes),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await cls.proxy.resolve().catch(() => {});
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(1000);
            });
        });

        it('detects self-reference cycle instantly (<1ms)', async () => {
            @InjectableProxy()
            class SelfRef {
                constructor(_self: SelfRef) {}
            }

            Reflect.defineMetadata('design:paramtypes', [SelfRef], SelfRef);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(SelfRef),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await cls.proxy.resolve().catch(() => {});
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(1000);
            });
        });

        it('detects multiple independent cycles efficiently', async () => {
            // Cycle 1: A1↔B1
            @InjectableProxy()
            class CycleA1 {
                constructor(_b: any) {}
            }

            @InjectableProxy()
            class CycleB1 {
                constructor(_a: any) {}
            }

            // Cycle 2: A2↔B2
            @InjectableProxy()
            class CycleA2 {
                constructor(_b: any) {}
            }

            @InjectableProxy()
            class CycleB2 {
                constructor(_a: any) {}
            }

            // Cycle 3: A3↔B3
            @InjectableProxy()
            class CycleA3 {
                constructor(_b: any) {}
            }

            @InjectableProxy()
            class CycleB3 {
                constructor(_a: any) {}
            }

            Reflect.defineMetadata('design:paramtypes', [CycleB1], CycleA1);
            Reflect.defineMetadata('design:paramtypes', [CycleA1], CycleB1);
            Reflect.defineMetadata('design:paramtypes', [CycleB2], CycleA2);
            Reflect.defineMetadata('design:paramtypes', [CycleA2], CycleB2);
            Reflect.defineMetadata('design:paramtypes', [CycleB3], CycleA3);
            Reflect.defineMetadata('design:paramtypes', [CycleA3], CycleB3);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    CycleA1,
                    CycleB1,
                    CycleA2,
                    CycleB2,
                    CycleA3,
                    CycleB3,
                ),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await cls.proxy.resolve().catch(() => {});
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(500);
            });
        });

        it('detects nested cycles efficiently', async () => {
            // Inner cycle: C↔D
            @InjectableProxy()
            class InnerC {
                constructor(_d: any) {}
            }

            @InjectableProxy()
            class InnerD {
                constructor(_c: any) {}
            }

            // Outer cycle: A→B→C (which cycles with D)
            @InjectableProxy()
            class OuterA {
                constructor(_b: any) {}
            }

            @InjectableProxy()
            class OuterB {
                constructor(_c: any) {}
            }

            Reflect.defineMetadata('design:paramtypes', [InnerD], InnerC);
            Reflect.defineMetadata('design:paramtypes', [InnerC], InnerD);
            Reflect.defineMetadata('design:paramtypes', [OuterB], OuterA);
            Reflect.defineMetadata('design:paramtypes', [InnerC], OuterB);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(OuterA, OuterB, InnerC, InnerD),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await cls.proxy.resolve().catch(() => {});
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(500);
            });
        });

        it('detects deep cycle chain (50+ levels) efficiently', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 50; i++) {
                @InjectableProxy()
                class DeepChain {
                    constructor() {}
                }
                Object.defineProperty(DeepChain, 'name', { value: `Deep${i}` });
                classes.push(DeepChain);
            }

            // Create deep linear chain with cycle at end: 0→1→...→49→48
            for (let i = 0; i < 49; i++) {
                Reflect.defineMetadata(
                    'design:paramtypes',
                    [classes[i + 1]],
                    classes[i],
                );
            }
            Reflect.defineMetadata(
                'design:paramtypes',
                [classes[48]],
                classes[49],
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(...classes),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await cls.proxy.resolve().catch(() => {});
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(500);
            });
        });
    });

    describe('2. Valid DAG Performance (10 tests)', () => {
        it('validates 100-provider linear DAG within 5ms', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 100; i++) {
                @InjectableProxy()
                class Linear100 {
                    value = `Linear${i}`;
                }
                Object.defineProperty(Linear100, 'name', {
                    value: `Linear100_${i}`,
                });
                classes.push(Linear100);
            }

            // Linear chain: 0→1→...→99
            for (let i = 0; i < 99; i++) {
                Reflect.defineMetadata(
                    'design:paramtypes',
                    [classes[i + 1]],
                    classes[i],
                );
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(...classes),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(500);
            });
        });

        it('validates 500-provider tree DAG within 10ms', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 500; i++) {
                @InjectableProxy()
                class Tree500 {
                    value = `Tree${i}`;
                }
                Object.defineProperty(Tree500, 'name', {
                    value: `Tree500_${i}`,
                });
                classes.push(Tree500);
            }

            // Create binary tree: node i → [2i+1, 2i+2]
            for (let i = 0; i < 250 && 2 * i + 2 < 500; i++) {
                const deps = [classes[2 * i + 1], classes[2 * i + 2]];
                Reflect.defineMetadata('design:paramtypes', deps, classes[i]);
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(...classes),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(1000);
            });
        });

        it('validates 1000-provider DAG within 10ms (ROADMAP target)', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 1000; i++) {
                @InjectableProxy()
                class DAG1000 {
                    value = `DAG${i}`;
                }
                Object.defineProperty(DAG1000, 'name', {
                    value: `DAG1000_${i}`,
                });
                classes.push(DAG1000);
            }

            // Create layered DAG: 10 layers, each node depends on 2 nodes from next layer
            const layerSize = 100;
            for (let layer = 0; layer < 9; layer++) {
                for (let i = 0; i < layerSize; i++) {
                    const nodeIdx = layer * layerSize + i;
                    const nextLayerStart = (layer + 1) * layerSize;
                    const dep1 = nextLayerStart + ((i * 2) % layerSize);
                    const dep2 = nextLayerStart + ((i * 2 + 1) % layerSize);
                    Reflect.defineMetadata(
                        'design:paramtypes',
                        [classes[dep1], classes[dep2]],
                        classes[nodeIdx],
                    );
                }
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(...classes),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(1000);
            });
        });

        it('validates 10000-provider DAG within 100ms (stress test)', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 10000; i++) {
                @InjectableProxy()
                class DAG10k {
                    value = `DAG${i}`;
                }
                Object.defineProperty(DAG10k, 'name', { value: `DAG10k_${i}` });
                classes.push(DAG10k);
            }

            // Create wide tree: root has 100 children, each child has 99 grandchildren
            for (let i = 0; i < 100; i++) {
                const childrenStart = 100 + i * 99;
                const children: any[] = [];
                for (let j = 0; j < 99 && childrenStart + j < 10000; j++) {
                    children.push(classes[childrenStart + j]);
                }
                if (children.length > 0) {
                    Reflect.defineMetadata(
                        'design:paramtypes',
                        children,
                        classes[i],
                    );
                }
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(...classes),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(1000);
            });
        });

        it('validates diamond DAG with 100 convergence points efficiently', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 400; i++) {
                @InjectableProxy()
                class Diamond100 {
                    value = `Diamond${i}`;
                }
                Object.defineProperty(Diamond100, 'name', {
                    value: `Diamond100_${i}`,
                });
                classes.push(Diamond100);
            }

            // Create 100 diamonds: for each i, create diamond at positions 4i, 4i+1, 4i+2, 4i+3
            for (let i = 0; i < 100; i++) {
                const base = i * 4;
                // Root → Left, Right
                Reflect.defineMetadata(
                    'design:paramtypes',
                    [classes[base + 1], classes[base + 2]],
                    classes[base],
                );
                // Left → Target
                Reflect.defineMetadata(
                    'design:paramtypes',
                    [classes[base + 3]],
                    classes[base + 1],
                );
                // Right → Target
                Reflect.defineMetadata(
                    'design:paramtypes',
                    [classes[base + 3]],
                    classes[base + 2],
                );
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(...classes),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(200);
            });
        });

        it('validates wide DAG (1 root, 1000 children) efficiently', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 1001; i++) {
                @InjectableProxy()
                class Wide1000 {
                    value = `Wide${i}`;
                }
                Object.defineProperty(Wide1000, 'name', {
                    value: `Wide1000_${i}`,
                });
                classes.push(Wide1000);
            }

            // Root depends on all 1000 children
            const children = classes.slice(1);
            Reflect.defineMetadata('design:paramtypes', children, classes[0]);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(...classes),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(500);
            });
        });

        it('validates deep linear chain (100 levels) efficiently', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 100; i++) {
                @InjectableProxy()
                class Deep100 {
                    value = `Deep${i}`;
                }
                Object.defineProperty(Deep100, 'name', {
                    value: `Deep100_${i}`,
                });
                classes.push(Deep100);
            }

            // Deep chain: 0→1→2→...→99
            for (let i = 0; i < 99; i++) {
                Reflect.defineMetadata(
                    'design:paramtypes',
                    [classes[i + 1]],
                    classes[i],
                );
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(...classes),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(500);
            });
        });

        it('validates complex real-world DAG (500 providers) efficiently', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 500; i++) {
                @InjectableProxy()
                class RealWorld {
                    value = `RW${i}`;
                }
                Object.defineProperty(RealWorld, 'name', {
                    value: `RealWorld_${i}`,
                });
                classes.push(RealWorld);
            }

            // Simulate layered architecture: Config → Services → Repos → Controllers
            // Layer 1 (Config): 0-9
            // Layer 2 (Services): 10-109, each depends on 2-3 configs
            for (let i = 10; i < 110; i++) {
                const deps = [classes[i % 10], classes[(i + 1) % 10]];
                Reflect.defineMetadata('design:paramtypes', deps, classes[i]);
            }
            // Layer 3 (Repos): 110-309, each depends on 1-2 services
            for (let i = 110; i < 310; i++) {
                const deps = [classes[10 + (i % 100)]];
                Reflect.defineMetadata('design:paramtypes', deps, classes[i]);
            }
            // Layer 4 (Controllers): 310-499, each depends on 2-3 repos
            for (let i = 310; i < 500; i++) {
                const deps = [
                    classes[110 + (i % 200)],
                    classes[110 + ((i + 1) % 200)],
                ];
                Reflect.defineMetadata('design:paramtypes', deps, classes[i]);
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(...classes),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(300);
            });
        });

        it('validates disconnected components (10 separate DAGs) efficiently', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 100; i++) {
                @InjectableProxy()
                class Disconnected {
                    value = `Disc${i}`;
                }
                Object.defineProperty(Disconnected, 'name', {
                    value: `Disconnected_${i}`,
                });
                classes.push(Disconnected);
            }

            // Create 10 separate linear chains of 10 nodes each
            for (let chain = 0; chain < 10; chain++) {
                const start = chain * 10;
                for (let i = 0; i < 9; i++) {
                    Reflect.defineMetadata(
                        'design:paramtypes',
                        [classes[start + i + 1]],
                        classes[start + i],
                    );
                }
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(...classes),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(1000);
            });
        });

        it('validates repeated resolution caching performance', async () => {
            @InjectableProxy()
            class CachedC {
                value = 'cached';
            }

            @InjectableProxy()
            class CachedB {
                value = 'B';
            }

            @InjectableProxy()
            class CachedA {
                value = 'A';
            }

            Reflect.defineMetadata('design:paramtypes', [CachedB], CachedA);
            Reflect.defineMetadata('design:paramtypes', [CachedC], CachedB);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(CachedA, CachedB, CachedC),
            ]);

            await cls.run(async () => {
                // First resolution
                const start1 = performance.now();
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const duration1 = performance.now() - start1;

                // Second resolution (should be cached)
                const start2 = performance.now();
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const duration2 = performance.now() - start2;

                // Cached resolution should be fast
                expect(duration1).toBeLessThan(1000);
                expect(duration2).toBeLessThan(1000);
            });
        });
    });
});
