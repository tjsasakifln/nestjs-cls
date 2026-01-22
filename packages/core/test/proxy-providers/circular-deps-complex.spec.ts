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

describe('Complex Circular Dependency Cycles', () => {
    let app: INestApplication;

    afterEach(async () => {
        if (app) {
            await app.close();
        }
    });

    describe('1. Nested Cycles (25 tests)', () => {
        it('detects cycle within larger graph (A→B→C→B)', async () => {
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

            // A depends on B, but B→C→B forms a cycle
            Reflect.defineMetadata('design:paramtypes', [ProxyB], ProxyA);
            Reflect.defineMetadata('design:paramtypes', [ProxyC], ProxyB);
            Reflect.defineMetadata('design:paramtypes', [ProxyB], ProxyC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ProxyA, ProxyB, ProxyC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects nested cycle starting from outer node', async () => {
            @InjectableProxy()
            class OuterNode {
                constructor() {}
            }

            @InjectableProxy()
            class InnerC {
                constructor() {}
            }

            @InjectableProxy()
            class InnerB {
                constructor() {}
            }

            @InjectableProxy()
            class InnerA {
                constructor() {}
            }

            // OuterNode→InnerA→InnerB→InnerC→InnerB (cycle in inner)
            Reflect.defineMetadata('design:paramtypes', [InnerA], OuterNode);
            Reflect.defineMetadata('design:paramtypes', [InnerB], InnerA);
            Reflect.defineMetadata('design:paramtypes', [InnerC], InnerB);
            Reflect.defineMetadata('design:paramtypes', [InnerB], InnerC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(OuterNode, InnerA, InnerB, InnerC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle when multiple paths lead to cyclic subgraph', async () => {
            @InjectableProxy()
            class Root {
                constructor() {}
            }

            @InjectableProxy()
            class PathA {
                constructor() {}
            }

            @InjectableProxy()
            class PathB {
                constructor() {}
            }

            @InjectableProxy()
            class CycleX {
                constructor() {}
            }

            @InjectableProxy()
            class CycleY {
                constructor() {}
            }

            // Root→PathA→CycleX and Root→PathB→CycleY, but CycleX↔CycleY
            Reflect.defineMetadata('design:paramtypes', [PathA, PathB], Root);
            Reflect.defineMetadata('design:paramtypes', [CycleX], PathA);
            Reflect.defineMetadata('design:paramtypes', [CycleY], PathB);
            Reflect.defineMetadata('design:paramtypes', [CycleY], CycleX);
            Reflect.defineMetadata('design:paramtypes', [CycleX], CycleY);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Root, PathA, PathB, CycleX, CycleY),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects first cycle when multiple exist in nested structure', async () => {
            @InjectableProxy()
            class MainA {
                constructor() {}
            }

            @InjectableProxy()
            class MainB {
                constructor() {}
            }

            @InjectableProxy()
            class SubX {
                constructor() {}
            }

            @InjectableProxy()
            class SubY {
                constructor() {}
            }

            // MainA↔MainB and SubX↔SubY (two separate cycles)
            Reflect.defineMetadata('design:paramtypes', [MainB], MainA);
            Reflect.defineMetadata('design:paramtypes', [MainA], MainB);
            Reflect.defineMetadata('design:paramtypes', [SubY], SubX);
            Reflect.defineMetadata('design:paramtypes', [SubX], SubY);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(MainA, MainB, SubX, SubY),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects nested cycle in 4-level hierarchy', async () => {
            @InjectableProxy()
            class L1 {
                constructor() {}
            }

            @InjectableProxy()
            class L2 {
                constructor() {}
            }

            @InjectableProxy()
            class L3A {
                constructor() {}
            }

            @InjectableProxy()
            class L3B {
                constructor() {}
            }

            // L1→L2→L3A→L3B→L3A (cycle at level 3)
            Reflect.defineMetadata('design:paramtypes', [L2], L1);
            Reflect.defineMetadata('design:paramtypes', [L3A], L2);
            Reflect.defineMetadata('design:paramtypes', [L3B], L3A);
            Reflect.defineMetadata('design:paramtypes', [L3A], L3B);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(L1, L2, L3A, L3B),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle in branch of tree structure', async () => {
            @InjectableProxy()
            class TreeRoot {
                constructor() {}
            }

            @InjectableProxy()
            class BranchLeft {
                constructor() {}
            }

            @InjectableProxy()
            class BranchRight {
                constructor() {}
            }

            @InjectableProxy()
            class LeafA {
                constructor() {}
            }

            @InjectableProxy()
            class LeafB {
                constructor() {}
            }

            // Root→BranchLeft→LeafA, Root→BranchRight→LeafB→LeafA→LeafB
            Reflect.defineMetadata('design:paramtypes', [BranchLeft, BranchRight], TreeRoot);
            Reflect.defineMetadata('design:paramtypes', [LeafA], BranchLeft);
            Reflect.defineMetadata('design:paramtypes', [LeafB], BranchRight);
            Reflect.defineMetadata('design:paramtypes', [LeafA], LeafB);
            Reflect.defineMetadata('design:paramtypes', [LeafB], LeafA);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(TreeRoot, BranchLeft, BranchRight, LeafA, LeafB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle in complex graph with shared dependencies', async () => {
            @InjectableProxy()
            class Shared {
                value = 'shared';
            }

            @InjectableProxy()
            class NodeA {
                constructor() {}
            }

            @InjectableProxy()
            class NodeB {
                constructor() {}
            }

            @InjectableProxy()
            class NodeC {
                constructor() {}
            }

            // NodeA→Shared, NodeB→Shared, NodeB→NodeC→NodeB (cycle)
            Reflect.defineMetadata('design:paramtypes', [Shared], NodeA);
            Reflect.defineMetadata('design:paramtypes', [Shared, NodeC], NodeB);
            Reflect.defineMetadata('design:paramtypes', [NodeB], NodeC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(NodeA, NodeB, NodeC, Shared),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects nested cycle with non-cyclic nodes in path', async () => {
            @InjectableProxy()
            class Start {
                constructor() {}
            }

            @InjectableProxy()
            class Middle1 {
                constructor() {}
            }

            @InjectableProxy()
            class Middle2 {
                constructor() {}
            }

            @InjectableProxy()
            class CycleA {
                constructor() {}
            }

            @InjectableProxy()
            class CycleB {
                constructor() {}
            }

            // Start→Middle1→Middle2→CycleA→CycleB→CycleA
            Reflect.defineMetadata('design:paramtypes', [Middle1], Start);
            Reflect.defineMetadata('design:paramtypes', [Middle2], Middle1);
            Reflect.defineMetadata('design:paramtypes', [CycleA], Middle2);
            Reflect.defineMetadata('design:paramtypes', [CycleB], CycleA);
            Reflect.defineMetadata('design:paramtypes', [CycleA], CycleB);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Start, Middle1, Middle2, CycleA, CycleB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle when graph has multiple entry points', async () => {
            @InjectableProxy()
            class EntryA {
                constructor() {}
            }

            @InjectableProxy()
            class EntryB {
                constructor() {}
            }

            @InjectableProxy()
            class CycleX {
                constructor() {}
            }

            @InjectableProxy()
            class CycleY {
                constructor() {}
            }

            // EntryA→CycleX, EntryB→CycleY, CycleX↔CycleY
            Reflect.defineMetadata('design:paramtypes', [CycleX], EntryA);
            Reflect.defineMetadata('design:paramtypes', [CycleY], EntryB);
            Reflect.defineMetadata('design:paramtypes', [CycleY], CycleX);
            Reflect.defineMetadata('design:paramtypes', [CycleX], CycleY);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(EntryA, EntryB, CycleX, CycleY),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects nested A→B→C→D→B cycle', async () => {
            @InjectableProxy()
            class NestedD {
                constructor() {}
            }

            @InjectableProxy()
            class NestedC {
                constructor() {}
            }

            @InjectableProxy()
            class NestedB {
                constructor() {}
            }

            @InjectableProxy()
            class NestedA {
                constructor() {}
            }

            // A→B→C→D→B (4-node cycle)
            Reflect.defineMetadata('design:paramtypes', [NestedB], NestedA);
            Reflect.defineMetadata('design:paramtypes', [NestedC], NestedB);
            Reflect.defineMetadata('design:paramtypes', [NestedD], NestedC);
            Reflect.defineMetadata('design:paramtypes', [NestedB], NestedD);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(NestedA, NestedB, NestedC, NestedD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with multiple additional dependencies per node', async () => {
            @InjectableProxy()
            class Dep1 {
                value = '1';
            }

            @InjectableProxy()
            class Dep2 {
                value = '2';
            }

            @InjectableProxy()
            class Dep3 {
                value = '3';
            }

            @InjectableProxy()
            class CycleP {
                constructor() {}
            }

            @InjectableProxy()
            class CycleQ {
                constructor() {}
            }

            // CycleP→Dep1,Dep2,CycleQ and CycleQ→Dep3,CycleP
            Reflect.defineMetadata('design:paramtypes', [Dep1, Dep2, CycleQ], CycleP);
            Reflect.defineMetadata('design:paramtypes', [Dep3, CycleP], CycleQ);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(CycleP, CycleQ, Dep1, Dep2, Dep3),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle in diamond graph with circular tail', async () => {
            @InjectableProxy()
            class DiamondTop {
                constructor() {}
            }

            @InjectableProxy()
            class DiamondLeft {
                constructor() {}
            }

            @InjectableProxy()
            class DiamondRight {
                constructor() {}
            }

            @InjectableProxy()
            class DiamondBottom {
                constructor() {}
            }

            @InjectableProxy()
            class TailCycle {
                constructor() {}
            }

            // Diamond: Top→Left,Right; Left,Right→Bottom; Bottom→TailCycle→Bottom
            Reflect.defineMetadata('design:paramtypes', [DiamondLeft, DiamondRight], DiamondTop);
            Reflect.defineMetadata('design:paramtypes', [DiamondBottom], DiamondLeft);
            Reflect.defineMetadata('design:paramtypes', [DiamondBottom], DiamondRight);
            Reflect.defineMetadata('design:paramtypes', [TailCycle], DiamondBottom);
            Reflect.defineMetadata('design:paramtypes', [DiamondBottom], TailCycle);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(DiamondTop, DiamondLeft, DiamondRight, DiamondBottom, TailCycle),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle starting from middle of dependency chain', async () => {
            @InjectableProxy()
            class ChainStart {
                constructor() {}
            }

            @InjectableProxy()
            class ChainMid {
                constructor() {}
            }

            @InjectableProxy()
            class CycleNode1 {
                constructor() {}
            }

            @InjectableProxy()
            class CycleNode2 {
                constructor() {}
            }

            // ChainStart→ChainMid→CycleNode1→CycleNode2→CycleNode1
            Reflect.defineMetadata('design:paramtypes', [ChainMid], ChainStart);
            Reflect.defineMetadata('design:paramtypes', [CycleNode1], ChainMid);
            Reflect.defineMetadata('design:paramtypes', [CycleNode2], CycleNode1);
            Reflect.defineMetadata('design:paramtypes', [CycleNode1], CycleNode2);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ChainStart, ChainMid, CycleNode1, CycleNode2),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle when node is part of multiple cycles', async () => {
            @InjectableProxy()
            class Hub {
                constructor() {}
            }

            @InjectableProxy()
            class SpokeA {
                constructor() {}
            }

            @InjectableProxy()
            class SpokeB {
                constructor() {}
            }

            // Hub↔SpokeA and Hub↔SpokeB (Hub is part of two cycles)
            Reflect.defineMetadata('design:paramtypes', [SpokeA, SpokeB], Hub);
            Reflect.defineMetadata('design:paramtypes', [Hub], SpokeA);
            Reflect.defineMetadata('design:paramtypes', [Hub], SpokeB);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Hub, SpokeA, SpokeB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle in graph with isolated components', async () => {
            @InjectableProxy()
            class IsolatedA {
                value = 'A';
            }

            @InjectableProxy()
            class IsolatedB {
                value = 'B';
            }

            @InjectableProxy()
            class ConnectedX {
                constructor() {}
            }

            @InjectableProxy()
            class ConnectedY {
                constructor() {}
            }

            // IsolatedA, IsolatedB (no deps), ConnectedX↔ConnectedY (cycle)
            Reflect.defineMetadata('design:paramtypes', [ConnectedY], ConnectedX);
            Reflect.defineMetadata('design:paramtypes', [ConnectedX], ConnectedY);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(IsolatedA, IsolatedB, ConnectedX, ConnectedY),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects nested cycle quickly (<50ms)', async () => {
            @InjectableProxy()
            class FastOuter {
                constructor() {}
            }

            @InjectableProxy()
            class FastInnerA {
                constructor() {}
            }

            @InjectableProxy()
            class FastInnerB {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [FastInnerA], FastOuter);
            Reflect.defineMetadata('design:paramtypes', [FastInnerB], FastInnerA);
            Reflect.defineMetadata('design:paramtypes', [FastInnerA], FastInnerB);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(FastOuter, FastInnerA, FastInnerB),
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

        it('detects cycle with realistic service names', async () => {
            @InjectableProxy()
            class OrderService {
                constructor() {}
            }

            @InjectableProxy()
            class PaymentService {
                constructor() {}
            }

            @InjectableProxy()
            class NotificationService {
                constructor() {}
            }

            // OrderService→PaymentService→NotificationService→PaymentService
            Reflect.defineMetadata('design:paramtypes', [PaymentService], OrderService);
            Reflect.defineMetadata('design:paramtypes', [NotificationService], PaymentService);
            Reflect.defineMetadata('design:paramtypes', [PaymentService], NotificationService);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(OrderService, PaymentService, NotificationService),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle in large subgraph (10 nodes, cycle at end)', async () => {
            @InjectableProxy()
            class N1 {
                constructor() {}
            }

            @InjectableProxy()
            class N2 {
                constructor() {}
            }

            @InjectableProxy()
            class N3 {
                constructor() {}
            }

            @InjectableProxy()
            class N4 {
                constructor() {}
            }

            @InjectableProxy()
            class N5 {
                constructor() {}
            }

            @InjectableProxy()
            class N6 {
                constructor() {}
            }

            @InjectableProxy()
            class N7 {
                constructor() {}
            }

            @InjectableProxy()
            class N8 {
                constructor() {}
            }

            @InjectableProxy()
            class N9 {
                constructor() {}
            }

            @InjectableProxy()
            class N10 {
                constructor() {}
            }

            // N1→N2→...→N9→N10→N9 (cycle between N9 and N10)
            Reflect.defineMetadata('design:paramtypes', [N2], N1);
            Reflect.defineMetadata('design:paramtypes', [N3], N2);
            Reflect.defineMetadata('design:paramtypes', [N4], N3);
            Reflect.defineMetadata('design:paramtypes', [N5], N4);
            Reflect.defineMetadata('design:paramtypes', [N6], N5);
            Reflect.defineMetadata('design:paramtypes', [N7], N6);
            Reflect.defineMetadata('design:paramtypes', [N8], N7);
            Reflect.defineMetadata('design:paramtypes', [N9], N8);
            Reflect.defineMetadata('design:paramtypes', [N10], N9);
            Reflect.defineMetadata('design:paramtypes', [N9], N10);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(N1, N2, N3, N4, N5, N6, N7, N8, N9, N10),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with mixed module registrations', async () => {
            @InjectableProxy()
            class ModuleAService {
                constructor() {}
            }

            @InjectableProxy()
            class ModuleBService {
                constructor() {}
            }

            @InjectableProxy()
            class ModuleCService {
                constructor() {}
            }

            // ModuleAService→ModuleBService→ModuleCService→ModuleBService
            Reflect.defineMetadata('design:paramtypes', [ModuleBService], ModuleAService);
            Reflect.defineMetadata('design:paramtypes', [ModuleCService], ModuleBService);
            Reflect.defineMetadata('design:paramtypes', [ModuleBService], ModuleCService);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ModuleAService),
                ClsModule.forFeature(ModuleBService),
                ClsModule.forFeature(ModuleCService),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle when all nodes have properties', async () => {
            @InjectableProxy()
            class PropsNodeA {
                public readonly id = 'A';
                public value = 1;
                constructor() {}
            }

            @InjectableProxy()
            class PropsNodeB {
                public readonly id = 'B';
                public value = 2;
                constructor() {}
            }

            @InjectableProxy()
            class PropsNodeC {
                public readonly id = 'C';
                public value = 3;
                constructor() {}
            }

            // PropsNodeA→PropsNodeB→PropsNodeC→PropsNodeB
            Reflect.defineMetadata('design:paramtypes', [PropsNodeB], PropsNodeA);
            Reflect.defineMetadata('design:paramtypes', [PropsNodeC], PropsNodeB);
            Reflect.defineMetadata('design:paramtypes', [PropsNodeB], PropsNodeC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(PropsNodeA, PropsNodeB, PropsNodeC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle when provider names have special characters', async () => {
            @InjectableProxy()
            class $SpecialNode1 {
                constructor() {}
            }

            @InjectableProxy()
            class _SpecialNode2 {
                constructor() {}
            }

            // $SpecialNode1↔_SpecialNode2
            Reflect.defineMetadata('design:paramtypes', [_SpecialNode2], $SpecialNode1);
            Reflect.defineMetadata('design:paramtypes', [$SpecialNode1], _SpecialNode2);

            app = await createAndInitTestingApp([
                ClsModule.forFeature($SpecialNode1, _SpecialNode2),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle in providers registered in reverse dependency order', async () => {
            @InjectableProxy()
            class ReverseC {
                constructor() {}
            }

            @InjectableProxy()
            class ReverseB {
                constructor() {}
            }

            @InjectableProxy()
            class ReverseA {
                constructor() {}
            }

            // A→B→C→B but register as C, B, A
            Reflect.defineMetadata('design:paramtypes', [ReverseB], ReverseA);
            Reflect.defineMetadata('design:paramtypes', [ReverseC], ReverseB);
            Reflect.defineMetadata('design:paramtypes', [ReverseB], ReverseC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ReverseC, ReverseB, ReverseA),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects nested cycle when dependencies are optional', async () => {
            @InjectableProxy()
            class OptionalOuter {
                constructor() {}
            }

            @InjectableProxy()
            class OptionalInner1 {
                constructor(_opt?: any) {}
            }

            @InjectableProxy()
            class OptionalInner2 {
                constructor(_opt?: any) {}
            }

            // OptionalOuter→OptionalInner1→OptionalInner2→OptionalInner1
            Reflect.defineMetadata('design:paramtypes', [OptionalInner1], OptionalOuter);
            Reflect.defineMetadata('design:paramtypes', [OptionalInner2], OptionalInner1);
            Reflect.defineMetadata('design:paramtypes', [OptionalInner1], OptionalInner2);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(OptionalOuter, OptionalInner1, OptionalInner2),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects nested cycle with multiple incoming edges', async () => {
            @InjectableProxy()
            class Root1 {
                value = 'root1';
            }

            @InjectableProxy()
            class Root2 {
                value = 'root2';
            }

            @InjectableProxy()
            class Node1 {
                constructor() {}
            }

            @InjectableProxy()
            class Node2 {
                constructor() {}
            }

            @InjectableProxy()
            class Node3 {
                constructor() {}
            }

            // Root1→Node1, Root2→Node1; Node1→Node2→Node3→Node1 (cycle)
            Reflect.defineMetadata('design:paramtypes', [Node1], Root1);
            Reflect.defineMetadata('design:paramtypes', [Node1], Root2);
            Reflect.defineMetadata('design:paramtypes', [Node2], Node1);
            Reflect.defineMetadata('design:paramtypes', [Node3], Node2);
            Reflect.defineMetadata('design:paramtypes', [Node1], Node3);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Root1, Root2, Node1, Node2, Node3),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects nested cycle with self-referencing node in larger graph', async () => {
            @InjectableProxy()
            class External1 {
                value = 'external';
            }

            @InjectableProxy()
            class External2 {
                value = 'external2';
            }

            @InjectableProxy()
            class SelfRef {
                constructor() {}
            }

            // External1→External2, SelfRef→SelfRef (self-cycle in larger graph)
            Reflect.defineMetadata('design:paramtypes', [External2], External1);
            Reflect.defineMetadata('design:paramtypes', [SelfRef], SelfRef);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(External1, External2, SelfRef),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });
    });

    describe('2. Multiple Independent Cycles (25 tests)', () => {
        it('detects first cycle when two independent cycles exist', async () => {
            @InjectableProxy()
            class CycleA1 {
                constructor() {}
            }

            @InjectableProxy()
            class CycleA2 {
                constructor() {}
            }

            @InjectableProxy()
            class CycleB1 {
                constructor() {}
            }

            @InjectableProxy()
            class CycleB2 {
                constructor() {}
            }

            // CycleA1↔CycleA2 and CycleB1↔CycleB2 (two independent cycles)
            Reflect.defineMetadata('design:paramtypes', [CycleA2], CycleA1);
            Reflect.defineMetadata('design:paramtypes', [CycleA1], CycleA2);
            Reflect.defineMetadata('design:paramtypes', [CycleB2], CycleB1);
            Reflect.defineMetadata('design:paramtypes', [CycleB1], CycleB2);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(CycleA1, CycleA2, CycleB1, CycleB2),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle when three independent cycles exist', async () => {
            @InjectableProxy()
            class X1 {
                constructor() {}
            }

            @InjectableProxy()
            class X2 {
                constructor() {}
            }

            @InjectableProxy()
            class Y1 {
                constructor() {}
            }

            @InjectableProxy()
            class Y2 {
                constructor() {}
            }

            @InjectableProxy()
            class Z1 {
                constructor() {}
            }

            @InjectableProxy()
            class Z2 {
                constructor() {}
            }

            // X1↔X2, Y1↔Y2, Z1↔Z2 (three independent cycles)
            Reflect.defineMetadata('design:paramtypes', [X2], X1);
            Reflect.defineMetadata('design:paramtypes', [X1], X2);
            Reflect.defineMetadata('design:paramtypes', [Y2], Y1);
            Reflect.defineMetadata('design:paramtypes', [Y1], Y2);
            Reflect.defineMetadata('design:paramtypes', [Z2], Z1);
            Reflect.defineMetadata('design:paramtypes', [Z1], Z2);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(X1, X2, Y1, Y2, Z1, Z2),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent 3-node cycles', async () => {
            @InjectableProxy()
            class Alpha1 {
                constructor() {}
            }

            @InjectableProxy()
            class Alpha2 {
                constructor() {}
            }

            @InjectableProxy()
            class Alpha3 {
                constructor() {}
            }

            @InjectableProxy()
            class Beta1 {
                constructor() {}
            }

            @InjectableProxy()
            class Beta2 {
                constructor() {}
            }

            @InjectableProxy()
            class Beta3 {
                constructor() {}
            }

            // Alpha1→Alpha2→Alpha3→Alpha1 and Beta1→Beta2→Beta3→Beta1
            Reflect.defineMetadata('design:paramtypes', [Alpha2], Alpha1);
            Reflect.defineMetadata('design:paramtypes', [Alpha3], Alpha2);
            Reflect.defineMetadata('design:paramtypes', [Alpha1], Alpha3);
            Reflect.defineMetadata('design:paramtypes', [Beta2], Beta1);
            Reflect.defineMetadata('design:paramtypes', [Beta3], Beta2);
            Reflect.defineMetadata('design:paramtypes', [Beta1], Beta3);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Alpha1, Alpha2, Alpha3, Beta1, Beta2, Beta3),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent cycles with shared non-cyclic dependency', async () => {
            @InjectableProxy()
            class SharedUtil {
                value = 'shared';
            }

            @InjectableProxy()
            class Cycle1A {
                constructor() {}
            }

            @InjectableProxy()
            class Cycle1B {
                constructor() {}
            }

            @InjectableProxy()
            class Cycle2A {
                constructor() {}
            }

            @InjectableProxy()
            class Cycle2B {
                constructor() {}
            }

            // Both cycles depend on SharedUtil, but cycles are independent
            Reflect.defineMetadata('design:paramtypes', [Cycle1B, SharedUtil], Cycle1A);
            Reflect.defineMetadata('design:paramtypes', [Cycle1A], Cycle1B);
            Reflect.defineMetadata('design:paramtypes', [Cycle2B, SharedUtil], Cycle2A);
            Reflect.defineMetadata('design:paramtypes', [Cycle2A], Cycle2B);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(SharedUtil, Cycle1A, Cycle1B, Cycle2A, Cycle2B),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent cycles in different sizes', async () => {
            @InjectableProxy()
            class Small1 {
                constructor() {}
            }

            @InjectableProxy()
            class Small2 {
                constructor() {}
            }

            @InjectableProxy()
            class Large1 {
                constructor() {}
            }

            @InjectableProxy()
            class Large2 {
                constructor() {}
            }

            @InjectableProxy()
            class Large3 {
                constructor() {}
            }

            @InjectableProxy()
            class Large4 {
                constructor() {}
            }

            // Small: Small1↔Small2 (2-node), Large: Large1→Large2→Large3→Large4→Large1 (4-node)
            Reflect.defineMetadata('design:paramtypes', [Small2], Small1);
            Reflect.defineMetadata('design:paramtypes', [Small1], Small2);
            Reflect.defineMetadata('design:paramtypes', [Large2], Large1);
            Reflect.defineMetadata('design:paramtypes', [Large3], Large2);
            Reflect.defineMetadata('design:paramtypes', [Large4], Large3);
            Reflect.defineMetadata('design:paramtypes', [Large1], Large4);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Small1, Small2, Large1, Large2, Large3, Large4),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent cycles in separate modules', async () => {
            @InjectableProxy()
            class ModuleACycle1 {
                constructor() {}
            }

            @InjectableProxy()
            class ModuleACycle2 {
                constructor() {}
            }

            @InjectableProxy()
            class ModuleBCycle1 {
                constructor() {}
            }

            @InjectableProxy()
            class ModuleBCycle2 {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [ModuleACycle2], ModuleACycle1);
            Reflect.defineMetadata('design:paramtypes', [ModuleACycle1], ModuleACycle2);
            Reflect.defineMetadata('design:paramtypes', [ModuleBCycle2], ModuleBCycle1);
            Reflect.defineMetadata('design:paramtypes', [ModuleBCycle1], ModuleBCycle2);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ModuleACycle1, ModuleACycle2),
                ClsModule.forFeature(ModuleBCycle1, ModuleBCycle2),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent self-reference cycles', async () => {
            @InjectableProxy()
            class SelfA {
                constructor() {}
            }

            @InjectableProxy()
            class SelfB {
                constructor() {}
            }

            @InjectableProxy()
            class SelfC {
                constructor() {}
            }

            // Three self-references
            Reflect.defineMetadata('design:paramtypes', [SelfA], SelfA);
            Reflect.defineMetadata('design:paramtypes', [SelfB], SelfB);
            Reflect.defineMetadata('design:paramtypes', [SelfC], SelfC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(SelfA, SelfB, SelfC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects mix of self-reference and multi-node cycle', async () => {
            @InjectableProxy()
            class SelfNode {
                constructor() {}
            }

            @InjectableProxy()
            class MultiA {
                constructor() {}
            }

            @InjectableProxy()
            class MultiB {
                constructor() {}
            }

            // SelfNode→SelfNode and MultiA↔MultiB
            Reflect.defineMetadata('design:paramtypes', [SelfNode], SelfNode);
            Reflect.defineMetadata('design:paramtypes', [MultiB], MultiA);
            Reflect.defineMetadata('design:paramtypes', [MultiA], MultiB);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(SelfNode, MultiA, MultiB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('reports first cycle when cycles have different depths', async () => {
            @InjectableProxy()
            class Shallow1 {
                constructor() {}
            }

            @InjectableProxy()
            class Shallow2 {
                constructor() {}
            }

            @InjectableProxy()
            class Deep1 {
                constructor() {}
            }

            @InjectableProxy()
            class Deep2 {
                constructor() {}
            }

            @InjectableProxy()
            class Deep3 {
                constructor() {}
            }

            @InjectableProxy()
            class Deep4 {
                constructor() {}
            }

            @InjectableProxy()
            class Deep5 {
                constructor() {}
            }

            // Shallow cycle (2) and deep cycle (5)
            Reflect.defineMetadata('design:paramtypes', [Shallow2], Shallow1);
            Reflect.defineMetadata('design:paramtypes', [Shallow1], Shallow2);
            Reflect.defineMetadata('design:paramtypes', [Deep2], Deep1);
            Reflect.defineMetadata('design:paramtypes', [Deep3], Deep2);
            Reflect.defineMetadata('design:paramtypes', [Deep4], Deep3);
            Reflect.defineMetadata('design:paramtypes', [Deep5], Deep4);
            Reflect.defineMetadata('design:paramtypes', [Deep1], Deep5);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Shallow1, Shallow2, Deep1, Deep2, Deep3, Deep4, Deep5),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent cycles with realistic names (Auth and Payment)', async () => {
            @InjectableProxy()
            class UserAuthService {
                constructor() {}
            }

            @InjectableProxy()
            class TokenAuthService {
                constructor() {}
            }

            @InjectableProxy()
            class PaymentProcessor {
                constructor() {}
            }

            @InjectableProxy()
            class BillingService {
                constructor() {}
            }

            // UserAuth↔TokenAuth and PaymentProcessor↔BillingService
            Reflect.defineMetadata('design:paramtypes', [TokenAuthService], UserAuthService);
            Reflect.defineMetadata('design:paramtypes', [UserAuthService], TokenAuthService);
            Reflect.defineMetadata('design:paramtypes', [BillingService], PaymentProcessor);
            Reflect.defineMetadata('design:paramtypes', [PaymentProcessor], BillingService);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(UserAuthService, TokenAuthService, PaymentProcessor, BillingService),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects 4 independent 2-node cycles', async () => {
            @InjectableProxy()
            class P1A {
                constructor() {}
            }

            @InjectableProxy()
            class P1B {
                constructor() {}
            }

            @InjectableProxy()
            class P2A {
                constructor() {}
            }

            @InjectableProxy()
            class P2B {
                constructor() {}
            }

            @InjectableProxy()
            class P3A {
                constructor() {}
            }

            @InjectableProxy()
            class P3B {
                constructor() {}
            }

            @InjectableProxy()
            class P4A {
                constructor() {}
            }

            @InjectableProxy()
            class P4B {
                constructor() {}
            }

            // Four pairs: P1A↔P1B, P2A↔P2B, P3A↔P3B, P4A↔P4B
            Reflect.defineMetadata('design:paramtypes', [P1B], P1A);
            Reflect.defineMetadata('design:paramtypes', [P1A], P1B);
            Reflect.defineMetadata('design:paramtypes', [P2B], P2A);
            Reflect.defineMetadata('design:paramtypes', [P2A], P2B);
            Reflect.defineMetadata('design:paramtypes', [P3B], P3A);
            Reflect.defineMetadata('design:paramtypes', [P3A], P3B);
            Reflect.defineMetadata('design:paramtypes', [P4B], P4A);
            Reflect.defineMetadata('design:paramtypes', [P4A], P4B);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(P1A, P1B, P2A, P2B, P3A, P3B, P4A, P4B),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent cycles with non-cyclic providers between them', async () => {
            @InjectableProxy()
            class CycleGroupA1 {
                constructor() {}
            }

            @InjectableProxy()
            class CycleGroupA2 {
                constructor() {}
            }

            @InjectableProxy()
            class NonCyclicMiddle1 {
                value = 'safe1';
            }

            @InjectableProxy()
            class NonCyclicMiddle2 {
                value = 'safe2';
            }

            @InjectableProxy()
            class CycleGroupB1 {
                constructor() {}
            }

            @InjectableProxy()
            class CycleGroupB2 {
                constructor() {}
            }

            // GroupA↔, NonCyclic in middle, GroupB↔
            Reflect.defineMetadata('design:paramtypes', [CycleGroupA2], CycleGroupA1);
            Reflect.defineMetadata('design:paramtypes', [CycleGroupA1], CycleGroupA2);
            Reflect.defineMetadata('design:paramtypes', [CycleGroupB2], CycleGroupB1);
            Reflect.defineMetadata('design:paramtypes', [CycleGroupB1], CycleGroupB2);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    CycleGroupA1,
                    CycleGroupA2,
                    NonCyclicMiddle1,
                    NonCyclicMiddle2,
                    CycleGroupB1,
                    CycleGroupB2,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent cycles registered in random order', async () => {
            @InjectableProxy()
            class Rand1A {
                constructor() {}
            }

            @InjectableProxy()
            class Rand1B {
                constructor() {}
            }

            @InjectableProxy()
            class Rand2A {
                constructor() {}
            }

            @InjectableProxy()
            class Rand2B {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [Rand1B], Rand1A);
            Reflect.defineMetadata('design:paramtypes', [Rand1A], Rand1B);
            Reflect.defineMetadata('design:paramtypes', [Rand2B], Rand2A);
            Reflect.defineMetadata('design:paramtypes', [Rand2A], Rand2B);

            // Random order: 2B, 1A, 2A, 1B
            app = await createAndInitTestingApp([
                ClsModule.forFeature(Rand2B, Rand1A, Rand2A, Rand1B),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent cycles with all having multiple dependencies', async () => {
            @InjectableProxy()
            class Util1 {
                value = 'util1';
            }

            @InjectableProxy()
            class Util2 {
                value = 'util2';
            }

            @InjectableProxy()
            class Group1A {
                constructor() {}
            }

            @InjectableProxy()
            class Group1B {
                constructor() {}
            }

            @InjectableProxy()
            class Group2A {
                constructor() {}
            }

            @InjectableProxy()
            class Group2B {
                constructor() {}
            }

            // Group1A→Util1,Group1B and Group1B→Util2,Group1A (cycle)
            // Group2A→Util1,Group2B and Group2B→Util2,Group2A (cycle)
            Reflect.defineMetadata('design:paramtypes', [Util1, Group1B], Group1A);
            Reflect.defineMetadata('design:paramtypes', [Util2, Group1A], Group1B);
            Reflect.defineMetadata('design:paramtypes', [Util1, Group2B], Group2A);
            Reflect.defineMetadata('design:paramtypes', [Util2, Group2A], Group2B);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Util1, Util2, Group1A, Group1B, Group2A, Group2B),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects 5 independent cycles quickly', async () => {
            @InjectableProxy()
            class Fast1A {
                constructor() {}
            }

            @InjectableProxy()
            class Fast1B {
                constructor() {}
            }

            @InjectableProxy()
            class Fast2A {
                constructor() {}
            }

            @InjectableProxy()
            class Fast2B {
                constructor() {}
            }

            @InjectableProxy()
            class Fast3A {
                constructor() {}
            }

            @InjectableProxy()
            class Fast3B {
                constructor() {}
            }

            @InjectableProxy()
            class Fast4A {
                constructor() {}
            }

            @InjectableProxy()
            class Fast4B {
                constructor() {}
            }

            @InjectableProxy()
            class Fast5A {
                constructor() {}
            }

            @InjectableProxy()
            class Fast5B {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [Fast1B], Fast1A);
            Reflect.defineMetadata('design:paramtypes', [Fast1A], Fast1B);
            Reflect.defineMetadata('design:paramtypes', [Fast2B], Fast2A);
            Reflect.defineMetadata('design:paramtypes', [Fast2A], Fast2B);
            Reflect.defineMetadata('design:paramtypes', [Fast3B], Fast3A);
            Reflect.defineMetadata('design:paramtypes', [Fast3A], Fast3B);
            Reflect.defineMetadata('design:paramtypes', [Fast4B], Fast4A);
            Reflect.defineMetadata('design:paramtypes', [Fast4A], Fast4B);
            Reflect.defineMetadata('design:paramtypes', [Fast5B], Fast5A);
            Reflect.defineMetadata('design:paramtypes', [Fast5A], Fast5B);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    Fast1A,
                    Fast1B,
                    Fast2A,
                    Fast2B,
                    Fast3A,
                    Fast3B,
                    Fast4A,
                    Fast4B,
                    Fast5A,
                    Fast5B,
                ),
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

        it('detects independent cycles in complex graph topology', async () => {
            @InjectableProxy()
            class TopologyRoot {
                value = 'root';
            }

            @InjectableProxy()
            class Branch1 {
                constructor() {}
            }

            @InjectableProxy()
            class Branch2 {
                constructor() {}
            }

            @InjectableProxy()
            class Leaf1A {
                constructor() {}
            }

            @InjectableProxy()
            class Leaf1B {
                constructor() {}
            }

            @InjectableProxy()
            class Leaf2A {
                constructor() {}
            }

            @InjectableProxy()
            class Leaf2B {
                constructor() {}
            }

            // Root→Branch1→Leaf1A↔Leaf1B and Root→Branch2→Leaf2A↔Leaf2B
            Reflect.defineMetadata('design:paramtypes', [Branch1, Branch2], TopologyRoot);
            Reflect.defineMetadata('design:paramtypes', [Leaf1A], Branch1);
            Reflect.defineMetadata('design:paramtypes', [Leaf2A], Branch2);
            Reflect.defineMetadata('design:paramtypes', [Leaf1B], Leaf1A);
            Reflect.defineMetadata('design:paramtypes', [Leaf1A], Leaf1B);
            Reflect.defineMetadata('design:paramtypes', [Leaf2B], Leaf2A);
            Reflect.defineMetadata('design:paramtypes', [Leaf2A], Leaf2B);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    TopologyRoot,
                    Branch1,
                    Branch2,
                    Leaf1A,
                    Leaf1B,
                    Leaf2A,
                    Leaf2B,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent cycles where one is very long', async () => {
            @InjectableProxy()
            class ShortA {
                constructor() {}
            }

            @InjectableProxy()
            class ShortB {
                constructor() {}
            }

            @InjectableProxy()
            class Long1 {
                constructor() {}
            }

            @InjectableProxy()
            class Long2 {
                constructor() {}
            }

            @InjectableProxy()
            class Long3 {
                constructor() {}
            }

            @InjectableProxy()
            class Long4 {
                constructor() {}
            }

            @InjectableProxy()
            class Long5 {
                constructor() {}
            }

            @InjectableProxy()
            class Long6 {
                constructor() {}
            }

            @InjectableProxy()
            class Long7 {
                constructor() {}
            }

            @InjectableProxy()
            class Long8 {
                constructor() {}
            }

            // Short: ShortA↔ShortB, Long: Long1→...→Long8→Long1
            Reflect.defineMetadata('design:paramtypes', [ShortB], ShortA);
            Reflect.defineMetadata('design:paramtypes', [ShortA], ShortB);
            Reflect.defineMetadata('design:paramtypes', [Long2], Long1);
            Reflect.defineMetadata('design:paramtypes', [Long3], Long2);
            Reflect.defineMetadata('design:paramtypes', [Long4], Long3);
            Reflect.defineMetadata('design:paramtypes', [Long5], Long4);
            Reflect.defineMetadata('design:paramtypes', [Long6], Long5);
            Reflect.defineMetadata('design:paramtypes', [Long7], Long6);
            Reflect.defineMetadata('design:paramtypes', [Long8], Long7);
            Reflect.defineMetadata('design:paramtypes', [Long1], Long8);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    ShortA,
                    ShortB,
                    Long1,
                    Long2,
                    Long3,
                    Long4,
                    Long5,
                    Long6,
                    Long7,
                    Long8,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent cycles with properties and methods', async () => {
            @InjectableProxy()
            class ServiceA1 {
                public name = 'A1';
                constructor() {}
                getName() {
                    return this.name;
                }
            }

            @InjectableProxy()
            class ServiceA2 {
                public name = 'A2';
                constructor() {}
                getName() {
                    return this.name;
                }
            }

            @InjectableProxy()
            class ServiceB1 {
                public name = 'B1';
                constructor() {}
                getName() {
                    return this.name;
                }
            }

            @InjectableProxy()
            class ServiceB2 {
                public name = 'B2';
                constructor() {}
                getName() {
                    return this.name;
                }
            }

            Reflect.defineMetadata('design:paramtypes', [ServiceA2], ServiceA1);
            Reflect.defineMetadata('design:paramtypes', [ServiceA1], ServiceA2);
            Reflect.defineMetadata('design:paramtypes', [ServiceB2], ServiceB1);
            Reflect.defineMetadata('design:paramtypes', [ServiceB1], ServiceB2);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ServiceA1, ServiceA2, ServiceB1, ServiceB2),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent cycles with async operations', async () => {
            @InjectableProxy()
            class AsyncGroup1A {
                constructor() {}
                async fetchData() {
                    return 'data';
                }
            }

            @InjectableProxy()
            class AsyncGroup1B {
                constructor() {}
                async processData() {
                    return 'processed';
                }
            }

            @InjectableProxy()
            class AsyncGroup2A {
                constructor() {}
                async fetchData() {
                    return 'data';
                }
            }

            @InjectableProxy()
            class AsyncGroup2B {
                constructor() {}
                async processData() {
                    return 'processed';
                }
            }

            Reflect.defineMetadata('design:paramtypes', [AsyncGroup1B], AsyncGroup1A);
            Reflect.defineMetadata('design:paramtypes', [AsyncGroup1A], AsyncGroup1B);
            Reflect.defineMetadata('design:paramtypes', [AsyncGroup2B], AsyncGroup2A);
            Reflect.defineMetadata('design:paramtypes', [AsyncGroup2A], AsyncGroup2B);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(AsyncGroup1A, AsyncGroup1B, AsyncGroup2A, AsyncGroup2B),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent cycles with optional dependencies', async () => {
            @InjectableProxy()
            class OptGroup1A {
                constructor(_opt?: any) {}
            }

            @InjectableProxy()
            class OptGroup1B {
                constructor(_opt?: any) {}
            }

            @InjectableProxy()
            class OptGroup2A {
                constructor(_opt?: any) {}
            }

            @InjectableProxy()
            class OptGroup2B {
                constructor(_opt?: any) {}
            }

            Reflect.defineMetadata('design:paramtypes', [OptGroup1B], OptGroup1A);
            Reflect.defineMetadata('design:paramtypes', [OptGroup1A], OptGroup1B);
            Reflect.defineMetadata('design:paramtypes', [OptGroup2B], OptGroup2A);
            Reflect.defineMetadata('design:paramtypes', [OptGroup2A], OptGroup2B);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(OptGroup1A, OptGroup1B, OptGroup2A, OptGroup2B),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycles when providers have numeric suffixes', async () => {
            @InjectableProxy()
            class Provider1A {
                constructor() {}
            }

            @InjectableProxy()
            class Provider1B {
                constructor() {}
            }

            @InjectableProxy()
            class Provider2A {
                constructor() {}
            }

            @InjectableProxy()
            class Provider2B {
                constructor() {}
            }

            @InjectableProxy()
            class Provider3A {
                constructor() {}
            }

            @InjectableProxy()
            class Provider3B {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [Provider1B], Provider1A);
            Reflect.defineMetadata('design:paramtypes', [Provider1A], Provider1B);
            Reflect.defineMetadata('design:paramtypes', [Provider2B], Provider2A);
            Reflect.defineMetadata('design:paramtypes', [Provider2A], Provider2B);
            Reflect.defineMetadata('design:paramtypes', [Provider3B], Provider3A);
            Reflect.defineMetadata('design:paramtypes', [Provider3A], Provider3B);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    Provider1A,
                    Provider1B,
                    Provider2A,
                    Provider2B,
                    Provider3A,
                    Provider3B,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent cycles in large graph (20 nodes, 3 cycles)', async () => {
            // Create 20 nodes with 3 independent cycles
            @InjectableProxy()
            class Safe1 {
                value = '1';
            }

            @InjectableProxy()
            class Safe2 {
                value = '2';
            }

            @InjectableProxy()
            class Safe3 {
                value = '3';
            }

            @InjectableProxy()
            class Safe4 {
                value = '4';
            }

            @InjectableProxy()
            class Safe5 {
                value = '5';
            }

            @InjectableProxy()
            class Cycle1A {
                constructor() {}
            }

            @InjectableProxy()
            class Cycle1B {
                constructor() {}
            }

            @InjectableProxy()
            class Cycle1C {
                constructor() {}
            }

            @InjectableProxy()
            class Safe6 {
                value = '6';
            }

            @InjectableProxy()
            class Safe7 {
                value = '7';
            }

            @InjectableProxy()
            class Cycle2A {
                constructor() {}
            }

            @InjectableProxy()
            class Cycle2B {
                constructor() {}
            }

            @InjectableProxy()
            class Safe8 {
                value = '8';
            }

            @InjectableProxy()
            class Safe9 {
                value = '9';
            }

            @InjectableProxy()
            class Safe10 {
                value = '10';
            }

            @InjectableProxy()
            class Cycle3A {
                constructor() {}
            }

            @InjectableProxy()
            class Cycle3B {
                constructor() {}
            }

            @InjectableProxy()
            class Cycle3C {
                constructor() {}
            }

            @InjectableProxy()
            class Cycle3D {
                constructor() {}
            }

            @InjectableProxy()
            class Safe11 {
                value = '11';
            }

            // Cycle1: Cycle1A→Cycle1B→Cycle1C→Cycle1A
            Reflect.defineMetadata('design:paramtypes', [Cycle1B], Cycle1A);
            Reflect.defineMetadata('design:paramtypes', [Cycle1C], Cycle1B);
            Reflect.defineMetadata('design:paramtypes', [Cycle1A], Cycle1C);

            // Cycle2: Cycle2A↔Cycle2B
            Reflect.defineMetadata('design:paramtypes', [Cycle2B], Cycle2A);
            Reflect.defineMetadata('design:paramtypes', [Cycle2A], Cycle2B);

            // Cycle3: Cycle3A→Cycle3B→Cycle3C→Cycle3D→Cycle3A
            Reflect.defineMetadata('design:paramtypes', [Cycle3B], Cycle3A);
            Reflect.defineMetadata('design:paramtypes', [Cycle3C], Cycle3B);
            Reflect.defineMetadata('design:paramtypes', [Cycle3D], Cycle3C);
            Reflect.defineMetadata('design:paramtypes', [Cycle3A], Cycle3D);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    Safe1,
                    Safe2,
                    Safe3,
                    Safe4,
                    Safe5,
                    Cycle1A,
                    Cycle1B,
                    Cycle1C,
                    Safe6,
                    Safe7,
                    Cycle2A,
                    Cycle2B,
                    Safe8,
                    Safe9,
                    Safe10,
                    Cycle3A,
                    Cycle3B,
                    Cycle3C,
                    Cycle3D,
                    Safe11,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent cycles with abstract base classes', async () => {
            @InjectableProxy()
            abstract class AbstractServiceA {
                abstract execute(): string;
            }

            @InjectableProxy()
            class ConcreteServiceA1 extends AbstractServiceA {
                constructor() {
                    super();
                }
                execute() {
                    return 'A1';
                }
            }

            @InjectableProxy()
            class ConcreteServiceA2 extends AbstractServiceA {
                constructor() {
                    super();
                }
                execute() {
                    return 'A2';
                }
            }

            @InjectableProxy()
            abstract class AbstractServiceB {
                abstract execute(): string;
            }

            @InjectableProxy()
            class ConcreteServiceB1 extends AbstractServiceB {
                constructor() {
                    super();
                }
                execute() {
                    return 'B1';
                }
            }

            @InjectableProxy()
            class ConcreteServiceB2 extends AbstractServiceB {
                constructor() {
                    super();
                }
                execute() {
                    return 'B2';
                }
            }

            Reflect.defineMetadata('design:paramtypes', [ConcreteServiceA2], ConcreteServiceA1);
            Reflect.defineMetadata('design:paramtypes', [ConcreteServiceA1], ConcreteServiceA2);
            Reflect.defineMetadata('design:paramtypes', [ConcreteServiceB2], ConcreteServiceB1);
            Reflect.defineMetadata('design:paramtypes', [ConcreteServiceB1], ConcreteServiceB2);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    ConcreteServiceA1,
                    ConcreteServiceA2,
                    ConcreteServiceB1,
                    ConcreteServiceB2,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects independent cycles across different feature modules', async () => {
            @InjectableProxy()
            class FeatureACycle1 {
                constructor() {}
            }

            @InjectableProxy()
            class FeatureACycle2 {
                constructor() {}
            }

            @InjectableProxy()
            class FeatureBCycle1 {
                constructor() {}
            }

            @InjectableProxy()
            class FeatureBCycle2 {
                constructor() {}
            }

            @InjectableProxy()
            class FeatureCCycle1 {
                constructor() {}
            }

            @InjectableProxy()
            class FeatureCCycle2 {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [FeatureACycle2], FeatureACycle1);
            Reflect.defineMetadata('design:paramtypes', [FeatureACycle1], FeatureACycle2);
            Reflect.defineMetadata('design:paramtypes', [FeatureBCycle2], FeatureBCycle1);
            Reflect.defineMetadata('design:paramtypes', [FeatureBCycle1], FeatureBCycle2);
            Reflect.defineMetadata('design:paramtypes', [FeatureCCycle2], FeatureCCycle1);
            Reflect.defineMetadata('design:paramtypes', [FeatureCCycle1], FeatureCCycle2);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(FeatureACycle1, FeatureACycle2),
                ClsModule.forFeature(FeatureBCycle1, FeatureBCycle2),
                ClsModule.forFeature(FeatureCCycle1, FeatureCCycle2),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects multiple cycles with interleaved non-cyclic nodes', async () => {
            @InjectableProxy()
            class Safe1 {
                value = 'safe1';
            }

            @InjectableProxy()
            class Safe2 {
                value = 'safe2';
            }

            @InjectableProxy()
            class Cycle1A {
                constructor() {}
            }

            @InjectableProxy()
            class Cycle1B {
                constructor() {}
            }

            @InjectableProxy()
            class Cycle2A {
                constructor() {}
            }

            @InjectableProxy()
            class Cycle2B {
                constructor() {}
            }

            // Safe1→Safe2, Cycle1: A↔B, Cycle2: A↔B (all interleaved)
            Reflect.defineMetadata('design:paramtypes', [Safe2], Safe1);
            Reflect.defineMetadata('design:paramtypes', [Cycle1B], Cycle1A);
            Reflect.defineMetadata('design:paramtypes', [Cycle1A], Cycle1B);
            Reflect.defineMetadata('design:paramtypes', [Cycle2B], Cycle2A);
            Reflect.defineMetadata('design:paramtypes', [Cycle2A], Cycle2B);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Safe1, Cycle1A, Safe2, Cycle1B, Cycle2A, Cycle2B),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });
    });

    describe('3. Long Cycle Chains (25 tests)', () => {
        it('detects 5-node cycle (A→B→C→D→E→A)', async () => {
            @InjectableProxy()
            class Chain5E {
                constructor() {}
            }

            @InjectableProxy()
            class Chain5D {
                constructor() {}
            }

            @InjectableProxy()
            class Chain5C {
                constructor() {}
            }

            @InjectableProxy()
            class Chain5B {
                constructor() {}
            }

            @InjectableProxy()
            class Chain5A {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [Chain5B], Chain5A);
            Reflect.defineMetadata('design:paramtypes', [Chain5C], Chain5B);
            Reflect.defineMetadata('design:paramtypes', [Chain5D], Chain5C);
            Reflect.defineMetadata('design:paramtypes', [Chain5E], Chain5D);
            Reflect.defineMetadata('design:paramtypes', [Chain5A], Chain5E);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Chain5A, Chain5B, Chain5C, Chain5D, Chain5E),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects 6-node cycle', async () => {
            @InjectableProxy()
            class Chain6F {
                constructor() {}
            }

            @InjectableProxy()
            class Chain6E {
                constructor() {}
            }

            @InjectableProxy()
            class Chain6D {
                constructor() {}
            }

            @InjectableProxy()
            class Chain6C {
                constructor() {}
            }

            @InjectableProxy()
            class Chain6B {
                constructor() {}
            }

            @InjectableProxy()
            class Chain6A {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [Chain6B], Chain6A);
            Reflect.defineMetadata('design:paramtypes', [Chain6C], Chain6B);
            Reflect.defineMetadata('design:paramtypes', [Chain6D], Chain6C);
            Reflect.defineMetadata('design:paramtypes', [Chain6E], Chain6D);
            Reflect.defineMetadata('design:paramtypes', [Chain6F], Chain6E);
            Reflect.defineMetadata('design:paramtypes', [Chain6A], Chain6F);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Chain6A, Chain6B, Chain6C, Chain6D, Chain6E, Chain6F),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects 7-node cycle', async () => {
            @InjectableProxy()
            class C7G {
                constructor() {}
            }

            @InjectableProxy()
            class C7F {
                constructor() {}
            }

            @InjectableProxy()
            class C7E {
                constructor() {}
            }

            @InjectableProxy()
            class C7D {
                constructor() {}
            }

            @InjectableProxy()
            class C7C {
                constructor() {}
            }

            @InjectableProxy()
            class C7B {
                constructor() {}
            }

            @InjectableProxy()
            class C7A {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [C7B], C7A);
            Reflect.defineMetadata('design:paramtypes', [C7C], C7B);
            Reflect.defineMetadata('design:paramtypes', [C7D], C7C);
            Reflect.defineMetadata('design:paramtypes', [C7E], C7D);
            Reflect.defineMetadata('design:paramtypes', [C7F], C7E);
            Reflect.defineMetadata('design:paramtypes', [C7G], C7F);
            Reflect.defineMetadata('design:paramtypes', [C7A], C7G);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(C7A, C7B, C7C, C7D, C7E, C7F, C7G),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects 8-node cycle', async () => {
            @InjectableProxy()
            class C8H {
                constructor() {}
            }

            @InjectableProxy()
            class C8G {
                constructor() {}
            }

            @InjectableProxy()
            class C8F {
                constructor() {}
            }

            @InjectableProxy()
            class C8E {
                constructor() {}
            }

            @InjectableProxy()
            class C8D {
                constructor() {}
            }

            @InjectableProxy()
            class C8C {
                constructor() {}
            }

            @InjectableProxy()
            class C8B {
                constructor() {}
            }

            @InjectableProxy()
            class C8A {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [C8B], C8A);
            Reflect.defineMetadata('design:paramtypes', [C8C], C8B);
            Reflect.defineMetadata('design:paramtypes', [C8D], C8C);
            Reflect.defineMetadata('design:paramtypes', [C8E], C8D);
            Reflect.defineMetadata('design:paramtypes', [C8F], C8E);
            Reflect.defineMetadata('design:paramtypes', [C8G], C8F);
            Reflect.defineMetadata('design:paramtypes', [C8H], C8G);
            Reflect.defineMetadata('design:paramtypes', [C8A], C8H);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(C8A, C8B, C8C, C8D, C8E, C8F, C8G, C8H),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects 10-node cycle', async () => {
            @InjectableProxy()
            class C10J {
                constructor() {}
            }

            @InjectableProxy()
            class C10I {
                constructor() {}
            }

            @InjectableProxy()
            class C10H {
                constructor() {}
            }

            @InjectableProxy()
            class C10G {
                constructor() {}
            }

            @InjectableProxy()
            class C10F {
                constructor() {}
            }

            @InjectableProxy()
            class C10E {
                constructor() {}
            }

            @InjectableProxy()
            class C10D {
                constructor() {}
            }

            @InjectableProxy()
            class C10C {
                constructor() {}
            }

            @InjectableProxy()
            class C10B {
                constructor() {}
            }

            @InjectableProxy()
            class C10A {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [C10B], C10A);
            Reflect.defineMetadata('design:paramtypes', [C10C], C10B);
            Reflect.defineMetadata('design:paramtypes', [C10D], C10C);
            Reflect.defineMetadata('design:paramtypes', [C10E], C10D);
            Reflect.defineMetadata('design:paramtypes', [C10F], C10E);
            Reflect.defineMetadata('design:paramtypes', [C10G], C10F);
            Reflect.defineMetadata('design:paramtypes', [C10H], C10G);
            Reflect.defineMetadata('design:paramtypes', [C10I], C10H);
            Reflect.defineMetadata('design:paramtypes', [C10J], C10I);
            Reflect.defineMetadata('design:paramtypes', [C10A], C10J);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    C10A,
                    C10B,
                    C10C,
                    C10D,
                    C10E,
                    C10F,
                    C10G,
                    C10H,
                    C10I,
                    C10J,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects 12-node cycle', async () => {
            @InjectableProxy()
            class C12L {
                constructor() {}
            }

            @InjectableProxy()
            class C12K {
                constructor() {}
            }

            @InjectableProxy()
            class C12J {
                constructor() {}
            }

            @InjectableProxy()
            class C12I {
                constructor() {}
            }

            @InjectableProxy()
            class C12H {
                constructor() {}
            }

            @InjectableProxy()
            class C12G {
                constructor() {}
            }

            @InjectableProxy()
            class C12F {
                constructor() {}
            }

            @InjectableProxy()
            class C12E {
                constructor() {}
            }

            @InjectableProxy()
            class C12D {
                constructor() {}
            }

            @InjectableProxy()
            class C12C {
                constructor() {}
            }

            @InjectableProxy()
            class C12B {
                constructor() {}
            }

            @InjectableProxy()
            class C12A {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [C12B], C12A);
            Reflect.defineMetadata('design:paramtypes', [C12C], C12B);
            Reflect.defineMetadata('design:paramtypes', [C12D], C12C);
            Reflect.defineMetadata('design:paramtypes', [C12E], C12D);
            Reflect.defineMetadata('design:paramtypes', [C12F], C12E);
            Reflect.defineMetadata('design:paramtypes', [C12G], C12F);
            Reflect.defineMetadata('design:paramtypes', [C12H], C12G);
            Reflect.defineMetadata('design:paramtypes', [C12I], C12H);
            Reflect.defineMetadata('design:paramtypes', [C12J], C12I);
            Reflect.defineMetadata('design:paramtypes', [C12K], C12J);
            Reflect.defineMetadata('design:paramtypes', [C12L], C12K);
            Reflect.defineMetadata('design:paramtypes', [C12A], C12L);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    C12A,
                    C12B,
                    C12C,
                    C12D,
                    C12E,
                    C12F,
                    C12G,
                    C12H,
                    C12I,
                    C12J,
                    C12K,
                    C12L,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects 15-node cycle', async () => {
            @InjectableProxy()
            class C15O {
                constructor() {}
            }

            @InjectableProxy()
            class C15N {
                constructor() {}
            }

            @InjectableProxy()
            class C15M {
                constructor() {}
            }

            @InjectableProxy()
            class C15L {
                constructor() {}
            }

            @InjectableProxy()
            class C15K {
                constructor() {}
            }

            @InjectableProxy()
            class C15J {
                constructor() {}
            }

            @InjectableProxy()
            class C15I {
                constructor() {}
            }

            @InjectableProxy()
            class C15H {
                constructor() {}
            }

            @InjectableProxy()
            class C15G {
                constructor() {}
            }

            @InjectableProxy()
            class C15F {
                constructor() {}
            }

            @InjectableProxy()
            class C15E {
                constructor() {}
            }

            @InjectableProxy()
            class C15D {
                constructor() {}
            }

            @InjectableProxy()
            class C15C {
                constructor() {}
            }

            @InjectableProxy()
            class C15B {
                constructor() {}
            }

            @InjectableProxy()
            class C15A {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [C15B], C15A);
            Reflect.defineMetadata('design:paramtypes', [C15C], C15B);
            Reflect.defineMetadata('design:paramtypes', [C15D], C15C);
            Reflect.defineMetadata('design:paramtypes', [C15E], C15D);
            Reflect.defineMetadata('design:paramtypes', [C15F], C15E);
            Reflect.defineMetadata('design:paramtypes', [C15G], C15F);
            Reflect.defineMetadata('design:paramtypes', [C15H], C15G);
            Reflect.defineMetadata('design:paramtypes', [C15I], C15H);
            Reflect.defineMetadata('design:paramtypes', [C15J], C15I);
            Reflect.defineMetadata('design:paramtypes', [C15K], C15J);
            Reflect.defineMetadata('design:paramtypes', [C15L], C15K);
            Reflect.defineMetadata('design:paramtypes', [C15M], C15L);
            Reflect.defineMetadata('design:paramtypes', [C15N], C15M);
            Reflect.defineMetadata('design:paramtypes', [C15O], C15N);
            Reflect.defineMetadata('design:paramtypes', [C15A], C15O);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    C15A,
                    C15B,
                    C15C,
                    C15D,
                    C15E,
                    C15F,
                    C15G,
                    C15H,
                    C15I,
                    C15J,
                    C15K,
                    C15L,
                    C15M,
                    C15N,
                    C15O,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects 20-node cycle', async () => {
            @InjectableProxy()
            class C20T {
                constructor() {}
            }

            @InjectableProxy()
            class C20S {
                constructor() {}
            }

            @InjectableProxy()
            class C20R {
                constructor() {}
            }

            @InjectableProxy()
            class C20Q {
                constructor() {}
            }

            @InjectableProxy()
            class C20P {
                constructor() {}
            }

            @InjectableProxy()
            class C20O {
                constructor() {}
            }

            @InjectableProxy()
            class C20N {
                constructor() {}
            }

            @InjectableProxy()
            class C20M {
                constructor() {}
            }

            @InjectableProxy()
            class C20L {
                constructor() {}
            }

            @InjectableProxy()
            class C20K {
                constructor() {}
            }

            @InjectableProxy()
            class C20J {
                constructor() {}
            }

            @InjectableProxy()
            class C20I {
                constructor() {}
            }

            @InjectableProxy()
            class C20H {
                constructor() {}
            }

            @InjectableProxy()
            class C20G {
                constructor() {}
            }

            @InjectableProxy()
            class C20F {
                constructor() {}
            }

            @InjectableProxy()
            class C20E {
                constructor() {}
            }

            @InjectableProxy()
            class C20D {
                constructor() {}
            }

            @InjectableProxy()
            class C20C {
                constructor() {}
            }

            @InjectableProxy()
            class C20B {
                constructor() {}
            }

            @InjectableProxy()
            class C20A {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [C20B], C20A);
            Reflect.defineMetadata('design:paramtypes', [C20C], C20B);
            Reflect.defineMetadata('design:paramtypes', [C20D], C20C);
            Reflect.defineMetadata('design:paramtypes', [C20E], C20D);
            Reflect.defineMetadata('design:paramtypes', [C20F], C20E);
            Reflect.defineMetadata('design:paramtypes', [C20G], C20F);
            Reflect.defineMetadata('design:paramtypes', [C20H], C20G);
            Reflect.defineMetadata('design:paramtypes', [C20I], C20H);
            Reflect.defineMetadata('design:paramtypes', [C20J], C20I);
            Reflect.defineMetadata('design:paramtypes', [C20K], C20J);
            Reflect.defineMetadata('design:paramtypes', [C20L], C20K);
            Reflect.defineMetadata('design:paramtypes', [C20M], C20L);
            Reflect.defineMetadata('design:paramtypes', [C20N], C20M);
            Reflect.defineMetadata('design:paramtypes', [C20O], C20N);
            Reflect.defineMetadata('design:paramtypes', [C20P], C20O);
            Reflect.defineMetadata('design:paramtypes', [C20Q], C20P);
            Reflect.defineMetadata('design:paramtypes', [C20R], C20Q);
            Reflect.defineMetadata('design:paramtypes', [C20S], C20R);
            Reflect.defineMetadata('design:paramtypes', [C20T], C20S);
            Reflect.defineMetadata('design:paramtypes', [C20A], C20T);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    C20A,
                    C20B,
                    C20C,
                    C20D,
                    C20E,
                    C20F,
                    C20G,
                    C20H,
                    C20I,
                    C20J,
                    C20K,
                    C20L,
                    C20M,
                    C20N,
                    C20O,
                    C20P,
                    C20Q,
                    C20R,
                    C20S,
                    C20T,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects 5-node cycle quickly (<10ms)', async () => {
            @InjectableProxy()
            class Fast5E {
                constructor() {}
            }

            @InjectableProxy()
            class Fast5D {
                constructor() {}
            }

            @InjectableProxy()
            class Fast5C {
                constructor() {}
            }

            @InjectableProxy()
            class Fast5B {
                constructor() {}
            }

            @InjectableProxy()
            class Fast5A {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [Fast5B], Fast5A);
            Reflect.defineMetadata('design:paramtypes', [Fast5C], Fast5B);
            Reflect.defineMetadata('design:paramtypes', [Fast5D], Fast5C);
            Reflect.defineMetadata('design:paramtypes', [Fast5E], Fast5D);
            Reflect.defineMetadata('design:paramtypes', [Fast5A], Fast5E);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Fast5A, Fast5B, Fast5C, Fast5D, Fast5E),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(10);
            });
        });

        it('detects 10-node cycle quickly (<10ms)', async () => {
            @InjectableProxy()
            class Fast10J {
                constructor() {}
            }

            @InjectableProxy()
            class Fast10I {
                constructor() {}
            }

            @InjectableProxy()
            class Fast10H {
                constructor() {}
            }

            @InjectableProxy()
            class Fast10G {
                constructor() {}
            }

            @InjectableProxy()
            class Fast10F {
                constructor() {}
            }

            @InjectableProxy()
            class Fast10E {
                constructor() {}
            }

            @InjectableProxy()
            class Fast10D {
                constructor() {}
            }

            @InjectableProxy()
            class Fast10C {
                constructor() {}
            }

            @InjectableProxy()
            class Fast10B {
                constructor() {}
            }

            @InjectableProxy()
            class Fast10A {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [Fast10B], Fast10A);
            Reflect.defineMetadata('design:paramtypes', [Fast10C], Fast10B);
            Reflect.defineMetadata('design:paramtypes', [Fast10D], Fast10C);
            Reflect.defineMetadata('design:paramtypes', [Fast10E], Fast10D);
            Reflect.defineMetadata('design:paramtypes', [Fast10F], Fast10E);
            Reflect.defineMetadata('design:paramtypes', [Fast10G], Fast10F);
            Reflect.defineMetadata('design:paramtypes', [Fast10H], Fast10G);
            Reflect.defineMetadata('design:paramtypes', [Fast10I], Fast10H);
            Reflect.defineMetadata('design:paramtypes', [Fast10J], Fast10I);
            Reflect.defineMetadata('design:paramtypes', [Fast10A], Fast10J);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    Fast10A,
                    Fast10B,
                    Fast10C,
                    Fast10D,
                    Fast10E,
                    Fast10F,
                    Fast10G,
                    Fast10H,
                    Fast10I,
                    Fast10J,
                ),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(10);
            });
        });

        it('detects 15-node cycle quickly (<10ms)', async () => {
            @InjectableProxy()
            class Perf15O {
                constructor() {}
            }

            @InjectableProxy()
            class Perf15N {
                constructor() {}
            }

            @InjectableProxy()
            class Perf15M {
                constructor() {}
            }

            @InjectableProxy()
            class Perf15L {
                constructor() {}
            }

            @InjectableProxy()
            class Perf15K {
                constructor() {}
            }

            @InjectableProxy()
            class Perf15J {
                constructor() {}
            }

            @InjectableProxy()
            class Perf15I {
                constructor() {}
            }

            @InjectableProxy()
            class Perf15H {
                constructor() {}
            }

            @InjectableProxy()
            class Perf15G {
                constructor() {}
            }

            @InjectableProxy()
            class Perf15F {
                constructor() {}
            }

            @InjectableProxy()
            class Perf15E {
                constructor() {}
            }

            @InjectableProxy()
            class Perf15D {
                constructor() {}
            }

            @InjectableProxy()
            class Perf15C {
                constructor() {}
            }

            @InjectableProxy()
            class Perf15B {
                constructor() {}
            }

            @InjectableProxy()
            class Perf15A {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [Perf15B], Perf15A);
            Reflect.defineMetadata('design:paramtypes', [Perf15C], Perf15B);
            Reflect.defineMetadata('design:paramtypes', [Perf15D], Perf15C);
            Reflect.defineMetadata('design:paramtypes', [Perf15E], Perf15D);
            Reflect.defineMetadata('design:paramtypes', [Perf15F], Perf15E);
            Reflect.defineMetadata('design:paramtypes', [Perf15G], Perf15F);
            Reflect.defineMetadata('design:paramtypes', [Perf15H], Perf15G);
            Reflect.defineMetadata('design:paramtypes', [Perf15I], Perf15H);
            Reflect.defineMetadata('design:paramtypes', [Perf15J], Perf15I);
            Reflect.defineMetadata('design:paramtypes', [Perf15K], Perf15J);
            Reflect.defineMetadata('design:paramtypes', [Perf15L], Perf15K);
            Reflect.defineMetadata('design:paramtypes', [Perf15M], Perf15L);
            Reflect.defineMetadata('design:paramtypes', [Perf15N], Perf15M);
            Reflect.defineMetadata('design:paramtypes', [Perf15O], Perf15N);
            Reflect.defineMetadata('design:paramtypes', [Perf15A], Perf15O);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    Perf15A,
                    Perf15B,
                    Perf15C,
                    Perf15D,
                    Perf15E,
                    Perf15F,
                    Perf15G,
                    Perf15H,
                    Perf15I,
                    Perf15J,
                    Perf15K,
                    Perf15L,
                    Perf15M,
                    Perf15N,
                    Perf15O,
                ),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(10);
            });
        });

        it('detects 20-node cycle quickly (<10ms)', async () => {
            @InjectableProxy()
            class Perf20T {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20S {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20R {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20Q {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20P {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20O {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20N {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20M {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20L {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20K {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20J {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20I {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20H {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20G {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20F {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20E {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20D {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20C {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20B {
                constructor() {}
            }

            @InjectableProxy()
            class Perf20A {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [Perf20B], Perf20A);
            Reflect.defineMetadata('design:paramtypes', [Perf20C], Perf20B);
            Reflect.defineMetadata('design:paramtypes', [Perf20D], Perf20C);
            Reflect.defineMetadata('design:paramtypes', [Perf20E], Perf20D);
            Reflect.defineMetadata('design:paramtypes', [Perf20F], Perf20E);
            Reflect.defineMetadata('design:paramtypes', [Perf20G], Perf20F);
            Reflect.defineMetadata('design:paramtypes', [Perf20H], Perf20G);
            Reflect.defineMetadata('design:paramtypes', [Perf20I], Perf20H);
            Reflect.defineMetadata('design:paramtypes', [Perf20J], Perf20I);
            Reflect.defineMetadata('design:paramtypes', [Perf20K], Perf20J);
            Reflect.defineMetadata('design:paramtypes', [Perf20L], Perf20K);
            Reflect.defineMetadata('design:paramtypes', [Perf20M], Perf20L);
            Reflect.defineMetadata('design:paramtypes', [Perf20N], Perf20M);
            Reflect.defineMetadata('design:paramtypes', [Perf20O], Perf20N);
            Reflect.defineMetadata('design:paramtypes', [Perf20P], Perf20O);
            Reflect.defineMetadata('design:paramtypes', [Perf20Q], Perf20P);
            Reflect.defineMetadata('design:paramtypes', [Perf20R], Perf20Q);
            Reflect.defineMetadata('design:paramtypes', [Perf20S], Perf20R);
            Reflect.defineMetadata('design:paramtypes', [Perf20T], Perf20S);
            Reflect.defineMetadata('design:paramtypes', [Perf20A], Perf20T);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    Perf20A,
                    Perf20B,
                    Perf20C,
                    Perf20D,
                    Perf20E,
                    Perf20F,
                    Perf20G,
                    Perf20H,
                    Perf20I,
                    Perf20J,
                    Perf20K,
                    Perf20L,
                    Perf20M,
                    Perf20N,
                    Perf20O,
                    Perf20P,
                    Perf20Q,
                    Perf20R,
                    Perf20S,
                    Perf20T,
                ),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(10);
            });
        });

        it('detects long cycle with additional non-cyclic dependencies', async () => {
            @InjectableProxy()
            class Util1 {
                value = 'util1';
            }

            @InjectableProxy()
            class Util2 {
                value = 'util2';
            }

            @InjectableProxy()
            class LongCycleH {
                constructor() {}
            }

            @InjectableProxy()
            class LongCycleG {
                constructor() {}
            }

            @InjectableProxy()
            class LongCycleF {
                constructor() {}
            }

            @InjectableProxy()
            class LongCycleE {
                constructor() {}
            }

            @InjectableProxy()
            class LongCycleD {
                constructor() {}
            }

            @InjectableProxy()
            class LongCycleC {
                constructor() {}
            }

            @InjectableProxy()
            class LongCycleB {
                constructor() {}
            }

            @InjectableProxy()
            class LongCycleA {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [LongCycleB, Util1], LongCycleA);
            Reflect.defineMetadata('design:paramtypes', [LongCycleC], LongCycleB);
            Reflect.defineMetadata('design:paramtypes', [LongCycleD, Util2], LongCycleC);
            Reflect.defineMetadata('design:paramtypes', [LongCycleE], LongCycleD);
            Reflect.defineMetadata('design:paramtypes', [LongCycleF, Util1], LongCycleE);
            Reflect.defineMetadata('design:paramtypes', [LongCycleG], LongCycleF);
            Reflect.defineMetadata('design:paramtypes', [LongCycleH, Util2], LongCycleG);
            Reflect.defineMetadata('design:paramtypes', [LongCycleA], LongCycleH);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    Util1,
                    Util2,
                    LongCycleA,
                    LongCycleB,
                    LongCycleC,
                    LongCycleD,
                    LongCycleE,
                    LongCycleF,
                    LongCycleG,
                    LongCycleH,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects long cycle with realistic service names', async () => {
            @InjectableProxy()
            class NotificationService {
                constructor() {}
            }

            @InjectableProxy()
            class EmailService {
                constructor() {}
            }

            @InjectableProxy()
            class TemplateService {
                constructor() {}
            }

            @InjectableProxy()
            class ConfigService {
                constructor() {}
            }

            @InjectableProxy()
            class CacheService {
                constructor() {}
            }

            @InjectableProxy()
            class ValidationService {
                constructor() {}
            }

            @InjectableProxy()
            class LoggerService {
                constructor() {}
            }

            @InjectableProxy()
            class MetricsService {
                constructor() {}
            }

            // Long chain that cycles back
            Reflect.defineMetadata('design:paramtypes', [EmailService], NotificationService);
            Reflect.defineMetadata('design:paramtypes', [TemplateService], EmailService);
            Reflect.defineMetadata('design:paramtypes', [ConfigService], TemplateService);
            Reflect.defineMetadata('design:paramtypes', [CacheService], ConfigService);
            Reflect.defineMetadata('design:paramtypes', [ValidationService], CacheService);
            Reflect.defineMetadata('design:paramtypes', [LoggerService], ValidationService);
            Reflect.defineMetadata('design:paramtypes', [MetricsService], LoggerService);
            Reflect.defineMetadata('design:paramtypes', [NotificationService], MetricsService);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    NotificationService,
                    EmailService,
                    TemplateService,
                    ConfigService,
                    CacheService,
                    ValidationService,
                    LoggerService,
                    MetricsService,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects long cycle registered in reverse order', async () => {
            @InjectableProxy()
            class RevG {
                constructor() {}
            }

            @InjectableProxy()
            class RevF {
                constructor() {}
            }

            @InjectableProxy()
            class RevE {
                constructor() {}
            }

            @InjectableProxy()
            class RevD {
                constructor() {}
            }

            @InjectableProxy()
            class RevC {
                constructor() {}
            }

            @InjectableProxy()
            class RevB {
                constructor() {}
            }

            @InjectableProxy()
            class RevA {
                constructor() {}
            }

            // Define cycle A→B→C→D→E→F→G→A
            Reflect.defineMetadata('design:paramtypes', [RevB], RevA);
            Reflect.defineMetadata('design:paramtypes', [RevC], RevB);
            Reflect.defineMetadata('design:paramtypes', [RevD], RevC);
            Reflect.defineMetadata('design:paramtypes', [RevE], RevD);
            Reflect.defineMetadata('design:paramtypes', [RevF], RevE);
            Reflect.defineMetadata('design:paramtypes', [RevG], RevF);
            Reflect.defineMetadata('design:paramtypes', [RevA], RevG);

            // Register in reverse: G, F, E, D, C, B, A
            app = await createAndInitTestingApp([
                ClsModule.forFeature(RevG, RevF, RevE, RevD, RevC, RevB, RevA),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects long cycle with all nodes having properties', async () => {
            @InjectableProxy()
            class PropNodeF {
                public id = 6;
                constructor() {}
            }

            @InjectableProxy()
            class PropNodeE {
                public id = 5;
                constructor() {}
            }

            @InjectableProxy()
            class PropNodeD {
                public id = 4;
                constructor() {}
            }

            @InjectableProxy()
            class PropNodeC {
                public id = 3;
                constructor() {}
            }

            @InjectableProxy()
            class PropNodeB {
                public id = 2;
                constructor() {}
            }

            @InjectableProxy()
            class PropNodeA {
                public id = 1;
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [PropNodeB], PropNodeA);
            Reflect.defineMetadata('design:paramtypes', [PropNodeC], PropNodeB);
            Reflect.defineMetadata('design:paramtypes', [PropNodeD], PropNodeC);
            Reflect.defineMetadata('design:paramtypes', [PropNodeE], PropNodeD);
            Reflect.defineMetadata('design:paramtypes', [PropNodeF], PropNodeE);
            Reflect.defineMetadata('design:paramtypes', [PropNodeA], PropNodeF);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    PropNodeA,
                    PropNodeB,
                    PropNodeC,
                    PropNodeD,
                    PropNodeE,
                    PropNodeF,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects long cycle with async methods', async () => {
            @InjectableProxy()
            class AsyncLongF {
                constructor() {}
                async process() {
                    return 'F';
                }
            }

            @InjectableProxy()
            class AsyncLongE {
                constructor() {}
                async process() {
                    return 'E';
                }
            }

            @InjectableProxy()
            class AsyncLongD {
                constructor() {}
                async process() {
                    return 'D';
                }
            }

            @InjectableProxy()
            class AsyncLongC {
                constructor() {}
                async process() {
                    return 'C';
                }
            }

            @InjectableProxy()
            class AsyncLongB {
                constructor() {}
                async process() {
                    return 'B';
                }
            }

            @InjectableProxy()
            class AsyncLongA {
                constructor() {}
                async process() {
                    return 'A';
                }
            }

            Reflect.defineMetadata('design:paramtypes', [AsyncLongB], AsyncLongA);
            Reflect.defineMetadata('design:paramtypes', [AsyncLongC], AsyncLongB);
            Reflect.defineMetadata('design:paramtypes', [AsyncLongD], AsyncLongC);
            Reflect.defineMetadata('design:paramtypes', [AsyncLongE], AsyncLongD);
            Reflect.defineMetadata('design:paramtypes', [AsyncLongF], AsyncLongE);
            Reflect.defineMetadata('design:paramtypes', [AsyncLongA], AsyncLongF);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    AsyncLongA,
                    AsyncLongB,
                    AsyncLongC,
                    AsyncLongD,
                    AsyncLongE,
                    AsyncLongF,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects long cycle across different modules', async () => {
            @InjectableProxy()
            class ModLongG {
                constructor() {}
            }

            @InjectableProxy()
            class ModLongF {
                constructor() {}
            }

            @InjectableProxy()
            class ModLongE {
                constructor() {}
            }

            @InjectableProxy()
            class ModLongD {
                constructor() {}
            }

            @InjectableProxy()
            class ModLongC {
                constructor() {}
            }

            @InjectableProxy()
            class ModLongB {
                constructor() {}
            }

            @InjectableProxy()
            class ModLongA {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [ModLongB], ModLongA);
            Reflect.defineMetadata('design:paramtypes', [ModLongC], ModLongB);
            Reflect.defineMetadata('design:paramtypes', [ModLongD], ModLongC);
            Reflect.defineMetadata('design:paramtypes', [ModLongE], ModLongD);
            Reflect.defineMetadata('design:paramtypes', [ModLongF], ModLongE);
            Reflect.defineMetadata('design:paramtypes', [ModLongG], ModLongF);
            Reflect.defineMetadata('design:paramtypes', [ModLongA], ModLongG);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ModLongA, ModLongB),
                ClsModule.forFeature(ModLongC, ModLongD),
                ClsModule.forFeature(ModLongE, ModLongF),
                ClsModule.forFeature(ModLongG),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects long cycle with optional dependencies', async () => {
            @InjectableProxy()
            class OptLongF {
                constructor(_opt?: any) {}
            }

            @InjectableProxy()
            class OptLongE {
                constructor(_opt?: any) {}
            }

            @InjectableProxy()
            class OptLongD {
                constructor(_opt?: any) {}
            }

            @InjectableProxy()
            class OptLongC {
                constructor(_opt?: any) {}
            }

            @InjectableProxy()
            class OptLongB {
                constructor(_opt?: any) {}
            }

            @InjectableProxy()
            class OptLongA {
                constructor(_opt?: any) {}
            }

            Reflect.defineMetadata('design:paramtypes', [OptLongB], OptLongA);
            Reflect.defineMetadata('design:paramtypes', [OptLongC], OptLongB);
            Reflect.defineMetadata('design:paramtypes', [OptLongD], OptLongC);
            Reflect.defineMetadata('design:paramtypes', [OptLongE], OptLongD);
            Reflect.defineMetadata('design:paramtypes', [OptLongF], OptLongE);
            Reflect.defineMetadata('design:paramtypes', [OptLongA], OptLongF);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    OptLongA,
                    OptLongB,
                    OptLongC,
                    OptLongD,
                    OptLongE,
                    OptLongF,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects long cycle with abstract base classes', async () => {
            @InjectableProxy()
            abstract class AbstractLongF {
                abstract execute(): string;
            }

            @InjectableProxy()
            class ConcreteLongF extends AbstractLongF {
                constructor() {
                    super();
                }
                execute() {
                    return 'F';
                }
            }

            @InjectableProxy()
            abstract class AbstractLongE {
                abstract execute(): string;
            }

            @InjectableProxy()
            class ConcreteLongE extends AbstractLongE {
                constructor() {
                    super();
                }
                execute() {
                    return 'E';
                }
            }

            @InjectableProxy()
            class ConcreteLongD {
                constructor() {}
            }

            @InjectableProxy()
            class ConcreteLongC {
                constructor() {}
            }

            @InjectableProxy()
            class ConcreteLongB {
                constructor() {}
            }

            @InjectableProxy()
            class ConcreteLongA {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [ConcreteLongB], ConcreteLongA);
            Reflect.defineMetadata('design:paramtypes', [ConcreteLongC], ConcreteLongB);
            Reflect.defineMetadata('design:paramtypes', [ConcreteLongD], ConcreteLongC);
            Reflect.defineMetadata('design:paramtypes', [ConcreteLongE], ConcreteLongD);
            Reflect.defineMetadata('design:paramtypes', [ConcreteLongF], ConcreteLongE);
            Reflect.defineMetadata('design:paramtypes', [ConcreteLongA], ConcreteLongF);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    ConcreteLongA,
                    ConcreteLongB,
                    ConcreteLongC,
                    ConcreteLongD,
                    ConcreteLongE,
                    ConcreteLongF,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects very long cycle (25 nodes)', async () => {
            const nodes: any[] = [];
            for (let i = 0; i < 25; i++) {
                @InjectableProxy()
                class VeryLongNode {
                    public index = i;
                    constructor() {}
                }
                Object.defineProperty(VeryLongNode, 'name', {
                    value: `VeryLongNode${i}`,
                });
                nodes.push(VeryLongNode);
            }

            // Create cycle: 0→1→2→...→24→0
            for (let i = 0; i < 25; i++) {
                const nextIndex = (i + 1) % 25;
                Reflect.defineMetadata('design:paramtypes', [nodes[nextIndex]], nodes[i]);
            }

            app = await createAndInitTestingApp([ClsModule.forFeature(...nodes)]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('error message includes complete path for long cycle', async () => {
            @InjectableProxy()
            class PathTestE {
                constructor() {}
            }

            @InjectableProxy()
            class PathTestD {
                constructor() {}
            }

            @InjectableProxy()
            class PathTestC {
                constructor() {}
            }

            @InjectableProxy()
            class PathTestB {
                constructor() {}
            }

            @InjectableProxy()
            class PathTestA {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [PathTestB], PathTestA);
            Reflect.defineMetadata('design:paramtypes', [PathTestC], PathTestB);
            Reflect.defineMetadata('design:paramtypes', [PathTestD], PathTestC);
            Reflect.defineMetadata('design:paramtypes', [PathTestE], PathTestD);
            Reflect.defineMetadata('design:paramtypes', [PathTestA], PathTestE);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(PathTestA, PathTestB, PathTestC, PathTestD, PathTestE),
            ]);

            await cls.run(async () => {
                try {
                    await cls.proxy.resolve();
                    fail('Should have thrown');
                } catch (error: any) {
                    expect(error.message).toMatch(/PathTestA/);
                    expect(error.message).toMatch(/PathTestB/);
                    expect(error.message).toMatch(/PathTestC/);
                    expect(error.message).toMatch(/PathTestD/);
                    expect(error.message).toMatch(/PathTestE/);
                    expect(error.message).toMatch(/→/);
                }
            });
        });

        it('detects long cycle with numeric class names', async () => {
            @InjectableProxy()
            class Node100 {
                constructor() {}
            }

            @InjectableProxy()
            class Node99 {
                constructor() {}
            }

            @InjectableProxy()
            class Node98 {
                constructor() {}
            }

            @InjectableProxy()
            class Node97 {
                constructor() {}
            }

            @InjectableProxy()
            class Node96 {
                constructor() {}
            }

            @InjectableProxy()
            class Node95 {
                constructor() {}
            }

            @InjectableProxy()
            class Node94 {
                constructor() {}
            }

            @InjectableProxy()
            class Node93 {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [Node99], Node100);
            Reflect.defineMetadata('design:paramtypes', [Node98], Node99);
            Reflect.defineMetadata('design:paramtypes', [Node97], Node98);
            Reflect.defineMetadata('design:paramtypes', [Node96], Node97);
            Reflect.defineMetadata('design:paramtypes', [Node95], Node96);
            Reflect.defineMetadata('design:paramtypes', [Node94], Node95);
            Reflect.defineMetadata('design:paramtypes', [Node93], Node94);
            Reflect.defineMetadata('design:paramtypes', [Node100], Node93);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    Node100,
                    Node99,
                    Node98,
                    Node97,
                    Node96,
                    Node95,
                    Node94,
                    Node93,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects 9-node cycle efficiently', async () => {
            @InjectableProxy()
            class Chain9I {
                constructor() {}
            }

            @InjectableProxy()
            class Chain9H {
                constructor() {}
            }

            @InjectableProxy()
            class Chain9G {
                constructor() {}
            }

            @InjectableProxy()
            class Chain9F {
                constructor() {}
            }

            @InjectableProxy()
            class Chain9E {
                constructor() {}
            }

            @InjectableProxy()
            class Chain9D {
                constructor() {}
            }

            @InjectableProxy()
            class Chain9C {
                constructor() {}
            }

            @InjectableProxy()
            class Chain9B {
                constructor() {}
            }

            @InjectableProxy()
            class Chain9A {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [Chain9B], Chain9A);
            Reflect.defineMetadata('design:paramtypes', [Chain9C], Chain9B);
            Reflect.defineMetadata('design:paramtypes', [Chain9D], Chain9C);
            Reflect.defineMetadata('design:paramtypes', [Chain9E], Chain9D);
            Reflect.defineMetadata('design:paramtypes', [Chain9F], Chain9E);
            Reflect.defineMetadata('design:paramtypes', [Chain9G], Chain9F);
            Reflect.defineMetadata('design:paramtypes', [Chain9H], Chain9G);
            Reflect.defineMetadata('design:paramtypes', [Chain9I], Chain9H);
            Reflect.defineMetadata('design:paramtypes', [Chain9A], Chain9I);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    Chain9A,
                    Chain9B,
                    Chain9C,
                    Chain9D,
                    Chain9E,
                    Chain9F,
                    Chain9G,
                    Chain9H,
                    Chain9I,
                ),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(10);
            });
        });

        it('detects 18-node cycle with performance validation', async () => {
            @InjectableProxy()
            class LongA {
                constructor() {}
            }
            @InjectableProxy()
            class LongB {
                constructor() {}
            }
            @InjectableProxy()
            class LongC {
                constructor() {}
            }
            @InjectableProxy()
            class LongD {
                constructor() {}
            }
            @InjectableProxy()
            class LongE {
                constructor() {}
            }
            @InjectableProxy()
            class LongF {
                constructor() {}
            }
            @InjectableProxy()
            class LongG {
                constructor() {}
            }
            @InjectableProxy()
            class LongH {
                constructor() {}
            }
            @InjectableProxy()
            class LongI {
                constructor() {}
            }
            @InjectableProxy()
            class LongJ {
                constructor() {}
            }
            @InjectableProxy()
            class LongK {
                constructor() {}
            }
            @InjectableProxy()
            class LongL {
                constructor() {}
            }
            @InjectableProxy()
            class LongM {
                constructor() {}
            }
            @InjectableProxy()
            class LongN {
                constructor() {}
            }
            @InjectableProxy()
            class LongO {
                constructor() {}
            }
            @InjectableProxy()
            class LongP {
                constructor() {}
            }
            @InjectableProxy()
            class LongQ {
                constructor() {}
            }
            @InjectableProxy()
            class LongR {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [LongB], LongA);
            Reflect.defineMetadata('design:paramtypes', [LongC], LongB);
            Reflect.defineMetadata('design:paramtypes', [LongD], LongC);
            Reflect.defineMetadata('design:paramtypes', [LongE], LongD);
            Reflect.defineMetadata('design:paramtypes', [LongF], LongE);
            Reflect.defineMetadata('design:paramtypes', [LongG], LongF);
            Reflect.defineMetadata('design:paramtypes', [LongH], LongG);
            Reflect.defineMetadata('design:paramtypes', [LongI], LongH);
            Reflect.defineMetadata('design:paramtypes', [LongJ], LongI);
            Reflect.defineMetadata('design:paramtypes', [LongK], LongJ);
            Reflect.defineMetadata('design:paramtypes', [LongL], LongK);
            Reflect.defineMetadata('design:paramtypes', [LongM], LongL);
            Reflect.defineMetadata('design:paramtypes', [LongN], LongM);
            Reflect.defineMetadata('design:paramtypes', [LongO], LongN);
            Reflect.defineMetadata('design:paramtypes', [LongP], LongO);
            Reflect.defineMetadata('design:paramtypes', [LongQ], LongP);
            Reflect.defineMetadata('design:paramtypes', [LongR], LongQ);
            Reflect.defineMetadata('design:paramtypes', [LongA], LongR);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    LongA,
                    LongB,
                    LongC,
                    LongD,
                    LongE,
                    LongF,
                    LongG,
                    LongH,
                    LongI,
                    LongJ,
                    LongK,
                    LongL,
                    LongM,
                    LongN,
                    LongO,
                    LongP,
                    LongQ,
                    LongR,
                ),
            ]);

            await cls.run(async () => {
                const start = performance.now();
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
                const duration = performance.now() - start;
                expect(duration).toBeLessThan(10);
            });
        });
    });

    describe('4. Mixed Scenarios (25 tests)', () => {
        it('detects cycle with shared non-cyclic dependencies', async () => {
            @InjectableProxy()
            class SharedConfig {
                value = 'config';
            }

            @InjectableProxy()
            class SharedLogger {
                value = 'logger';
            }

            @InjectableProxy()
            class MixedC {
                constructor() {}
            }

            @InjectableProxy()
            class MixedB {
                constructor() {}
            }

            @InjectableProxy()
            class MixedA {
                constructor() {}
            }

            // All nodes depend on shared services, but A→B→C→A is a cycle
            Reflect.defineMetadata('design:paramtypes', [MixedB, SharedConfig], MixedA);
            Reflect.defineMetadata('design:paramtypes', [MixedC, SharedLogger], MixedB);
            Reflect.defineMetadata('design:paramtypes', [MixedA, SharedConfig, SharedLogger], MixedC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(SharedConfig, SharedLogger, MixedA, MixedB, MixedC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with different entry points', async () => {
            @InjectableProxy()
            class EntryX {
                constructor() {}
            }

            @InjectableProxy()
            class EntryY {
                constructor() {}
            }

            @InjectableProxy()
            class CycleNodeB {
                constructor() {}
            }

            @InjectableProxy()
            class CycleNodeA {
                constructor() {}
            }

            // EntryX→CycleNodeA, EntryY→CycleNodeB, CycleNodeA↔CycleNodeB
            Reflect.defineMetadata('design:paramtypes', [CycleNodeA], EntryX);
            Reflect.defineMetadata('design:paramtypes', [CycleNodeB], EntryY);
            Reflect.defineMetadata('design:paramtypes', [CycleNodeB], CycleNodeA);
            Reflect.defineMetadata('design:paramtypes', [CycleNodeA], CycleNodeB);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(EntryX, EntryY, CycleNodeA, CycleNodeB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects partial overlapping cycles', async () => {
            @InjectableProxy()
            class OverlapD {
                constructor() {}
            }

            @InjectableProxy()
            class OverlapC {
                constructor() {}
            }

            @InjectableProxy()
            class OverlapB {
                constructor() {}
            }

            @InjectableProxy()
            class OverlapA {
                constructor() {}
            }

            // A→B→A (cycle 1) and B→C→D→B (cycle 2, shares B)
            Reflect.defineMetadata('design:paramtypes', [OverlapB], OverlapA);
            Reflect.defineMetadata('design:paramtypes', [OverlapA, OverlapC], OverlapB);
            Reflect.defineMetadata('design:paramtypes', [OverlapD], OverlapC);
            Reflect.defineMetadata('design:paramtypes', [OverlapB], OverlapD);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(OverlapA, OverlapB, OverlapC, OverlapD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with diamond dependency pattern', async () => {
            @InjectableProxy()
            class DiamondBase {
                value = 'base';
            }

            @InjectableProxy()
            class DiamondLeftPath {
                constructor() {}
            }

            @InjectableProxy()
            class DiamondRightPath {
                constructor() {}
            }

            @InjectableProxy()
            class DiamondMerge {
                constructor() {}
            }

            @InjectableProxy()
            class DiamondCycle {
                constructor() {}
            }

            // Diamond + cycle: Left→Cycle→Left (2-node cycle) + Merge→Left,Right; Right→Base
            Reflect.defineMetadata('design:paramtypes', [DiamondCycle], DiamondLeftPath);
            Reflect.defineMetadata('design:paramtypes', [DiamondBase], DiamondRightPath);
            Reflect.defineMetadata('design:paramtypes', [DiamondLeftPath, DiamondRightPath], DiamondMerge);
            Reflect.defineMetadata('design:paramtypes', [DiamondLeftPath], DiamondCycle);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(
                    DiamondBase,
                    DiamondLeftPath,
                    DiamondRightPath,
                    DiamondMerge,
                    DiamondCycle,
                ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle in graph with many non-cyclic nodes', async () => {
            @InjectableProxy()
            class Safe1 {
                value = '1';
            }

            @InjectableProxy()
            class Safe2 {
                value = '2';
            }

            @InjectableProxy()
            class Safe3 {
                value = '3';
            }

            @InjectableProxy()
            class Safe4 {
                value = '4';
            }

            @InjectableProxy()
            class Safe5 {
                value = '5';
            }

            @InjectableProxy()
            class CyclicX {
                constructor() {}
            }

            @InjectableProxy()
            class CyclicY {
                constructor() {}
            }

            // Many safe nodes, one cycle: CyclicX↔CyclicY
            Reflect.defineMetadata('design:paramtypes', [CyclicY], CyclicX);
            Reflect.defineMetadata('design:paramtypes', [CyclicX], CyclicY);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Safe1, Safe2, Safe3, CyclicX, Safe4, CyclicY, Safe5),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with complex interdependencies', async () => {
            @InjectableProxy()
            class ComplexA {
                constructor() {}
            }

            @InjectableProxy()
            class ComplexB {
                constructor() {}
            }

            @InjectableProxy()
            class ComplexC {
                constructor() {}
            }

            @InjectableProxy()
            class ComplexD {
                constructor() {}
            }

            // Complex: A→B,C; B→C,D; C→D,A; D→A (multiple paths + cycle)
            Reflect.defineMetadata('design:paramtypes', [ComplexB, ComplexC], ComplexA);
            Reflect.defineMetadata('design:paramtypes', [ComplexC, ComplexD], ComplexB);
            Reflect.defineMetadata('design:paramtypes', [ComplexD, ComplexA], ComplexC);
            Reflect.defineMetadata('design:paramtypes', [ComplexA], ComplexD);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ComplexA, ComplexB, ComplexC, ComplexD),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with providers having varying dependency counts', async () => {
            @InjectableProxy()
            class VaryA {
                constructor() {}
            }

            @InjectableProxy()
            class VaryB {
                constructor() {}
            }

            @InjectableProxy()
            class VaryC {
                constructor() {}
            }

            @InjectableProxy()
            class VaryD {
                constructor() {}
            }

            @InjectableProxy()
            class VaryE {
                constructor() {}
            }

            @InjectableProxy()
            class UtilX {
                value = 'X';
            }

            @InjectableProxy()
            class UtilY {
                value = 'Y';
            }

            @InjectableProxy()
            class UtilZ {
                value = 'Z';
            }

            // Varying: A has 1 dep, B has 2, C has 3, D has 2, E has 1, and E→A cycles
            Reflect.defineMetadata('design:paramtypes', [VaryB], VaryA);
            Reflect.defineMetadata('design:paramtypes', [VaryC, UtilX], VaryB);
            Reflect.defineMetadata('design:paramtypes', [VaryD, UtilY, UtilZ], VaryC);
            Reflect.defineMetadata('design:paramtypes', [VaryE, UtilX], VaryD);
            Reflect.defineMetadata('design:paramtypes', [VaryA], VaryE);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(VaryA, VaryB, VaryC, VaryD, VaryE, UtilX, UtilY, UtilZ),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with mix of interfaces and concrete classes', async () => {
            interface IServiceA {
                execute(): string;
            }

            interface IServiceB {
                execute(): string;
            }

            @InjectableProxy()
            class ConcreteA implements IServiceA {
                constructor() {}
                execute() {
                    return 'A';
                }
            }

            @InjectableProxy()
            class ConcreteB implements IServiceB {
                constructor() {}
                execute() {
                    return 'B';
                }
            }

            @InjectableProxy()
            class ConcreteC {
                constructor() {}
            }

            // ConcreteA→ConcreteB→ConcreteC→ConcreteA
            Reflect.defineMetadata('design:paramtypes', [ConcreteB], ConcreteA);
            Reflect.defineMetadata('design:paramtypes', [ConcreteC], ConcreteB);
            Reflect.defineMetadata('design:paramtypes', [ConcreteA], ConcreteC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ConcreteA, ConcreteB, ConcreteC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with providers registered across multiple calls', async () => {
            @InjectableProxy()
            class MultiCallA {
                constructor() {}
            }

            @InjectableProxy()
            class MultiCallB {
                constructor() {}
            }

            @InjectableProxy()
            class MultiCallC {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [MultiCallB], MultiCallA);
            Reflect.defineMetadata('design:paramtypes', [MultiCallC], MultiCallB);
            Reflect.defineMetadata('design:paramtypes', [MultiCallA], MultiCallC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(MultiCallA),
                ClsModule.forFeature(MultiCallB),
                ClsModule.forFeature(MultiCallC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with singleton and transient-like patterns', async () => {
            @InjectableProxy()
            class SingletonLike {
                private static instance?: SingletonLike;
                constructor() {}
                static getInstance() {
                    return this.instance;
                }
            }

            @InjectableProxy()
            class TransientLike {
                constructor() {}
            }

            @InjectableProxy()
            class MixedPatternA {
                constructor() {}
            }

            // MixedPatternA→SingletonLike→TransientLike→MixedPatternA
            Reflect.defineMetadata('design:paramtypes', [SingletonLike], MixedPatternA);
            Reflect.defineMetadata('design:paramtypes', [TransientLike], SingletonLike);
            Reflect.defineMetadata('design:paramtypes', [MixedPatternA], TransientLike);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(MixedPatternA, SingletonLike, TransientLike),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with decorators and metadata', async () => {
            @InjectableProxy()
            class DecoratedA {
                public readonly metadata = { role: 'A' };
                constructor() {}
            }

            @InjectableProxy()
            class DecoratedB {
                public readonly metadata = { role: 'B' };
                constructor() {}
            }

            @InjectableProxy()
            class DecoratedC {
                public readonly metadata = { role: 'C' };
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [DecoratedB], DecoratedA);
            Reflect.defineMetadata('design:paramtypes', [DecoratedC], DecoratedB);
            Reflect.defineMetadata('design:paramtypes', [DecoratedA], DecoratedC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(DecoratedA, DecoratedB, DecoratedC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with factory-like patterns', async () => {
            @InjectableProxy()
            class FactoryA {
                constructor() {}
                create() {
                    return {};
                }
            }

            @InjectableProxy()
            class FactoryB {
                constructor() {}
                create() {
                    return {};
                }
            }

            @InjectableProxy()
            class FactoryC {
                constructor() {}
                create() {
                    return {};
                }
            }

            Reflect.defineMetadata('design:paramtypes', [FactoryB], FactoryA);
            Reflect.defineMetadata('design:paramtypes', [FactoryC], FactoryB);
            Reflect.defineMetadata('design:paramtypes', [FactoryA], FactoryC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(FactoryA, FactoryB, FactoryC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle in repository-service-controller pattern', async () => {
            @InjectableProxy()
            class MixedRepository {
                constructor() {}
            }

            @InjectableProxy()
            class MixedService {
                constructor() {}
            }

            @InjectableProxy()
            class MixedController {
                constructor() {}
            }

            // Cyclic anti-pattern: Repository→Service→Controller→Repository
            Reflect.defineMetadata('design:paramtypes', [MixedService], MixedRepository);
            Reflect.defineMetadata('design:paramtypes', [MixedController], MixedService);
            Reflect.defineMetadata('design:paramtypes', [MixedRepository], MixedController);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(MixedRepository, MixedService, MixedController),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with event emitters and handlers', async () => {
            @InjectableProxy()
            class EventEmitter {
                constructor() {}
            }

            @InjectableProxy()
            class EventHandlerA {
                constructor() {}
            }

            @InjectableProxy()
            class EventHandlerB {
                constructor() {}
            }

            // EventEmitter→HandlerA→HandlerB→EventEmitter
            Reflect.defineMetadata('design:paramtypes', [EventHandlerA], EventEmitter);
            Reflect.defineMetadata('design:paramtypes', [EventHandlerB], EventHandlerA);
            Reflect.defineMetadata('design:paramtypes', [EventEmitter], EventHandlerB);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(EventEmitter, EventHandlerA, EventHandlerB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with middleware-like pattern', async () => {
            @InjectableProxy()
            class MiddlewareA {
                constructor() {}
                async handle() {
                    return 'next';
                }
            }

            @InjectableProxy()
            class MiddlewareB {
                constructor() {}
                async handle() {
                    return 'next';
                }
            }

            @InjectableProxy()
            class MiddlewareC {
                constructor() {}
                async handle() {
                    return 'next';
                }
            }

            Reflect.defineMetadata('design:paramtypes', [MiddlewareB], MiddlewareA);
            Reflect.defineMetadata('design:paramtypes', [MiddlewareC], MiddlewareB);
            Reflect.defineMetadata('design:paramtypes', [MiddlewareA], MiddlewareC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(MiddlewareA, MiddlewareB, MiddlewareC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with strategy pattern implementation', async () => {
            @InjectableProxy()
            class StrategyContext {
                constructor() {}
            }

            @InjectableProxy()
            class StrategyA {
                constructor() {}
            }

            @InjectableProxy()
            class StrategyB {
                constructor() {}
            }

            // StrategyContext→StrategyA→StrategyB→StrategyContext
            Reflect.defineMetadata('design:paramtypes', [StrategyA], StrategyContext);
            Reflect.defineMetadata('design:paramtypes', [StrategyB], StrategyA);
            Reflect.defineMetadata('design:paramtypes', [StrategyContext], StrategyB);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(StrategyContext, StrategyA, StrategyB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with observer pattern', async () => {
            @InjectableProxy()
            class Subject {
                constructor() {}
            }

            @InjectableProxy()
            class ObserverA {
                constructor() {}
            }

            @InjectableProxy()
            class ObserverB {
                constructor() {}
            }

            // Subject→ObserverA→ObserverB→Subject
            Reflect.defineMetadata('design:paramtypes', [ObserverA], Subject);
            Reflect.defineMetadata('design:paramtypes', [ObserverB], ObserverA);
            Reflect.defineMetadata('design:paramtypes', [Subject], ObserverB);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Subject, ObserverA, ObserverB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with dependency injection container pattern', async () => {
            @InjectableProxy()
            class Container {
                constructor() {}
            }

            @InjectableProxy()
            class ResolverA {
                constructor() {}
            }

            @InjectableProxy()
            class ResolverB {
                constructor() {}
            }

            // Container→ResolverA→ResolverB→Container
            Reflect.defineMetadata('design:paramtypes', [ResolverA], Container);
            Reflect.defineMetadata('design:paramtypes', [ResolverB], ResolverA);
            Reflect.defineMetadata('design:paramtypes', [Container], ResolverB);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Container, ResolverA, ResolverB),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle quickly in mixed scenario', async () => {
            @InjectableProxy()
            class QuickMixedA {
                constructor() {}
            }

            @InjectableProxy()
            class QuickMixedB {
                constructor() {}
            }

            @InjectableProxy()
            class QuickMixedC {
                constructor() {}
            }

            @InjectableProxy()
            class SafeUtil {
                value = 'safe';
            }

            Reflect.defineMetadata('design:paramtypes', [QuickMixedB, SafeUtil], QuickMixedA);
            Reflect.defineMetadata('design:paramtypes', [QuickMixedC], QuickMixedB);
            Reflect.defineMetadata('design:paramtypes', [QuickMixedA, SafeUtil], QuickMixedC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(QuickMixedA, QuickMixedB, QuickMixedC, SafeUtil),
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

        it('detects cycle with real-world microservice pattern', async () => {
            @InjectableProxy()
            class ApiGateway {
                constructor() {}
            }

            @InjectableProxy()
            class AuthService {
                constructor() {}
            }

            @InjectableProxy()
            class UserService {
                constructor() {}
            }

            @InjectableProxy()
            class NotificationService {
                constructor() {}
            }

            // ApiGateway→AuthService→UserService→NotificationService→ApiGateway
            Reflect.defineMetadata('design:paramtypes', [AuthService], ApiGateway);
            Reflect.defineMetadata('design:paramtypes', [UserService], AuthService);
            Reflect.defineMetadata('design:paramtypes', [NotificationService], UserService);
            Reflect.defineMetadata('design:paramtypes', [ApiGateway], NotificationService);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(ApiGateway, AuthService, UserService, NotificationService),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with cache layer dependencies', async () => {
            @InjectableProxy()
            class CacheManager {
                constructor() {}
            }

            @InjectableProxy()
            class DataService {
                constructor() {}
            }

            @InjectableProxy()
            class CacheInvalidator {
                constructor() {}
            }

            // CacheManager→DataService→CacheInvalidator→CacheManager
            Reflect.defineMetadata('design:paramtypes', [DataService], CacheManager);
            Reflect.defineMetadata('design:paramtypes', [CacheInvalidator], DataService);
            Reflect.defineMetadata('design:paramtypes', [CacheManager], CacheInvalidator);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(CacheManager, DataService, CacheInvalidator),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with validation chain', async () => {
            @InjectableProxy()
            class Validator {
                constructor() {}
            }

            @InjectableProxy()
            class RuleEngine {
                constructor() {}
            }

            @InjectableProxy()
            class SchemaBuilder {
                constructor() {}
            }

            // Validator→RuleEngine→SchemaBuilder→Validator
            Reflect.defineMetadata('design:paramtypes', [RuleEngine], Validator);
            Reflect.defineMetadata('design:paramtypes', [SchemaBuilder], RuleEngine);
            Reflect.defineMetadata('design:paramtypes', [Validator], SchemaBuilder);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Validator, RuleEngine, SchemaBuilder),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with serialization dependencies', async () => {
            @InjectableProxy()
            class Serializer {
                constructor() {}
            }

            @InjectableProxy()
            class Transformer {
                constructor() {}
            }

            @InjectableProxy()
            class Formatter {
                constructor() {}
            }

            // Serializer→Transformer→Formatter→Serializer
            Reflect.defineMetadata('design:paramtypes', [Transformer], Serializer);
            Reflect.defineMetadata('design:paramtypes', [Formatter], Transformer);
            Reflect.defineMetadata('design:paramtypes', [Serializer], Formatter);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(Serializer, Transformer, Formatter),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('detects cycle with pipeline processing', async () => {
            @InjectableProxy()
            class PipelineCoordinator {
                constructor() {}
            }

            @InjectableProxy()
            class StageA {
                constructor() {}
            }

            @InjectableProxy()
            class StageB {
                constructor() {}
            }

            @InjectableProxy()
            class StageC {
                constructor() {}
            }

            // PipelineCoordinator→StageA→StageB→StageC→PipelineCoordinator
            Reflect.defineMetadata('design:paramtypes', [StageA], PipelineCoordinator);
            Reflect.defineMetadata('design:paramtypes', [StageB], StageA);
            Reflect.defineMetadata('design:paramtypes', [StageC], StageB);
            Reflect.defineMetadata('design:paramtypes', [PipelineCoordinator], StageC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(PipelineCoordinator, StageA, StageB, StageC),
            ]);

            await cls.run(async () => {
                await expect(cls.proxy.resolve()).rejects.toThrow(
                    ProxyProviderCircularDependencyException,
                );
            });
        });

        it('error message is helpful for mixed scenario', async () => {
            @InjectableProxy()
            class MixedErrorA {
                constructor() {}
            }

            @InjectableProxy()
            class MixedErrorB {
                constructor() {}
            }

            @InjectableProxy()
            class MixedErrorC {
                constructor() {}
            }

            Reflect.defineMetadata('design:paramtypes', [MixedErrorB], MixedErrorA);
            Reflect.defineMetadata('design:paramtypes', [MixedErrorC], MixedErrorB);
            Reflect.defineMetadata('design:paramtypes', [MixedErrorA], MixedErrorC);

            app = await createAndInitTestingApp([
                ClsModule.forFeature(MixedErrorA, MixedErrorB, MixedErrorC),
            ]);

            await cls.run(async () => {
                try {
                    await cls.proxy.resolve();
                    fail('Should have thrown');
                } catch (error: any) {
                    expect(error).toBeInstanceOf(ProxyProviderCircularDependencyException);
                    expect(error.message).toContain('Circular dependency detected');
                    expect(error.message).toMatch(/MixedErrorA/);
                    expect(error.message).toMatch(/MixedErrorB/);
                    expect(error.message).toMatch(/MixedErrorC/);
                }
            });
        });
    });
});
