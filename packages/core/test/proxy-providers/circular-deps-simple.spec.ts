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

describe('Simple Circular Dependency Cycles', () => {
    let app: INestApplication;

    afterEach(async () => {
        if (app) {
            await app.close();
        }
    });

    describe('1. Self-Reference Cycles (10 tests)', () => {
        it('detects A→A self-reference', async () => {
            @InjectableProxy()
            class ProxySelf {
                constructor() {
                    // Self-reference
                }
            }

            Reflect.defineMetadata('design:paramtypes', [ProxySelf], ProxySelf);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxySelf),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects self-reference with additional dependencies', async () => {
            @InjectableProxy()
            class ProxyOther {
                value = 'other';
            }

            @InjectableProxy()
            class ProxySelfWithDep {
                constructor() {
                    // Self-reference + other dependency
                }
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxySelfWithDep, ProxyOther],
                ProxySelfWithDep,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxySelfWithDep, ProxyOther),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects self-reference in second constructor parameter', async () => {
            @InjectableProxy()
            class ProxyOther {
                value = 'other';
            }

            @InjectableProxy()
            class ProxySelfSecond {
                constructor() {
                    // Other dependency + self-reference
                }
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyOther, ProxySelfSecond],
                ProxySelfSecond,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxySelfSecond, ProxyOther),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects self-reference with multiple constructor parameters', async () => {
            @InjectableProxy()
            class ProxyA {
                value = 'A';
            }

            @InjectableProxy()
            class ProxyB {
                value = 'B';
            }

            @InjectableProxy()
            class ProxySelfMulti {
                constructor() {
                    // A, Self, B
                }
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyA, ProxySelfMulti, ProxyB],
                ProxySelfMulti,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxySelfMulti, ProxyA, ProxyB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('throws error immediately without timeout', async () => {
            @InjectableProxy()
            class ProxySelfFast {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxySelfFast],
                ProxySelfFast,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxySelfFast),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(100);
            });
        });

        it('detects self-reference with Symbol provider', async () => {
            @InjectableProxy()
            class ProxySelfSymbol {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxySelfSymbol],
                ProxySelfSymbol,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxySelfSymbol),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects self-reference when provider is injected by string token', async () => {
            @InjectableProxy()
            class ProxySelfString {
                static readonly TOKEN = 'PROXY_SELF_STRING';
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxySelfString],
                ProxySelfString,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxySelfString),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects self-reference in class with properties', async () => {
            @InjectableProxy()
            class ProxySelfWithProps {
                public readonly name = 'self';
                public value = 42;

                constructor() {}

                method() {
                    return this.value;
                }
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxySelfWithProps],
                ProxySelfWithProps,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxySelfWithProps),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects self-reference in empty constructor', async () => {
            @InjectableProxy()
            class ProxySelfEmpty {}

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxySelfEmpty],
                ProxySelfEmpty,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxySelfEmpty),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects self-reference with default constructor parameter', async () => {
            @InjectableProxy()
            class ProxySelfDefault {
                constructor(_dep: any = null) {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxySelfDefault],
                ProxySelfDefault,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxySelfDefault),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });
    });

    describe('2. Two-Node Cycles (15 tests)', () => {
        it('detects A→B→A cycle', async () => {
            @InjectableProxy()
            class ProxyB {
                constructor() {}
            }

            @InjectableProxy()
            class ProxyA {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [ProxyB], ProxyA);
            Reflect.defineMetadata('design:paramtypes', [ProxyA], ProxyB);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyA, ProxyB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects A→B→A when starting from A', async () => {
            @InjectableProxy()
            class ProxyTwoB {
                constructor() {}
            }

            @InjectableProxy()
            class ProxyTwoA {
                constructor(_b: ProxyTwoB) {}
            }

            Reflect.defineMetadata('design:paramtypes', [ProxyTwoB], ProxyTwoA);
            Reflect.defineMetadata('design:paramtypes', [ProxyTwoA], ProxyTwoB);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyTwoA, ProxyTwoB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects A→B→A when starting from B', async () => {
            @InjectableProxy()
            class ProxyStartB {
                constructor() {}
            }

            @InjectableProxy()
            class ProxyStartA {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyStartB],
                ProxyStartA,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyStartA],
                ProxyStartB,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyStartA, ProxyStartB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects two-node cycle with additional non-cyclic dependency', async () => {
            @InjectableProxy()
            class ProxyExtra {
                value = 'extra';
            }

            @InjectableProxy()
            class ProxyCycleB2 {
                constructor() {}
            }

            @InjectableProxy()
            class ProxyCycleA2 {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyCycleB2, ProxyExtra],
                ProxyCycleA2,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyCycleA2],
                ProxyCycleB2,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyCycleA2, ProxyCycleB2, ProxyExtra),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects two-node cycle with multiple additional dependencies', async () => {
            @InjectableProxy()
            class ProxyDep1 {
                value = 'dep1';
            }

            @InjectableProxy()
            class ProxyDep2 {
                value = 'dep2';
            }

            @InjectableProxy()
            class ProxyMultiB {
                constructor() {}
            }

            @InjectableProxy()
            class ProxyMultiA {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyDep1, ProxyMultiB, ProxyDep2],
                ProxyMultiA,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyMultiA],
                ProxyMultiB,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    ProxyMultiA,
                    ProxyMultiB,
                    ProxyDep1,
                    ProxyDep2,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects two-node cycle in different modules', async () => {
            @InjectableProxy()
            class ProxyModB {
                constructor() {}
            }

            @InjectableProxy()
            class ProxyModA {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [ProxyModB], ProxyModA);
            Reflect.defineMetadata('design:paramtypes', [ProxyModA], ProxyModB);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyModA),
                ClsModule.forFeature(ProxyModB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects two-node cycle quickly', async () => {
            @InjectableProxy()
            class ProxyFastB {
                constructor() {}
            }

            @InjectableProxy()
            class ProxyFastA {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyFastB],
                ProxyFastA,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyFastA],
                ProxyFastB,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyFastA, ProxyFastB),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(50);
            });
        });

        it('detects User→Auth→User cycle (realistic names)', async () => {
            @InjectableProxy()
            class AuthService {
                constructor() {}
            }

            @InjectableProxy()
            class UserService {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [AuthService],
                UserService,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [UserService],
                AuthService,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(UserService, AuthService),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects Repository→Service→Repository cycle', async () => {
            @InjectableProxy()
            class DataService {
                constructor() {}
            }

            @InjectableProxy()
            class DataRepository {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [DataService],
                DataRepository,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [DataRepository],
                DataService,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(DataRepository, DataService),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects two-node cycle with both nodes having methods', async () => {
            @InjectableProxy()
            class ProxyMethodB {
                constructor() {}

                methodB() {
                    return 'B';
                }
            }

            @InjectableProxy()
            class ProxyMethodA {
                constructor() {}

                methodA() {
                    return 'A';
                }
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyMethodB],
                ProxyMethodA,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyMethodA],
                ProxyMethodB,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyMethodA, ProxyMethodB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects two-node cycle with properties', async () => {
            @InjectableProxy()
            class ProxyPropsB {
                public readonly name = 'B';
                public value = 2;

                constructor() {}
            }

            @InjectableProxy()
            class ProxyPropsA {
                public readonly name = 'A';
                public value = 1;

                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyPropsB],
                ProxyPropsA,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyPropsA],
                ProxyPropsB,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyPropsA, ProxyPropsB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects two-node cycle with generic types', async () => {
            @InjectableProxy()
            class ProxyGenericB {
                constructor() {}
            }

            @InjectableProxy()
            class ProxyGenericA {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyGenericB],
                ProxyGenericA,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyGenericA],
                ProxyGenericB,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyGenericA, ProxyGenericB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects two-node cycle with interfaces', async () => {
            interface IProxyB {
                getValue(): string;
            }

            interface IProxyA {
                getValue(): string;
            }

            @InjectableProxy()
            class ProxyInterfaceB implements IProxyB {
                constructor() {}
                getValue() {
                    return 'B';
                }
            }

            @InjectableProxy()
            class ProxyInterfaceA implements IProxyA {
                constructor() {}
                getValue() {
                    return 'A';
                }
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyInterfaceB],
                ProxyInterfaceA,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyInterfaceA],
                ProxyInterfaceB,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyInterfaceA, ProxyInterfaceB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects two-node cycle with abstract classes', async () => {
            @InjectableProxy()
            abstract class AbstractProxyB {
                abstract getValue(): string;
            }

            @InjectableProxy()
            abstract class AbstractProxyA {
                abstract getValue(): string;
            }

            @InjectableProxy()
            class ConcreteProxyB extends AbstractProxyB {
                constructor() {
                    super();
                }
                getValue() {
                    return 'B';
                }
            }

            @InjectableProxy()
            class ConcreteProxyA extends AbstractProxyA {
                constructor() {
                    super();
                }
                getValue() {
                    return 'A';
                }
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ConcreteProxyB],
                ConcreteProxyA,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ConcreteProxyA],
                ConcreteProxyB,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ConcreteProxyA, ConcreteProxyB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects two-node cycle registered in reverse order', async () => {
            @InjectableProxy()
            class ProxyReverseB {
                constructor() {}
            }

            @InjectableProxy()
            class ProxyReverseA {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyReverseB],
                ProxyReverseA,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyReverseA],
                ProxyReverseB,
            );

            // Register in reverse order (B before A)
            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyReverseB, ProxyReverseA),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });
    });

    describe('3. Three-Node Cycles (15 tests)', () => {
        it('detects A→B→C→A cycle', async () => {
            @InjectableProxy()
            class ProxyC {
                constructor() {}
            }

            @InjectableProxy()
            class ProxyB {
                constructor() {}
            }

            @InjectableProxy()
            class ProxyA {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [ProxyB], ProxyA);
            Reflect.defineMetadata('design:paramtypes', [ProxyC], ProxyB);
            Reflect.defineMetadata('design:paramtypes', [ProxyA], ProxyC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyA, ProxyB, ProxyC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects A→B→C→A starting from different entry point', async () => {
            @InjectableProxy()
            class ThreeC {
                constructor() {}
            }

            @InjectableProxy()
            class ThreeB {
                constructor() {}
            }

            @InjectableProxy()
            class ThreeA {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [ThreeB], ThreeA);
            Reflect.defineMetadata('design:paramtypes', [ThreeC], ThreeB);
            Reflect.defineMetadata('design:paramtypes', [ThreeA], ThreeC);

            // Register in different order
            app = await createAndInitTestingApp([
                ClsModule.forFeature(ThreeC, ThreeA, ThreeB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects three-node cycle with additional non-cyclic dependency', async () => {
            @InjectableProxy()
            class NonCyclic {
                value = 'safe';
            }

            @InjectableProxy()
            class CycleC3 {
                constructor() {}
            }

            @InjectableProxy()
            class CycleB3 {
                constructor() {}
            }

            @InjectableProxy()
            class CycleA3 {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [CycleB3, NonCyclic],
                CycleA3,
            );
            Reflect.defineMetadata('design:paramtypes', [CycleC3], CycleB3);
            Reflect.defineMetadata('design:paramtypes', [CycleA3], CycleC3);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(CycleA3, CycleB3, CycleC3, NonCyclic),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects three-node cycle with multiple additional dependencies', async () => {
            @InjectableProxy()
            class Dep1 {
                value = 'dep1';
            }

            @InjectableProxy()
            class Dep2 {
                value = 'dep2';
            }

            @InjectableProxy()
            class Dep3 {
                value = 'dep3';
            }

            @InjectableProxy()
            class MultiC {
                constructor() {}
            }

            @InjectableProxy()
            class MultiB {
                constructor() {}
            }

            @InjectableProxy()
            class MultiA {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [MultiB, Dep1], MultiA);
            Reflect.defineMetadata('design:paramtypes', [MultiC, Dep2], MultiB);
            Reflect.defineMetadata('design:paramtypes', [MultiA, Dep3], MultiC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(MultiA, MultiB, MultiC, Dep1, Dep2, Dep3),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects three-node cycle quickly', async () => {
            @InjectableProxy()
            class FastC {
                constructor() {}
            }

            @InjectableProxy()
            class FastB {
                constructor() {}
            }

            @InjectableProxy()
            class FastA {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [FastB], FastA);
            Reflect.defineMetadata('design:paramtypes', [FastC], FastB);
            Reflect.defineMetadata('design:paramtypes', [FastA], FastC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(FastA, FastB, FastC),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(50);
            });
        });

        it('detects Controller→Service→Repository→Controller cycle', async () => {
            @InjectableProxy()
            class AppRepository {
                constructor() {}
            }

            @InjectableProxy()
            class AppService {
                constructor() {}
            }

            @InjectableProxy()
            class AppController {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [AppService],
                AppController,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [AppRepository],
                AppService,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [AppController],
                AppRepository,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(AppController, AppService, AppRepository),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects three-node cycle in different modules', async () => {
            @InjectableProxy()
            class ModC {
                constructor() {}
            }

            @InjectableProxy()
            class ModB {
                constructor() {}
            }

            @InjectableProxy()
            class ModA {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [ModB], ModA);
            Reflect.defineMetadata('design:paramtypes', [ModC], ModB);
            Reflect.defineMetadata('design:paramtypes', [ModA], ModC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ModA),
                ClsModule.forFeature(ModB),
                ClsModule.forFeature(ModC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects three-node cycle with complex dependencies', async () => {
            @InjectableProxy()
            class ExtraX {
                value = 'X';
            }

            @InjectableProxy()
            class ExtraY {
                value = 'Y';
            }

            @InjectableProxy()
            class ComplexC {
                constructor() {}
            }

            @InjectableProxy()
            class ComplexB {
                constructor() {}
            }

            @InjectableProxy()
            class ComplexA {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ComplexB, ExtraX, ExtraY],
                ComplexA,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ExtraX, ComplexC],
                ComplexB,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ComplexA, ExtraY],
                ComplexC,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    ComplexA,
                    ComplexB,
                    ComplexC,
                    ExtraX,
                    ExtraY,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects User→Auth→Permission→User cycle', async () => {
            @InjectableProxy()
            class PermissionService {
                constructor() {}
            }

            @InjectableProxy()
            class AuthServiceThree {
                constructor() {}
            }

            @InjectableProxy()
            class UserServiceThree {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [AuthServiceThree],
                UserServiceThree,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [PermissionService],
                AuthServiceThree,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [UserServiceThree],
                PermissionService,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    UserServiceThree,
                    AuthServiceThree,
                    PermissionService,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects three-node cycle with properties and methods', async () => {
            @InjectableProxy()
            class FullC {
                public value = 'C';
                constructor() {}
                getValue() {
                    return this.value;
                }
            }

            @InjectableProxy()
            class FullB {
                public value = 'B';
                constructor() {}
                getValue() {
                    return this.value;
                }
            }

            @InjectableProxy()
            class FullA {
                public value = 'A';
                constructor() {}
                getValue() {
                    return this.value;
                }
            }

            Reflect.defineMetadata('design:paramtypes', [FullB], FullA);
            Reflect.defineMetadata('design:paramtypes', [FullC], FullB);
            Reflect.defineMetadata('design:paramtypes', [FullA], FullC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(FullA, FullB, FullC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects three-node cycle registered in random order', async () => {
            @InjectableProxy()
            class RandomC {
                constructor() {}
            }

            @InjectableProxy()
            class RandomB {
                constructor() {}
            }

            @InjectableProxy()
            class RandomA {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [RandomB], RandomA);
            Reflect.defineMetadata('design:paramtypes', [RandomC], RandomB);
            Reflect.defineMetadata('design:paramtypes', [RandomA], RandomC);

            // Random registration order: B, C, A
            app = await createAndInitTestingApp([
                ClsModule.forFeature(RandomB, RandomC, RandomA),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects three-node cycle with async methods', async () => {
            @InjectableProxy()
            class AsyncC {
                constructor() {}
                async fetchC() {
                    return 'C';
                }
            }

            @InjectableProxy()
            class AsyncB {
                constructor() {}
                async fetchB() {
                    return 'B';
                }
            }

            @InjectableProxy()
            class AsyncA {
                constructor() {}
                async fetchA() {
                    return 'A';
                }
            }

            Reflect.defineMetadata('design:paramtypes', [AsyncB], AsyncA);
            Reflect.defineMetadata('design:paramtypes', [AsyncC], AsyncB);
            Reflect.defineMetadata('design:paramtypes', [AsyncA], AsyncC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(AsyncA, AsyncB, AsyncC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects three-node cycle with static methods', async () => {
            @InjectableProxy()
            class StaticC {
                constructor() {}
                static create() {
                    return new StaticC();
                }
            }

            @InjectableProxy()
            class StaticB {
                constructor() {}
                static create() {
                    return new StaticB();
                }
            }

            @InjectableProxy()
            class StaticA {
                constructor() {}
                static create() {
                    return new StaticA();
                }
            }

            Reflect.defineMetadata('design:paramtypes', [StaticB], StaticA);
            Reflect.defineMetadata('design:paramtypes', [StaticC], StaticB);
            Reflect.defineMetadata('design:paramtypes', [StaticA], StaticC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(StaticA, StaticB, StaticC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects three-node cycle with optional dependencies', async () => {
            @InjectableProxy()
            class OptionalC {
                constructor() {}
            }

            @InjectableProxy()
            class OptionalB {
                constructor(_c?: OptionalC) {}
            }

            @InjectableProxy()
            class OptionalA {
                constructor(_b?: OptionalB) {}
            }

            Reflect.defineMetadata('design:paramtypes', [OptionalB], OptionalA);
            Reflect.defineMetadata('design:paramtypes', [OptionalC], OptionalB);
            Reflect.defineMetadata('design:paramtypes', [OptionalA], OptionalC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(OptionalA, OptionalB, OptionalC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects three-node cycle with all nodes having multiple dependencies', async () => {
            @InjectableProxy()
            class Shared1 {
                value = 'shared1';
            }

            @InjectableProxy()
            class Shared2 {
                value = 'shared2';
            }

            @InjectableProxy()
            class MultiDepC {
                constructor() {}
            }

            @InjectableProxy()
            class MultiDepB {
                constructor() {}
            }

            @InjectableProxy()
            class MultiDepA {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [MultiDepB, Shared1],
                MultiDepA,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [MultiDepC, Shared2],
                MultiDepB,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [MultiDepA, Shared1, Shared2],
                MultiDepC,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    MultiDepA,
                    MultiDepB,
                    MultiDepC,
                    Shared1,
                    Shared2,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });
    });

    describe('4. Error Message Validation (10 tests)', () => {
        it('includes provider names in error message for self-reference', async () => {
            @InjectableProxy()
            class ProxyErrorSelf {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyErrorSelf],
                ProxyErrorSelf,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyErrorSelf),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    /ProxyErrorSelf/,
                );
            });
        });

        it('includes provider names in error message for two-node cycle', async () => {
            @InjectableProxy()
            class ProxyErrorB {
                constructor() {}
            }

            @InjectableProxy()
            class ProxyErrorA {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyErrorB],
                ProxyErrorA,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyErrorA],
                ProxyErrorB,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyErrorA, ProxyErrorB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    /ProxyErrorA/,
                );
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    /ProxyErrorB/,
                );
            });
        });

        it('includes all provider names in three-node cycle error', async () => {
            @InjectableProxy()
            class ProxyErrC {
                constructor() {}
            }

            @InjectableProxy()
            class ProxyErrB {
                constructor() {}
            }

            @InjectableProxy()
            class ProxyErrA {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [ProxyErrB], ProxyErrA);
            Reflect.defineMetadata('design:paramtypes', [ProxyErrC], ProxyErrB);
            Reflect.defineMetadata('design:paramtypes', [ProxyErrA], ProxyErrC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyErrA, ProxyErrB, ProxyErrC),
            ]);

            await cls.run(async () => {
                try {
                    await cls.proxy.resolve();
                    fail('Should have thrown');
                } catch (error: any) {
                    expect(error.message).toMatch(/ProxyErrA/);
                    expect(error.message).toMatch(/ProxyErrB/);
                    expect(error.message).toMatch(/ProxyErrC/);
                }
            });
        });

        it('error message contains "Circular dependency detected"', async () => {
            @InjectableProxy()
            class ProxyMsgTest {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyMsgTest],
                ProxyMsgTest,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyMsgTest),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    /Circular dependency detected/,
                );
            });
        });

        it('error message shows cycle path with arrows', async () => {
            @InjectableProxy()
            class ProxyArrowB {
                constructor() {}
            }

            @InjectableProxy()
            class ProxyArrowA {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyArrowB],
                ProxyArrowA,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyArrowA],
                ProxyArrowB,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyArrowA, ProxyArrowB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(/→/);
            });
        });

        it('error is instance of ProxyProviderCircularDependencyException', async () => {
            @InjectableProxy()
            class ProxyInstanceTest {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyInstanceTest],
                ProxyInstanceTest,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyInstanceTest),
            ]);

            await cls.run(async () => {
                try {
                    await cls.proxy.resolve();
                    fail('Should have thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(
                        ProxyProviderCircularDependencyException,
                    );
                }
            });
        });

        it('error message for UserService→AuthService→UserService is clear', async () => {
            @InjectableProxy()
            class AuthServiceErr {
                constructor() {}
            }

            @InjectableProxy()
            class UserServiceErr {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [AuthServiceErr],
                UserServiceErr,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [UserServiceErr],
                AuthServiceErr,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(UserServiceErr, AuthServiceErr),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    /UserServiceErr.*→.*AuthServiceErr.*→.*UserServiceErr/,
                );
            });
        });

        it('error message includes complete cycle path for A→B→C→A', async () => {
            @InjectableProxy()
            class PathC {
                constructor() {}
            }

            @InjectableProxy()
            class PathB {
                constructor() {}
            }

            @InjectableProxy()
            class PathA {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [PathB], PathA);
            Reflect.defineMetadata('design:paramtypes', [PathC], PathB);
            Reflect.defineMetadata('design:paramtypes', [PathA], PathC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(PathA, PathB, PathC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    /PathA.*→.*PathB.*→.*PathC.*→.*PathA/,
                );
            });
        });

        it('error message for self-reference shows A→A format', async () => {
            @InjectableProxy()
            class SelfFormat {
                constructor() {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [SelfFormat],
                SelfFormat,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(SelfFormat),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    /SelfFormat.*→.*SelfFormat/,
                );
            });
        });

        it('error can be caught and inspected', async () => {
            @InjectableProxy()
            class CatchTest {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [CatchTest], CatchTest);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(CatchTest),
            ]);

            await cls.run(async () => {
                try {
                    await cls.proxy.resolve();
                    fail('Should have thrown');
                } catch (error: any) {
                    expect(error).toBeDefined();
                    expect(error.message).toBeDefined();
                    expect(typeof error.message).toBe('string');
                    expect(error.message.length).toBeGreaterThan(0);
                    expect(error.name).toBe(
                        'ProxyProviderCircularDependencyException',
                    );
                }
            });
        });
    });
});
