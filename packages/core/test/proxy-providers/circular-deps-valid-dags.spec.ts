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

describe('Valid DAGs - No False Positives', () => {
    let app: INestApplication;

    afterEach(async () => {
        if (app) {
            await app.close();
        }
    });

    describe('1. Diamond Dependencies (15 tests)', () => {
        it('allows diamond (A→B,C; B,C→D)', async () => {
            @InjectableProxy()
            class ProxyD {
                value = 'D';
            }

            @InjectableProxy()
            class ProxyC {
                constructor(_d: ProxyD) {}
            }

            @InjectableProxy()
            class ProxyB {
                constructor(_d: ProxyD) {}
            }

            @InjectableProxy()
            class ProxyA {
                constructor(_b: ProxyB, _c: ProxyC) {}
            }

            Reflect.defineMetadata('design:paramtypes', [ProxyD], ProxyC);
            Reflect.defineMetadata('design:paramtypes', [ProxyD], ProxyB);
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyB, ProxyC],
                ProxyA,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyA, ProxyB, ProxyC, ProxyD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows nested diamonds', async () => {
            @InjectableProxy()
            class ProxyF {
                value = 'F';
            }

            @InjectableProxy()
            class ProxyE {
                constructor(_f: ProxyF) {}
            }

            @InjectableProxy()
            class ProxyD {
                constructor(_f: ProxyF) {}
            }

            @InjectableProxy()
            class ProxyC {
                constructor(_d: ProxyD, _e: ProxyE) {}
            }

            @InjectableProxy()
            class ProxyB {
                constructor(_d: ProxyD, _e: ProxyE) {}
            }

            @InjectableProxy()
            class ProxyA {
                constructor(_b: ProxyB, _c: ProxyC) {}
            }

            Reflect.defineMetadata('design:paramtypes', [ProxyF], ProxyE);
            Reflect.defineMetadata('design:paramtypes', [ProxyF], ProxyD);
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyD, ProxyE],
                ProxyC,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyD, ProxyE],
                ProxyB,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyB, ProxyC],
                ProxyA,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    ProxyA,
                    ProxyB,
                    ProxyC,
                    ProxyD,
                    ProxyE,
                    ProxyF,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows diamond with different depths', async () => {
            @InjectableProxy()
            class ProxyTarget {
                value = 'target';
            }

            @InjectableProxy()
            class ProxyLongC {
                constructor(_t: ProxyTarget) {}
            }

            @InjectableProxy()
            class ProxyLongB {
                constructor(_c: ProxyLongC) {}
            }

            @InjectableProxy()
            class ProxyShortB {
                constructor(_t: ProxyTarget) {}
            }

            @InjectableProxy()
            class ProxyRoot {
                constructor(_long: ProxyLongB, _short: ProxyShortB) {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyTarget],
                ProxyLongC,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyLongC],
                ProxyLongB,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyTarget],
                ProxyShortB,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyLongB, ProxyShortB],
                ProxyRoot,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    ProxyRoot,
                    ProxyLongB,
                    ProxyShortB,
                    ProxyLongC,
                    ProxyTarget,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows wide diamond (A→B,C,D,E; B,C,D,E→F)', async () => {
            @InjectableProxy()
            class ProxyF {
                value = 'F';
            }

            @InjectableProxy()
            class ProxyE {
                constructor(_f: ProxyF) {}
            }

            @InjectableProxy()
            class ProxyD {
                constructor(_f: ProxyF) {}
            }

            @InjectableProxy()
            class ProxyC {
                constructor(_f: ProxyF) {}
            }

            @InjectableProxy()
            class ProxyB {
                constructor(_f: ProxyF) {}
            }

            @InjectableProxy()
            class ProxyA {
                constructor(_b: ProxyB, _c: ProxyC, _d: ProxyD, _e: ProxyE) {}
            }

            Reflect.defineMetadata('design:paramtypes', [ProxyF], ProxyE);
            Reflect.defineMetadata('design:paramtypes', [ProxyF], ProxyD);
            Reflect.defineMetadata('design:paramtypes', [ProxyF], ProxyC);
            Reflect.defineMetadata('design:paramtypes', [ProxyF], ProxyB);
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyB, ProxyC, ProxyD, ProxyE],
                ProxyA,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    ProxyA,
                    ProxyB,
                    ProxyC,
                    ProxyD,
                    ProxyE,
                    ProxyF,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows diamond with multiple shared leaves', async () => {
            @InjectableProxy()
            class SharedX {
                value = 'X';
            }

            @InjectableProxy()
            class SharedY {
                value = 'Y';
            }

            @InjectableProxy()
            class ProxyRight {
                constructor(_x: SharedX, _y: SharedY) {}
            }

            @InjectableProxy()
            class ProxyLeft {
                constructor(_x: SharedX, _y: SharedY) {}
            }

            @InjectableProxy()
            class ProxyTop {
                constructor(_left: ProxyLeft, _right: ProxyRight) {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [SharedX, SharedY],
                ProxyRight,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [SharedX, SharedY],
                ProxyLeft,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyLeft, ProxyRight],
                ProxyTop,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    ProxyTop,
                    ProxyLeft,
                    ProxyRight,
                    SharedX,
                    SharedY,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows diamond registered in different order', async () => {
            @InjectableProxy()
            class OrderD {
                value = 'D';
            }

            @InjectableProxy()
            class OrderC {
                constructor(_d: OrderD) {}
            }

            @InjectableProxy()
            class OrderB {
                constructor(_d: OrderD) {}
            }

            @InjectableProxy()
            class OrderA {
                constructor(_b: OrderB, _c: OrderC) {}
            }

            Reflect.defineMetadata('design:paramtypes', [OrderD], OrderC);
            Reflect.defineMetadata('design:paramtypes', [OrderD], OrderB);
            Reflect.defineMetadata(
                'design:paramtypes',
                [OrderB, OrderC],
                OrderA,
            );

            // Register in non-topological order
            app = await createAndInitTestingApp([
                ClsModule.forFeature(OrderD, OrderA, OrderC, OrderB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows diamond in mixed registration patterns', async () => {
            @InjectableProxy()
            class MixD {
                value = 'D';
            }

            @InjectableProxy()
            class MixC {
                constructor(_d: MixD) {}
            }

            @InjectableProxy()
            class MixB {
                constructor(_d: MixD) {}
            }

            @InjectableProxy()
            class MixA {
                constructor(_b: MixB, _c: MixC) {}
            }

            Reflect.defineMetadata('design:paramtypes', [MixD], MixC);
            Reflect.defineMetadata('design:paramtypes', [MixD], MixB);
            Reflect.defineMetadata('design:paramtypes', [MixB, MixC], MixA);

            // Register all together to ensure visibility
            app = await createAndInitTestingApp([
                ClsModule.forFeature(MixA, MixB, MixC, MixD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows multiple overlapping diamonds', async () => {
            @InjectableProxy()
            class BaseZ {
                value = 'Z';
            }

            @InjectableProxy()
            class BaseY {
                constructor(_z: BaseZ) {}
            }

            @InjectableProxy()
            class PathD {
                constructor(_y: BaseY) {}
            }

            @InjectableProxy()
            class PathC {
                constructor(_y: BaseY) {}
            }

            @InjectableProxy()
            class PathB {
                constructor(_c: PathC, _d: PathD) {}
            }

            @InjectableProxy()
            class PathA {
                constructor(_c: PathC, _d: PathD) {}
            }

            @InjectableProxy()
            class Root {
                constructor(_a: PathA, _b: PathB) {}
            }

            Reflect.defineMetadata('design:paramtypes', [BaseZ], BaseY);
            Reflect.defineMetadata('design:paramtypes', [BaseY], PathD);
            Reflect.defineMetadata('design:paramtypes', [BaseY], PathC);
            Reflect.defineMetadata('design:paramtypes', [PathC, PathD], PathB);
            Reflect.defineMetadata('design:paramtypes', [PathC, PathD], PathA);
            Reflect.defineMetadata('design:paramtypes', [PathA, PathB], Root);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    Root,
                    PathA,
                    PathB,
                    PathC,
                    PathD,
                    BaseY,
                    BaseZ,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows diamond with realistic service names', async () => {
            @InjectableProxy()
            class DatabaseConnection {
                value = 'db';
            }

            @InjectableProxy()
            class CacheService {
                constructor(_db: DatabaseConnection) {}
            }

            @InjectableProxy()
            class LoggerService {
                constructor(_db: DatabaseConnection) {}
            }

            @InjectableProxy()
            class UserService {
                constructor(_cache: CacheService, _logger: LoggerService) {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [DatabaseConnection],
                CacheService,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [DatabaseConnection],
                LoggerService,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [CacheService, LoggerService],
                UserService,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    UserService,
                    CacheService,
                    LoggerService,
                    DatabaseConnection,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows diamond with properties and methods', async () => {
            @InjectableProxy()
            class PropsD {
                public value = 'D';
                getValue() {
                    return this.value;
                }
            }

            @InjectableProxy()
            class PropsC {
                constructor(_d: PropsD) {}
            }

            @InjectableProxy()
            class PropsB {
                constructor(_d: PropsD) {}
            }

            @InjectableProxy()
            class PropsA {
                constructor(_b: PropsB, _c: PropsC) {}
            }

            Reflect.defineMetadata('design:paramtypes', [PropsD], PropsC);
            Reflect.defineMetadata('design:paramtypes', [PropsD], PropsB);
            Reflect.defineMetadata(
                'design:paramtypes',
                [PropsB, PropsC],
                PropsA,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(PropsA, PropsB, PropsC, PropsD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows diamond with async methods', async () => {
            @InjectableProxy()
            class AsyncD {
                async fetch() {
                    return 'D';
                }
            }

            @InjectableProxy()
            class AsyncC {
                constructor(_d: AsyncD) {}
            }

            @InjectableProxy()
            class AsyncB {
                constructor(_d: AsyncD) {}
            }

            @InjectableProxy()
            class AsyncA {
                constructor(_b: AsyncB, _c: AsyncC) {}
            }

            Reflect.defineMetadata('design:paramtypes', [AsyncD], AsyncC);
            Reflect.defineMetadata('design:paramtypes', [AsyncD], AsyncB);
            Reflect.defineMetadata(
                'design:paramtypes',
                [AsyncB, AsyncC],
                AsyncA,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(AsyncA, AsyncB, AsyncC, AsyncD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows diamond with optional dependencies', async () => {
            @InjectableProxy()
            class OptD {
                value = 'D';
            }

            @InjectableProxy()
            class OptC {
                constructor(_d?: OptD) {}
            }

            @InjectableProxy()
            class OptB {
                constructor(_d?: OptD) {}
            }

            @InjectableProxy()
            class OptA {
                constructor(_b?: OptB, _c?: OptC) {}
            }

            Reflect.defineMetadata('design:paramtypes', [OptD], OptC);
            Reflect.defineMetadata('design:paramtypes', [OptD], OptB);
            Reflect.defineMetadata('design:paramtypes', [OptB, OptC], OptA);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(OptA, OptB, OptC, OptD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('resolves diamond quickly', async () => {
            @InjectableProxy()
            class FastD {
                value = 'D';
            }

            @InjectableProxy()
            class FastC {
                constructor(_d: FastD) {}
            }

            @InjectableProxy()
            class FastB {
                constructor(_d: FastD) {}
            }

            @InjectableProxy()
            class FastA {
                constructor(_b: FastB, _c: FastC) {}
            }

            Reflect.defineMetadata('design:paramtypes', [FastD], FastC);
            Reflect.defineMetadata('design:paramtypes', [FastD], FastB);
            Reflect.defineMetadata('design:paramtypes', [FastB, FastC], FastA);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(FastA, FastB, FastC, FastD),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(100);
            });
        });

        it('allows triple diamond (three convergent paths)', async () => {
            @InjectableProxy()
            class TripleD {
                value = 'D';
            }

            @InjectableProxy()
            class TripleC {
                constructor(_d: TripleD) {}
            }

            @InjectableProxy()
            class TripleB {
                constructor(_d: TripleD) {}
            }

            @InjectableProxy()
            class TripleA {
                constructor(_d: TripleD) {}
            }

            @InjectableProxy()
            class Root {
                constructor(_a: TripleA, _b: TripleB, _c: TripleC) {}
            }

            Reflect.defineMetadata('design:paramtypes', [TripleD], TripleC);
            Reflect.defineMetadata('design:paramtypes', [TripleD], TripleB);
            Reflect.defineMetadata('design:paramtypes', [TripleD], TripleA);
            Reflect.defineMetadata(
                'design:paramtypes',
                [TripleA, TripleB, TripleC],
                Root,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Root, TripleA, TripleB, TripleC, TripleD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows diamond with interfaces', async () => {
            interface IService {
                getValue(): string;
            }

            @InjectableProxy()
            class ImplD implements IService {
                getValue() {
                    return 'D';
                }
            }

            @InjectableProxy()
            class ImplC {
                constructor(_d: ImplD) {}
            }

            @InjectableProxy()
            class ImplB {
                constructor(_d: ImplD) {}
            }

            @InjectableProxy()
            class ImplA {
                constructor(_b: ImplB, _c: ImplC) {}
            }

            Reflect.defineMetadata('design:paramtypes', [ImplD], ImplC);
            Reflect.defineMetadata('design:paramtypes', [ImplD], ImplB);
            Reflect.defineMetadata('design:paramtypes', [ImplB, ImplC], ImplA);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ImplA, ImplB, ImplC, ImplD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });
    });

    describe('2. Linear Chains (10 tests)', () => {
        it('allows simple linear chain (A→B→C→D)', async () => {
            @InjectableProxy()
            class ProxyD {
                value = 'D';
            }

            @InjectableProxy()
            class ProxyC {
                constructor(_d: ProxyD) {}
            }

            @InjectableProxy()
            class ProxyB {
                constructor(_c: ProxyC) {}
            }

            @InjectableProxy()
            class ProxyA {
                constructor(_b: ProxyB) {}
            }

            Reflect.defineMetadata('design:paramtypes', [ProxyD], ProxyC);
            Reflect.defineMetadata('design:paramtypes', [ProxyC], ProxyB);
            Reflect.defineMetadata('design:paramtypes', [ProxyB], ProxyA);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyA, ProxyB, ProxyC, ProxyD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows long linear chain (20+ nodes)', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 20; i++) {
                @InjectableProxy()
                class ProxyChain {
                    value = `Chain${i}`;
                }
                Object.defineProperty(ProxyChain, 'name', {
                    value: `Chain${i}`,
                });
                classes.push(ProxyChain);
            }

            // Set up linear dependencies: Chain0→Chain1→...→Chain19
            for (let i = 0; i < 19; i++) {
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
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows linear chain registered in reverse order', async () => {
            @InjectableProxy()
            class RevD {
                value = 'D';
            }

            @InjectableProxy()
            class RevC {
                constructor(_d: RevD) {}
            }

            @InjectableProxy()
            class RevB {
                constructor(_c: RevC) {}
            }

            @InjectableProxy()
            class RevA {
                constructor(_b: RevB) {}
            }

            Reflect.defineMetadata('design:paramtypes', [RevD], RevC);
            Reflect.defineMetadata('design:paramtypes', [RevC], RevB);
            Reflect.defineMetadata('design:paramtypes', [RevB], RevA);

            // Register in reverse order
            app = await createAndInitTestingApp([
                ClsModule.forFeature(RevD, RevC, RevB, RevA),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows linear chain with realistic service names', async () => {
            @InjectableProxy()
            class DatabaseService {
                value = 'db';
            }

            @InjectableProxy()
            class RepositoryService {
                constructor(_db: DatabaseService) {}
            }

            @InjectableProxy()
            class BusinessService {
                constructor(_repo: RepositoryService) {}
            }

            @InjectableProxy()
            class ControllerService {
                constructor(_business: BusinessService) {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [DatabaseService],
                RepositoryService,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [RepositoryService],
                BusinessService,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [BusinessService],
                ControllerService,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    ControllerService,
                    BusinessService,
                    RepositoryService,
                    DatabaseService,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows linear chain with properties', async () => {
            @InjectableProxy()
            class PropD {
                public value = 'D';
            }

            @InjectableProxy()
            class PropC {
                public value = 'C';
                constructor(_d: PropD) {}
            }

            @InjectableProxy()
            class PropB {
                public value = 'B';
                constructor(_c: PropC) {}
            }

            @InjectableProxy()
            class PropA {
                public value = 'A';
                constructor(_b: PropB) {}
            }

            Reflect.defineMetadata('design:paramtypes', [PropD], PropC);
            Reflect.defineMetadata('design:paramtypes', [PropC], PropB);
            Reflect.defineMetadata('design:paramtypes', [PropB], PropA);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(PropA, PropB, PropC, PropD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows linear chain with scattered registration', async () => {
            @InjectableProxy()
            class ScatterD {
                value = 'D';
            }

            @InjectableProxy()
            class ScatterC {
                constructor(_d: ScatterD) {}
            }

            @InjectableProxy()
            class ScatterB {
                constructor(_c: ScatterC) {}
            }

            @InjectableProxy()
            class ScatterA {
                constructor(_b: ScatterB) {}
            }

            Reflect.defineMetadata('design:paramtypes', [ScatterD], ScatterC);
            Reflect.defineMetadata('design:paramtypes', [ScatterC], ScatterB);
            Reflect.defineMetadata('design:paramtypes', [ScatterB], ScatterA);

            // Register all together to ensure visibility
            app = await createAndInitTestingApp([
                ClsModule.forFeature(ScatterA, ScatterB, ScatterC, ScatterD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('resolves linear chain quickly', async () => {
            @InjectableProxy()
            class FastD {
                value = 'D';
            }

            @InjectableProxy()
            class FastC {
                constructor(_d: FastD) {}
            }

            @InjectableProxy()
            class FastB {
                constructor(_c: FastC) {}
            }

            @InjectableProxy()
            class FastA {
                constructor(_b: FastB) {}
            }

            Reflect.defineMetadata('design:paramtypes', [FastD], FastC);
            Reflect.defineMetadata('design:paramtypes', [FastC], FastB);
            Reflect.defineMetadata('design:paramtypes', [FastB], FastA);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(FastA, FastB, FastC, FastD),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(100);
            });
        });

        it('allows linear chain with optional dependencies', async () => {
            @InjectableProxy()
            class OptD {
                value = 'D';
            }

            @InjectableProxy()
            class OptC {
                constructor(_d?: OptD) {}
            }

            @InjectableProxy()
            class OptB {
                constructor(_c?: OptC) {}
            }

            @InjectableProxy()
            class OptA {
                constructor(_b?: OptB) {}
            }

            Reflect.defineMetadata('design:paramtypes', [OptD], OptC);
            Reflect.defineMetadata('design:paramtypes', [OptC], OptB);
            Reflect.defineMetadata('design:paramtypes', [OptB], OptA);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(OptA, OptB, OptC, OptD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows linear chain with async methods', async () => {
            @InjectableProxy()
            class AsyncD {
                async fetch() {
                    return 'D';
                }
            }

            @InjectableProxy()
            class AsyncC {
                constructor(_d: AsyncD) {}
            }

            @InjectableProxy()
            class AsyncB {
                constructor(_c: AsyncC) {}
            }

            @InjectableProxy()
            class AsyncA {
                constructor(_b: AsyncB) {}
            }

            Reflect.defineMetadata('design:paramtypes', [AsyncD], AsyncC);
            Reflect.defineMetadata('design:paramtypes', [AsyncC], AsyncB);
            Reflect.defineMetadata('design:paramtypes', [AsyncB], AsyncA);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(AsyncA, AsyncB, AsyncC, AsyncD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows single provider with no dependencies', async () => {
            @InjectableProxy()
            class Standalone {
                value = 'standalone';
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Standalone),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });
    });

    describe('3. Tree Structures (15 tests)', () => {
        it('allows binary tree (A→B,C; B→D,E; C→F,G)', async () => {
            @InjectableProxy()
            class ProxyG {
                value = 'G';
            }

            @InjectableProxy()
            class ProxyF {
                value = 'F';
            }

            @InjectableProxy()
            class ProxyE {
                value = 'E';
            }

            @InjectableProxy()
            class ProxyD {
                value = 'D';
            }

            @InjectableProxy()
            class ProxyC {
                constructor(_f: ProxyF, _g: ProxyG) {}
            }

            @InjectableProxy()
            class ProxyB {
                constructor(_d: ProxyD, _e: ProxyE) {}
            }

            @InjectableProxy()
            class ProxyA {
                constructor(_b: ProxyB, _c: ProxyC) {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyF, ProxyG],
                ProxyC,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyD, ProxyE],
                ProxyB,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ProxyB, ProxyC],
                ProxyA,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    ProxyA,
                    ProxyB,
                    ProxyC,
                    ProxyD,
                    ProxyE,
                    ProxyF,
                    ProxyG,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows unbalanced tree (left deeper than right)', async () => {
            @InjectableProxy()
            class LeafD {
                value = 'D';
            }

            @InjectableProxy()
            class LeafC {
                constructor(_d: LeafD) {}
            }

            @InjectableProxy()
            class LeafB {
                constructor(_c: LeafC) {}
            }

            @InjectableProxy()
            class LeafA {
                value = 'A';
            }

            @InjectableProxy()
            class Root {
                constructor(_deep: LeafB, _shallow: LeafA) {}
            }

            Reflect.defineMetadata('design:paramtypes', [LeafD], LeafC);
            Reflect.defineMetadata('design:paramtypes', [LeafC], LeafB);
            Reflect.defineMetadata('design:paramtypes', [LeafB, LeafA], Root);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Root, LeafB, LeafA, LeafC, LeafD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows wide tree (root with many children)', async () => {
            @InjectableProxy()
            class ChildF {
                value = 'F';
            }

            @InjectableProxy()
            class ChildE {
                value = 'E';
            }

            @InjectableProxy()
            class ChildD {
                value = 'D';
            }

            @InjectableProxy()
            class ChildC {
                value = 'C';
            }

            @InjectableProxy()
            class ChildB {
                value = 'B';
            }

            @InjectableProxy()
            class ChildA {
                value = 'A';
            }

            @InjectableProxy()
            class WideRoot {
                constructor(
                    _a: ChildA,
                    _b: ChildB,
                    _c: ChildC,
                    _d: ChildD,
                    _e: ChildE,
                    _f: ChildF,
                ) {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ChildA, ChildB, ChildC, ChildD, ChildE, ChildF],
                WideRoot,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    WideRoot,
                    ChildA,
                    ChildB,
                    ChildC,
                    ChildD,
                    ChildE,
                    ChildF,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows deep tree (5+ levels)', async () => {
            @InjectableProxy()
            class Level5 {
                value = 'L5';
            }

            @InjectableProxy()
            class Level4 {
                constructor(_l5: Level5) {}
            }

            @InjectableProxy()
            class Level3 {
                constructor(_l4: Level4) {}
            }

            @InjectableProxy()
            class Level2 {
                constructor(_l3: Level3) {}
            }

            @InjectableProxy()
            class Level1 {
                constructor(_l2: Level2) {}
            }

            @InjectableProxy()
            class Level0 {
                constructor(_l1: Level1) {}
            }

            Reflect.defineMetadata('design:paramtypes', [Level5], Level4);
            Reflect.defineMetadata('design:paramtypes', [Level4], Level3);
            Reflect.defineMetadata('design:paramtypes', [Level3], Level2);
            Reflect.defineMetadata('design:paramtypes', [Level2], Level1);
            Reflect.defineMetadata('design:paramtypes', [Level1], Level0);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    Level0,
                    Level1,
                    Level2,
                    Level3,
                    Level4,
                    Level5,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows ternary tree (3 children per node)', async () => {
            @InjectableProxy()
            class Leaf1 {
                value = '1';
            }

            @InjectableProxy()
            class Leaf2 {
                value = '2';
            }

            @InjectableProxy()
            class Leaf3 {
                value = '3';
            }

            @InjectableProxy()
            class Leaf4 {
                value = '4';
            }

            @InjectableProxy()
            class Leaf5 {
                value = '5';
            }

            @InjectableProxy()
            class Leaf6 {
                value = '6';
            }

            @InjectableProxy()
            class Branch2 {
                constructor(_l4: Leaf4, _l5: Leaf5, _l6: Leaf6) {}
            }

            @InjectableProxy()
            class Branch1 {
                constructor(_l1: Leaf1, _l2: Leaf2, _l3: Leaf3) {}
            }

            @InjectableProxy()
            class TernaryRoot {
                constructor(_b1: Branch1, _b2: Branch2, _l: Leaf1) {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [Leaf4, Leaf5, Leaf6],
                Branch2,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [Leaf1, Leaf2, Leaf3],
                Branch1,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [Branch1, Branch2, Leaf1],
                TernaryRoot,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    TernaryRoot,
                    Branch1,
                    Branch2,
                    Leaf1,
                    Leaf2,
                    Leaf3,
                    Leaf4,
                    Leaf5,
                    Leaf6,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows tree registered in random order', async () => {
            @InjectableProxy()
            class RandG {
                value = 'G';
            }

            @InjectableProxy()
            class RandF {
                value = 'F';
            }

            @InjectableProxy()
            class RandE {
                value = 'E';
            }

            @InjectableProxy()
            class RandD {
                value = 'D';
            }

            @InjectableProxy()
            class RandC {
                constructor(_f: RandF, _g: RandG) {}
            }

            @InjectableProxy()
            class RandB {
                constructor(_d: RandD, _e: RandE) {}
            }

            @InjectableProxy()
            class RandA {
                constructor(_b: RandB, _c: RandC) {}
            }

            Reflect.defineMetadata('design:paramtypes', [RandF, RandG], RandC);
            Reflect.defineMetadata('design:paramtypes', [RandD, RandE], RandB);
            Reflect.defineMetadata('design:paramtypes', [RandB, RandC], RandA);

            // Random registration order
            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    RandE,
                    RandA,
                    RandG,
                    RandB,
                    RandD,
                    RandC,
                    RandF,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows tree with realistic service names', async () => {
            @InjectableProxy()
            class ConfigService {
                value = 'config';
            }

            @InjectableProxy()
            class DatabaseService {
                value = 'db';
            }

            @InjectableProxy()
            class CacheService {
                constructor(_config: ConfigService) {}
            }

            @InjectableProxy()
            class LoggerService {
                constructor(_config: ConfigService) {}
            }

            @InjectableProxy()
            class RepositoryService {
                constructor(_db: DatabaseService, _cache: CacheService) {}
            }

            @InjectableProxy()
            class AuthService {
                constructor(_repo: RepositoryService, _logger: LoggerService) {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ConfigService],
                CacheService,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ConfigService],
                LoggerService,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [DatabaseService, CacheService],
                RepositoryService,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [RepositoryService, LoggerService],
                AuthService,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    AuthService,
                    RepositoryService,
                    LoggerService,
                    CacheService,
                    DatabaseService,
                    ConfigService,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows tree with varied registration', async () => {
            @InjectableProxy()
            class VarG {
                value = 'G';
            }

            @InjectableProxy()
            class VarF {
                value = 'F';
            }

            @InjectableProxy()
            class VarE {
                value = 'E';
            }

            @InjectableProxy()
            class VarD {
                value = 'D';
            }

            @InjectableProxy()
            class VarC {
                constructor(_f: VarF, _g: VarG) {}
            }

            @InjectableProxy()
            class VarB {
                constructor(_d: VarD, _e: VarE) {}
            }

            @InjectableProxy()
            class VarA {
                constructor(_b: VarB, _c: VarC) {}
            }

            Reflect.defineMetadata('design:paramtypes', [VarF, VarG], VarC);
            Reflect.defineMetadata('design:paramtypes', [VarD, VarE], VarB);
            Reflect.defineMetadata('design:paramtypes', [VarB, VarC], VarA);

            // Register all together to ensure visibility
            app = await createAndInitTestingApp([
                ClsModule.forFeature(VarA, VarB, VarC, VarD, VarE, VarF, VarG),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('resolves tree quickly', async () => {
            @InjectableProxy()
            class FastG {
                value = 'G';
            }

            @InjectableProxy()
            class FastF {
                value = 'F';
            }

            @InjectableProxy()
            class FastE {
                value = 'E';
            }

            @InjectableProxy()
            class FastD {
                value = 'D';
            }

            @InjectableProxy()
            class FastC {
                constructor(_f: FastF, _g: FastG) {}
            }

            @InjectableProxy()
            class FastB {
                constructor(_d: FastD, _e: FastE) {}
            }

            @InjectableProxy()
            class FastA {
                constructor(_b: FastB, _c: FastC) {}
            }

            Reflect.defineMetadata('design:paramtypes', [FastF, FastG], FastC);
            Reflect.defineMetadata('design:paramtypes', [FastD, FastE], FastB);
            Reflect.defineMetadata('design:paramtypes', [FastB, FastC], FastA);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    FastA,
                    FastB,
                    FastC,
                    FastD,
                    FastE,
                    FastF,
                    FastG,
                ),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(100);
            });
        });

        it('allows tree with properties', async () => {
            @InjectableProxy()
            class PropG {
                public value = 'G';
            }

            @InjectableProxy()
            class PropF {
                public value = 'F';
            }

            @InjectableProxy()
            class PropE {
                public value = 'E';
            }

            @InjectableProxy()
            class PropD {
                public value = 'D';
            }

            @InjectableProxy()
            class PropC {
                public value = 'C';
                constructor(_f: PropF, _g: PropG) {}
            }

            @InjectableProxy()
            class PropB {
                public value = 'B';
                constructor(_d: PropD, _e: PropE) {}
            }

            @InjectableProxy()
            class PropA {
                public value = 'A';
                constructor(_b: PropB, _c: PropC) {}
            }

            Reflect.defineMetadata('design:paramtypes', [PropF, PropG], PropC);
            Reflect.defineMetadata('design:paramtypes', [PropD, PropE], PropB);
            Reflect.defineMetadata('design:paramtypes', [PropB, PropC], PropA);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    PropA,
                    PropB,
                    PropC,
                    PropD,
                    PropE,
                    PropF,
                    PropG,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows tree with optional dependencies', async () => {
            @InjectableProxy()
            class OptG {
                value = 'G';
            }

            @InjectableProxy()
            class OptF {
                value = 'F';
            }

            @InjectableProxy()
            class OptE {
                value = 'E';
            }

            @InjectableProxy()
            class OptD {
                value = 'D';
            }

            @InjectableProxy()
            class OptC {
                constructor(_f?: OptF, _g?: OptG) {}
            }

            @InjectableProxy()
            class OptB {
                constructor(_d?: OptD, _e?: OptE) {}
            }

            @InjectableProxy()
            class OptA {
                constructor(_b?: OptB, _c?: OptC) {}
            }

            Reflect.defineMetadata('design:paramtypes', [OptF, OptG], OptC);
            Reflect.defineMetadata('design:paramtypes', [OptD, OptE], OptB);
            Reflect.defineMetadata('design:paramtypes', [OptB, OptC], OptA);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(OptA, OptB, OptC, OptD, OptE, OptF, OptG),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows tree with async methods', async () => {
            @InjectableProxy()
            class AsyncG {
                async fetch() {
                    return 'G';
                }
            }

            @InjectableProxy()
            class AsyncF {
                async fetch() {
                    return 'F';
                }
            }

            @InjectableProxy()
            class AsyncE {
                async fetch() {
                    return 'E';
                }
            }

            @InjectableProxy()
            class AsyncD {
                async fetch() {
                    return 'D';
                }
            }

            @InjectableProxy()
            class AsyncC {
                constructor(_f: AsyncF, _g: AsyncG) {}
            }

            @InjectableProxy()
            class AsyncB {
                constructor(_d: AsyncD, _e: AsyncE) {}
            }

            @InjectableProxy()
            class AsyncA {
                constructor(_b: AsyncB, _c: AsyncC) {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [AsyncF, AsyncG],
                AsyncC,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [AsyncD, AsyncE],
                AsyncB,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [AsyncB, AsyncC],
                AsyncA,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    AsyncA,
                    AsyncB,
                    AsyncC,
                    AsyncD,
                    AsyncE,
                    AsyncF,
                    AsyncG,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows asymmetric tree', async () => {
            @InjectableProxy()
            class AsymD {
                value = 'D';
            }

            @InjectableProxy()
            class AsymC {
                constructor(_d: AsymD) {}
            }

            @InjectableProxy()
            class AsymB {
                constructor(_c: AsymC) {}
            }

            @InjectableProxy()
            class AsymA {
                value = 'A';
            }

            @InjectableProxy()
            class Root {
                constructor(_a: AsymA, _b: AsymB) {}
            }

            Reflect.defineMetadata('design:paramtypes', [AsymD], AsymC);
            Reflect.defineMetadata('design:paramtypes', [AsymC], AsymB);
            Reflect.defineMetadata('design:paramtypes', [AsymA, AsymB], Root);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Root, AsymA, AsymB, AsymC, AsymD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows full binary tree (all leaves at same depth)', async () => {
            @InjectableProxy()
            class FullH {
                value = 'H';
            }

            @InjectableProxy()
            class FullG {
                value = 'G';
            }

            @InjectableProxy()
            class FullF {
                value = 'F';
            }

            @InjectableProxy()
            class FullE {
                value = 'E';
            }

            @InjectableProxy()
            class FullD {
                constructor(_g: FullG, _h: FullH) {}
            }

            @InjectableProxy()
            class FullC {
                constructor(_e: FullE, _f: FullF) {}
            }

            @InjectableProxy()
            class FullB {
                constructor(_c: FullC, _d: FullD) {}
            }

            @InjectableProxy()
            class FullA {
                constructor(_b: FullB) {}
            }

            Reflect.defineMetadata('design:paramtypes', [FullG, FullH], FullD);
            Reflect.defineMetadata('design:paramtypes', [FullE, FullF], FullC);
            Reflect.defineMetadata('design:paramtypes', [FullC, FullD], FullB);
            Reflect.defineMetadata('design:paramtypes', [FullB], FullA);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    FullA,
                    FullB,
                    FullC,
                    FullD,
                    FullE,
                    FullF,
                    FullG,
                    FullH,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows tree with static factory methods', async () => {
            @InjectableProxy()
            class StaticLeaf {
                value = 'leaf';
                static create() {
                    return new StaticLeaf();
                }
            }

            @InjectableProxy()
            class StaticBranch {
                constructor(_leaf: StaticLeaf) {}
                static create() {
                    return new StaticBranch(new StaticLeaf());
                }
            }

            @InjectableProxy()
            class StaticRoot {
                constructor(_branch: StaticBranch) {}
                static create() {
                    return new StaticRoot(StaticBranch.create());
                }
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [StaticLeaf],
                StaticBranch,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [StaticBranch],
                StaticRoot,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(StaticRoot, StaticBranch, StaticLeaf),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });
    });

    describe('4. Mixed Valid Patterns (10 tests)', () => {
        it('allows multiple disconnected DAGs', async () => {
            // DAG 1: A→B
            @InjectableProxy()
            class ProxyB1 {
                value = 'B1';
            }

            @InjectableProxy()
            class ProxyA1 {
                constructor(_b: ProxyB1) {}
            }

            // DAG 2: C→D
            @InjectableProxy()
            class ProxyD2 {
                value = 'D2';
            }

            @InjectableProxy()
            class ProxyC2 {
                constructor(_d: ProxyD2) {}
            }

            Reflect.defineMetadata('design:paramtypes', [ProxyB1], ProxyA1);
            Reflect.defineMetadata('design:paramtypes', [ProxyD2], ProxyC2);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyA1, ProxyB1, ProxyC2, ProxyD2),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows DAG with shared leaves across branches', async () => {
            @InjectableProxy()
            class Shared {
                value = 'shared';
            }

            @InjectableProxy()
            class BranchD {
                constructor(_s: Shared) {}
            }

            @InjectableProxy()
            class BranchC {
                constructor(_s: Shared) {}
            }

            @InjectableProxy()
            class BranchB {
                constructor(_c: BranchC, _s: Shared) {}
            }

            @InjectableProxy()
            class BranchA {
                constructor(_d: BranchD, _s: Shared) {}
            }

            @InjectableProxy()
            class Root {
                constructor(_a: BranchA, _b: BranchB) {}
            }

            Reflect.defineMetadata('design:paramtypes', [Shared], BranchD);
            Reflect.defineMetadata('design:paramtypes', [Shared], BranchC);
            Reflect.defineMetadata(
                'design:paramtypes',
                [BranchC, Shared],
                BranchB,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [BranchD, Shared],
                BranchA,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [BranchA, BranchB],
                Root,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    Root,
                    BranchA,
                    BranchB,
                    BranchC,
                    BranchD,
                    Shared,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows large valid graph (100+ providers)', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 100; i++) {
                @InjectableProxy()
                class ProxyLarge {
                    value = `Large${i}`;
                }
                Object.defineProperty(ProxyLarge, 'name', {
                    value: `Large${i}`,
                });
                classes.push(ProxyLarge);
            }

            // Create tree structure: each node depends on next two nodes
            // Large0→[Large1, Large2], Large1→[Large3, Large4], etc.
            for (let i = 0; i < 50 && 2 * i + 2 < 100; i++) {
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
                expect(duration).toBeLessThan(200);
            });
        });

        it('allows complex real-world scenario', async () => {
            @InjectableProxy()
            class ConfigService {
                value = 'config';
            }

            @InjectableProxy()
            class LoggerService {
                constructor(_config: ConfigService) {}
            }

            @InjectableProxy()
            class DatabaseService {
                constructor(_config: ConfigService, _logger: LoggerService) {}
            }

            @InjectableProxy()
            class CacheService {
                constructor(_config: ConfigService) {}
            }

            @InjectableProxy()
            class UserRepository {
                constructor(_db: DatabaseService, _cache: CacheService) {}
            }

            @InjectableProxy()
            class PostRepository {
                constructor(_db: DatabaseService, _cache: CacheService) {}
            }

            @InjectableProxy()
            class UserService {
                constructor(_repo: UserRepository, _logger: LoggerService) {}
            }

            @InjectableProxy()
            class PostService {
                constructor(_repo: PostRepository, _logger: LoggerService) {}
            }

            @InjectableProxy()
            class AuthService {
                constructor(_user: UserService, _logger: LoggerService) {}
            }

            @InjectableProxy()
            class ApiController {
                constructor(
                    _auth: AuthService,
                    _user: UserService,
                    _post: PostService,
                ) {}
            }

            Reflect.defineMetadata(
                'design:paramtypes',
                [ConfigService],
                LoggerService,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ConfigService, LoggerService],
                DatabaseService,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [ConfigService],
                CacheService,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [DatabaseService, CacheService],
                UserRepository,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [DatabaseService, CacheService],
                PostRepository,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [UserRepository, LoggerService],
                UserService,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [PostRepository, LoggerService],
                PostService,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [UserService, LoggerService],
                AuthService,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [AuthService, UserService, PostService],
                ApiController,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    ApiController,
                    AuthService,
                    UserService,
                    PostService,
                    UserRepository,
                    PostRepository,
                    DatabaseService,
                    CacheService,
                    LoggerService,
                    ConfigService,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows mixed linear and tree patterns', async () => {
            // Linear: A→B→C
            @InjectableProxy()
            class LinearC {
                value = 'C';
            }

            @InjectableProxy()
            class LinearB {
                constructor(_c: LinearC) {}
            }

            @InjectableProxy()
            class LinearA {
                constructor(_b: LinearB) {}
            }

            // Tree: D→E,F
            @InjectableProxy()
            class TreeF {
                value = 'F';
            }

            @InjectableProxy()
            class TreeE {
                value = 'E';
            }

            @InjectableProxy()
            class TreeD {
                constructor(_e: TreeE, _f: TreeF) {}
            }

            Reflect.defineMetadata('design:paramtypes', [LinearC], LinearB);
            Reflect.defineMetadata('design:paramtypes', [LinearB], LinearA);
            Reflect.defineMetadata('design:paramtypes', [TreeE, TreeF], TreeD);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    LinearA,
                    LinearB,
                    LinearC,
                    TreeD,
                    TreeE,
                    TreeF,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows DAG with multiple roots', async () => {
            @InjectableProxy()
            class Leaf {
                value = 'leaf';
            }

            @InjectableProxy()
            class Mid {
                constructor(_leaf: Leaf) {}
            }

            @InjectableProxy()
            class Root1 {
                constructor(_mid: Mid) {}
            }

            @InjectableProxy()
            class Root2 {
                constructor(_mid: Mid) {}
            }

            @InjectableProxy()
            class Root3 {
                constructor(_leaf: Leaf) {}
            }

            Reflect.defineMetadata('design:paramtypes', [Leaf], Mid);
            Reflect.defineMetadata('design:paramtypes', [Mid], Root1);
            Reflect.defineMetadata('design:paramtypes', [Mid], Root2);
            Reflect.defineMetadata('design:paramtypes', [Leaf], Root3);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Root1, Root2, Root3, Mid, Leaf),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows providers with no dependencies mixed with dependencies', async () => {
            @InjectableProxy()
            class Standalone1 {
                value = 'standalone1';
            }

            @InjectableProxy()
            class Standalone2 {
                value = 'standalone2';
            }

            @InjectableProxy()
            class WithDep {
                constructor(_s1: Standalone1) {}
            }

            Reflect.defineMetadata('design:paramtypes', [Standalone1], WithDep);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Standalone1, Standalone2, WithDep),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('resolves mixed patterns quickly', async () => {
            @InjectableProxy()
            class MixBase {
                value = 'base';
            }

            @InjectableProxy()
            class Mix1 {
                constructor(_b: MixBase) {}
            }

            @InjectableProxy()
            class Mix2 {
                constructor(_b: MixBase) {}
            }

            @InjectableProxy()
            class Mix3 {
                constructor(_m1: Mix1, _m2: Mix2) {}
            }

            @InjectableProxy()
            class MixStandalone {
                value = 'standalone';
            }

            Reflect.defineMetadata('design:paramtypes', [MixBase], Mix1);
            Reflect.defineMetadata('design:paramtypes', [MixBase], Mix2);
            Reflect.defineMetadata('design:paramtypes', [Mix1, Mix2], Mix3);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Mix3, Mix1, Mix2, MixBase, MixStandalone),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(100);
            });
        });

        it('allows complex dependency convergence', async () => {
            @InjectableProxy()
            class Base {
                value = 'base';
            }

            @InjectableProxy()
            class Layer1A {
                constructor(_b: Base) {}
            }

            @InjectableProxy()
            class Layer1B {
                constructor(_b: Base) {}
            }

            @InjectableProxy()
            class Layer2A {
                constructor(_l1a: Layer1A, _l1b: Layer1B) {}
            }

            @InjectableProxy()
            class Layer2B {
                constructor(_l1a: Layer1A, _l1b: Layer1B) {}
            }

            @InjectableProxy()
            class Top {
                constructor(_l2a: Layer2A, _l2b: Layer2B, _base: Base) {}
            }

            Reflect.defineMetadata('design:paramtypes', [Base], Layer1A);
            Reflect.defineMetadata('design:paramtypes', [Base], Layer1B);
            Reflect.defineMetadata(
                'design:paramtypes',
                [Layer1A, Layer1B],
                Layer2A,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [Layer1A, Layer1B],
                Layer2B,
            );
            Reflect.defineMetadata(
                'design:paramtypes',
                [Layer2A, Layer2B, Base],
                Top,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    Top,
                    Layer2A,
                    Layer2B,
                    Layer1A,
                    Layer1B,
                    Base,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('allows DAG with interfaces and implementations', async () => {
            interface IBase {
                getValue(): string;
            }

            @InjectableProxy()
            class BaseImpl implements IBase {
                getValue() {
                    return 'base';
                }
            }

            @InjectableProxy()
            class ServiceA {
                constructor(_base: BaseImpl) {}
            }

            @InjectableProxy()
            class ServiceB {
                constructor(_base: BaseImpl) {}
            }

            @InjectableProxy()
            class AggregateService {
                constructor(_a: ServiceA, _b: ServiceB) {}
            }

            Reflect.defineMetadata('design:paramtypes', [BaseImpl], ServiceA);
            Reflect.defineMetadata('design:paramtypes', [BaseImpl], ServiceB);
            Reflect.defineMetadata(
                'design:paramtypes',
                [ServiceA, ServiceB],
                AggregateService,
            );

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    AggregateService,
                    ServiceA,
                    ServiceB,
                    BaseImpl,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });
    });
});
