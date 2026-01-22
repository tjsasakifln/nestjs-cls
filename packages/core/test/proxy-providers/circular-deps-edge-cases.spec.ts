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

describe('Circular Dependency Edge Cases', () => {
    let app: INestApplication;

    afterEach(async () => {
        if (app) {
            await app.close();
        }
    });

    describe('1. Empty and Minimal Graphs (10 tests)', () => {
        it('handles no proxy providers registered', async () => {
            app = await createAndInitTestingApp([]);

            await cls.run(async () => {
                // Should not throw, just resolve nothing
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles single provider with no dependencies', async () => {
            @InjectableProxy()
            class SingleProvider {
                value = 'single';
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(SingleProvider),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles two independent providers', async () => {
            @InjectableProxy()
            class ProviderA {
                value = 'A';
            }

            @InjectableProxy()
            class ProviderB {
                value = 'B';
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProviderA, ProviderB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with undefined paramtypes metadata', async () => {
            @InjectableProxy()
            class NoMetadata {
                value = 'no-metadata';
            }

            // Don't set any paramtypes metadata
            Reflect.defineMetadata('design:paramtypes', undefined, NoMetadata);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(NoMetadata),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with null paramtypes metadata', async () => {
            @InjectableProxy()
            class NullMetadata {
                value = 'null-metadata';
            }

            Reflect.defineMetadata('design:paramtypes', null, NullMetadata);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(NullMetadata),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with empty array paramtypes', async () => {
            @InjectableProxy()
            class EmptyParams {
                value = 'empty';
            }

            Reflect.defineMetadata('design:paramtypes', [], EmptyParams);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(EmptyParams),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with optional dependencies', async () => {
            @InjectableProxy()
            class OptionalDep {
                value = 'optional';
            }

            @InjectableProxy()
            class WithOptionalDep {
                constructor(_dep?: OptionalDep) {}
            }

            Reflect.defineMetadata('design:paramtypes', [OptionalDep], WithOptionalDep);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(WithOptionalDep, OptionalDep),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with no constructor', async () => {
            @InjectableProxy()
            class NoConstructor {
                value = 'no-constructor';
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(NoConstructor),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with multiple dependencies', async () => {
            @InjectableProxy()
            class FirstDep {
                value = 'first';
            }

            @InjectableProxy()
            class SecondDep {
                value = 'second';
            }

            @InjectableProxy()
            class ThirdDep {
                value = 'third';
            }

            @InjectableProxy()
            class WithMultipleDeps {
                constructor(
                    _dep1: FirstDep,
                    _dep2: SecondDep,
                    _dep3: ThirdDep,
                ) {}
            }

            Reflect.defineMetadata('design:paramtypes', [FirstDep, SecondDep, ThirdDep], WithMultipleDeps);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(WithMultipleDeps, FirstDep, SecondDep, ThirdDep),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider registered multiple times', async () => {
            @InjectableProxy()
            class DuplicateProvider {
                value = 'duplicate';
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(DuplicateProvider, DuplicateProvider),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });
    });

    describe('2. Provider with Various Dependencies (10 tests)', () => {
        it('handles provider with private field dependencies', async () => {
            @InjectableProxy()
            class PrivateDep {
                private value = 'private';
            }

            @InjectableProxy()
            class UsesPrivate {
                constructor(private dep: PrivateDep) {}
            }

            Reflect.defineMetadata('design:paramtypes', [PrivateDep], UsesPrivate);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(UsesPrivate, PrivateDep),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with readonly dependencies', async () => {
            @InjectableProxy()
            class ReadonlyDep {
                readonly value = 'readonly';
            }

            @InjectableProxy()
            class UsesReadonly {
                constructor(readonly dep: ReadonlyDep) {}
            }

            Reflect.defineMetadata('design:paramtypes', [ReadonlyDep], UsesReadonly);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(UsesReadonly, ReadonlyDep),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with protected dependencies', async () => {
            @InjectableProxy()
            class ProtectedDep {
                protected value = 'protected';
            }

            @InjectableProxy()
            class UsesProtected {
                constructor(protected dep: ProtectedDep) {}
            }

            Reflect.defineMetadata('design:paramtypes', [ProtectedDep], UsesProtected);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(UsesProtected, ProtectedDep),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with static properties', async () => {
            @InjectableProxy()
            class StaticProps {
                static readonly CONFIG = 'static';
                value = 'instance';
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(StaticProps),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with getters and setters', async () => {
            @InjectableProxy()
            class WithGettersSetters {
                private _value = 'initial';
                get value() {
                    return this._value;
                }
                set value(v: string) {
                    this._value = v;
                }
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(WithGettersSetters),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with abstract class dependency', async () => {
            abstract class AbstractBase {
                abstract getValue(): string;
            }

            @InjectableProxy()
            class ConcreteImpl extends AbstractBase {
                getValue() {
                    return 'concrete';
                }
            }

            @InjectableProxy()
            class UsesAbstract {
                constructor(_dep: ConcreteImpl) {}
            }

            Reflect.defineMetadata('design:paramtypes', [ConcreteImpl], UsesAbstract);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(UsesAbstract, ConcreteImpl),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with interface implementation', async () => {
            interface IService {
                getValue(): string;
            }

            @InjectableProxy()
            class ServiceImpl implements IService {
                getValue() {
                    return 'service';
                }
            }

            @InjectableProxy()
            class UsesInterface {
                constructor(_service: ServiceImpl) {}
            }

            Reflect.defineMetadata('design:paramtypes', [ServiceImpl], UsesInterface);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(UsesInterface, ServiceImpl),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with generic types', async () => {
            @InjectableProxy()
            class GenericService<T> {
                private item: T | undefined;
                setItem(item: T) {
                    this.item = item;
                }
                getItem(): T | undefined {
                    return this.item;
                }
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(GenericService),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with decorators on properties', async () => {
            function CustomDecorator() {
                return (target: any, propertyKey: string) => {};
            }

            @InjectableProxy()
            class WithPropertyDecorators {
                @CustomDecorator()
                decoratedProperty = 'value';
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(WithPropertyDecorators),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider extending another class', async () => {
            @InjectableProxy()
            class BaseProvider {
                baseValue = 'base';
            }

            @InjectableProxy()
            class ExtendedProvider extends BaseProvider {
                extendedValue = 'extended';
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(BaseProvider, ExtendedProvider),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });
    });

    describe('3. Special Character and Naming Edge Cases (10 tests)', () => {
        it('handles provider with special characters in name', async () => {
            @InjectableProxy()
            class SpecialName$123 {
                value = 'special';
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(SpecialName$123),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with unicode characters in name', async () => {
            @InjectableProxy()
            class Provider你好 {
                value = 'unicode';
            }

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Provider你好),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('detects cycle with special character names and provides readable error', async () => {
            @InjectableProxy()
            class Special$B {
                value = 'B';
            }

            @InjectableProxy()
            class Special$A {
                value = 'A';
            }

            // Create cycle: A depends on B, B depends on A
            Reflect.defineMetadata('design:paramtypes', [Special$B], Special$A);
            Reflect.defineMetadata('design:paramtypes', [Special$A], Special$B);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Special$A, Special$B),
            ]);

            await cls.run(async () => {
                const error = await cls.proxy.resolve().catch((e) => e);
                expect(error).toBeInstanceOf(ProxyProviderCircularDependencyException);
                expect(error.message).toMatch(/Special\$[AB]/);
            });
        });

        it('handles very long provider name (200+ characters)', async () => {
            @InjectableProxy()
            class VeryLongProviderNameThatExceedsNormalLengthAndGoesOnAndOnAndOnForeverAndEverToTestEdgeCasesInTheSystemWhereNamesAreExtremelyLongAndMayNeedToBeHandledSpeciallyForDisplayPurposesOrErrorMessagesOrOtherSituationsWhereTheNameIsUsed {
                value = 'long';
            }

            const LongName = VeryLongProviderNameThatExceedsNormalLengthAndGoesOnAndOnAndOnForeverAndEverToTestEdgeCasesInTheSystemWhereNamesAreExtremelyLongAndMayNeedToBeHandledSpeciallyForDisplayPurposesOrErrorMessagesOrOtherSituationsWhereTheNameIsUsed;

            app = await createAndInitTestingApp([
                ClsModule.forFeature(LongName),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles providers with same name but different instances', async () => {
            @InjectableProxy()
            class DuplicateName {
                value = 'first';
            }

            @InjectableProxy()
            class DuplicateName2 {
                value = 'second';
            }

            Object.defineProperty(DuplicateName2, 'name', { value: 'DuplicateName' });

            app = await createAndInitTestingApp([
                ClsModule.forFeature(DuplicateName, DuplicateName2),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with empty string name', async () => {
            @InjectableProxy()
            class EmptyName {
                value = 'empty';
            }

            Object.defineProperty(EmptyName, 'name', { value: '' });

            app = await createAndInitTestingApp([
                ClsModule.forFeature(EmptyName),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with whitespace-only name', async () => {
            @InjectableProxy()
            class WhitespaceName {
                value = 'whitespace';
            }

            Object.defineProperty(WhitespaceName, 'name', { value: '   ' });

            app = await createAndInitTestingApp([
                ClsModule.forFeature(WhitespaceName),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with numeric-like name', async () => {
            @InjectableProxy()
            class Provider123 {
                value = 'numeric';
            }

            Object.defineProperty(Provider123, 'name', { value: '123' });

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Provider123),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('handles provider with name containing newlines', async () => {
            @InjectableProxy()
            class NewlineName {
                value = 'newline';
            }

            Object.defineProperty(NewlineName, 'name', { value: 'Provider\nWith\nNewlines' });

            app = await createAndInitTestingApp([
                ClsModule.forFeature(NewlineName),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).resolves.not.toThrow();
            });
        });

        it('detects very long cycle path (10+ nodes) with clear error message', async () => {
            const classes: any[] = [];
            for (let i = 0; i < 12; i++) {
                @InjectableProxy()
                class LongCycle {
                    constructor() {}
                }
                Object.defineProperty(LongCycle, 'name', { value: `CycleNode${i}` });
                classes.push(LongCycle);
            }

            // Create cycle: Node0→Node1→...→Node11→Node0
            for (let i = 0; i < 11; i++) {
                Reflect.defineMetadata('design:paramtypes', [classes[i + 1]], classes[i]);
            }
            Reflect.defineMetadata('design:paramtypes', [classes[0]], classes[11]);

            app = await createAndInitTestingApp([ClsModule.forFeature(...classes)]);

            await cls.run(async () => {
                const error = await cls.proxy.resolve().catch((e) => e);
                expect(error).toBeInstanceOf(ProxyProviderCircularDependencyException);
                // Error message should contain cycle path
                expect(error.message).toMatch(/CycleNode\d+/);
            });
        });
    });
});
