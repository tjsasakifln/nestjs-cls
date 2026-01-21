import { DependencyGraph } from './dependency-graph';

describe('DependencyGraph', () => {
    describe('detectCycles', () => {
        describe('simple cycles', () => {
            it('should detect a direct cycle (A→B→A)', () => {
                const dependencies = new Map([
                    ['A', ['B']],
                    ['B', ['A']],
                ]);

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(true);
                expect(result.cycles).toHaveLength(1);
                expect(result.cycles[0]).toEqual(['A', 'B', 'A']);
            });

            it('should detect a self-referencing cycle (A→A)', () => {
                const dependencies = new Map([['A', ['A']]]);

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(true);
                expect(result.cycles).toHaveLength(1);
                expect(result.cycles[0]).toEqual(['A', 'A']);
            });

            it('should detect a three-node cycle (A→B→C→A)', () => {
                const dependencies = new Map([
                    ['A', ['B']],
                    ['B', ['C']],
                    ['C', ['A']],
                ]);

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(true);
                expect(result.cycles).toHaveLength(1);
                expect(result.cycles[0]).toEqual(['A', 'B', 'C', 'A']);
            });
        });

        describe('complex cycles', () => {
            it('should detect an indirect cycle (A→B→C→D→B)', () => {
                const dependencies = new Map([
                    ['A', ['B']],
                    ['B', ['C']],
                    ['C', ['D']],
                    ['D', ['B']],
                ]);

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(true);
                expect(result.cycles).toHaveLength(1);
                expect(result.cycles[0]).toEqual(['B', 'C', 'D', 'B']);
            });

            it('should detect multiple independent cycles', () => {
                const dependencies = new Map([
                    // Cycle 1: A→B→A
                    ['A', ['B']],
                    ['B', ['A']],
                    // Cycle 2: C→D→C
                    ['C', ['D']],
                    ['D', ['C']],
                ]);

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(true);
                expect(result.cycles).toHaveLength(2);

                // Sort cycles for consistent testing
                const sortedCycles = result.cycles.sort((a, b) =>
                    a[0] > b[0] ? 1 : -1,
                );

                expect(sortedCycles[0]).toEqual(['A', 'B', 'A']);
                expect(sortedCycles[1]).toEqual(['C', 'D', 'C']);
            });

            it('should detect a cycle in a complex graph with multiple paths', () => {
                const dependencies = new Map([
                    ['A', ['B', 'C']],
                    ['B', ['D']],
                    ['C', ['D']],
                    ['D', ['E']],
                    ['E', ['B']], // Creates cycle: B→D→E→B
                ]);

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(true);
                expect(result.cycles).toHaveLength(1);
                expect(result.cycles[0]).toEqual(['B', 'D', 'E', 'B']);
            });

            it('should handle a graph with nested cycles', () => {
                const dependencies = new Map([
                    ['A', ['B']],
                    ['B', ['C', 'D']],
                    ['C', ['A']], // Cycle 1: A→B→C→A
                    ['D', ['E']],
                    ['E', ['D']], // Cycle 2: D→E→D
                ]);

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(true);
                expect(result.cycles.length).toBeGreaterThanOrEqual(1);

                // Should detect at least the outer cycle
                const hasOuterCycle = result.cycles.some(
                    (cycle) =>
                        JSON.stringify(cycle) ===
                        JSON.stringify(['A', 'B', 'C', 'A']),
                );
                expect(hasOuterCycle).toBe(true);
            });
        });

        describe('valid DAGs (no cycles)', () => {
            it('should not detect cycles in a simple DAG', () => {
                const dependencies = new Map([
                    ['A', ['B', 'C']],
                    ['B', ['D']],
                    ['C', ['D']],
                    ['D', []],
                ]);

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(false);
                expect(result.cycles).toHaveLength(0);
            });

            it('should not detect cycles in a linear dependency chain', () => {
                const dependencies = new Map([
                    ['A', ['B']],
                    ['B', ['C']],
                    ['C', ['D']],
                    ['D', ['E']],
                    ['E', []],
                ]);

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(false);
                expect(result.cycles).toHaveLength(0);
            });

            it('should handle a disconnected DAG', () => {
                const dependencies = new Map([
                    // Component 1
                    ['A', ['B']],
                    ['B', []],
                    // Component 2
                    ['C', ['D']],
                    ['D', []],
                ]);

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(false);
                expect(result.cycles).toHaveLength(0);
            });
        });

        describe('edge cases', () => {
            it('should handle an empty graph', () => {
                const dependencies = new Map<string, string[]>();

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(false);
                expect(result.cycles).toHaveLength(0);
            });

            it('should handle a single node with no dependencies', () => {
                const dependencies = new Map([['A', []]]);

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(false);
                expect(result.cycles).toHaveLength(0);
            });

            it('should handle nodes with undefined dependencies (treated as empty)', () => {
                const dependencies = new Map<string, string[]>([
                    ['A', ['B']],
                    ['B', ['C']],
                ]);
                // C is not in the map, so it has no dependencies

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(false);
                expect(result.cycles).toHaveLength(0);
            });

            it('should handle a large graph without cycles', () => {
                // Create a graph with 100 nodes in a tree structure
                const dependencies = new Map<string, string[]>();
                for (let i = 0; i < 100; i++) {
                    const node = `Node${i}`;
                    const deps: string[] = [];
                    // Each node depends on the next two nodes (tree structure)
                    if (i * 2 + 1 < 100) deps.push(`Node${i * 2 + 1}`);
                    if (i * 2 + 2 < 100) deps.push(`Node${i * 2 + 2}`);
                    dependencies.set(node, deps);
                }

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(false);
                expect(result.cycles).toHaveLength(0);
            });

            it('should handle a large graph with a single cycle', () => {
                // Create a long chain with a cycle at the end
                const dependencies = new Map<string, string[]>();
                for (let i = 0; i < 50; i++) {
                    dependencies.set(`Node${i}`, [`Node${i + 1}`]);
                }
                // Create cycle: Node50 → Node51 → Node52 → Node50
                dependencies.set('Node50', ['Node51']);
                dependencies.set('Node51', ['Node52']);
                dependencies.set('Node52', ['Node50']);

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(true);
                expect(result.cycles).toHaveLength(1);
                expect(result.cycles[0]).toEqual([
                    'Node50',
                    'Node51',
                    'Node52',
                    'Node50',
                ]);
            });
        });

        describe('with Symbol nodes', () => {
            it('should detect cycles in graphs with Symbol nodes', () => {
                const symbolA = Symbol('A');
                const symbolB = Symbol('B');
                const symbolC = Symbol('C');

                const dependencies = new Map([
                    [symbolA, [symbolB]],
                    [symbolB, [symbolC]],
                    [symbolC, [symbolA]],
                ]);

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(true);
                expect(result.cycles).toHaveLength(1);
                expect(result.cycles[0]).toEqual([
                    symbolA,
                    symbolB,
                    symbolC,
                    symbolA,
                ]);
            });

            it('should not detect cycles in DAGs with Symbol nodes', () => {
                const symbolA = Symbol('A');
                const symbolB = Symbol('B');
                const symbolC = Symbol('C');

                const dependencies = new Map([
                    [symbolA, [symbolB, symbolC]],
                    [symbolB, []],
                    [symbolC, []],
                ]);

                const graph = new DependencyGraph(dependencies);
                const result = graph.detectCycles();

                expect(result.hasCycles).toBe(false);
                expect(result.cycles).toHaveLength(0);
            });
        });

        describe('multiple calls to detectCycles', () => {
            it('should return consistent results across multiple calls', () => {
                const dependencies = new Map([
                    ['A', ['B']],
                    ['B', ['C']],
                    ['C', ['A']],
                ]);

                const graph = new DependencyGraph(dependencies);

                const result1 = graph.detectCycles();
                const result2 = graph.detectCycles();
                const result3 = graph.detectCycles();

                expect(result1).toEqual(result2);
                expect(result2).toEqual(result3);
            });
        });
    });

    describe('formatCycle', () => {
        it('should format a string cycle with default formatter', () => {
            const cycle = ['A', 'B', 'C', 'A'];
            const formatted = DependencyGraph.formatCycle(cycle);

            expect(formatted).toBe('A → B → C → A');
        });

        it('should format a Symbol cycle with custom formatter', () => {
            const symbolA = Symbol('ProviderA');
            const symbolB = Symbol('ProviderB');
            const symbolC = Symbol('ProviderC');

            const cycle = [symbolA, symbolB, symbolC, symbolA];
            const formatted = DependencyGraph.formatCycle(
                cycle,
                (sym) => sym.description ?? 'unknown',
            );

            expect(formatted).toBe(
                'ProviderA → ProviderB → ProviderC → ProviderA',
            );
        });

        it('should handle single-node cycle', () => {
            const cycle = ['A', 'A'];
            const formatted = DependencyGraph.formatCycle(cycle);

            expect(formatted).toBe('A → A');
        });

        it('should handle empty cycle', () => {
            const cycle: string[] = [];
            const formatted = DependencyGraph.formatCycle(cycle);

            expect(formatted).toBe('');
        });

        it('should format numeric nodes', () => {
            const cycle = [1, 2, 3, 1];
            const formatted = DependencyGraph.formatCycle(cycle);

            expect(formatted).toBe('1 → 2 → 3 → 1');
        });

        it('should use custom formatter for objects', () => {
            interface Node {
                id: string;
                name: string;
            }

            const nodeA: Node = { id: '1', name: 'NodeA' };
            const nodeB: Node = { id: '2', name: 'NodeB' };
            const nodeC: Node = { id: '3', name: 'NodeC' };

            const cycle = [nodeA, nodeB, nodeC, nodeA];
            const formatted = DependencyGraph.formatCycle(
                cycle,
                (node) => node.name,
            );

            expect(formatted).toBe('NodeA → NodeB → NodeC → NodeA');
        });
    });
});
