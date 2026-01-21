/**
 * Represents the result of cycle detection in a dependency graph.
 */
export interface CycleDetectionResult<T> {
    /**
     * Whether any cycles were detected in the graph.
     */
    hasCycles: boolean;

    /**
     * Array of detected cycles, where each cycle is represented as an array of nodes
     * forming the cycle path. For example, [A, B, C, A] represents a cycle A→B→C→A.
     */
    cycles: T[][];
}

/**
 * A directed graph utility for analyzing dependencies and detecting circular references.
 *
 * This class uses depth-first search (DFS) to detect cycles in O(V + E) time complexity,
 * where V is the number of vertices (nodes) and E is the number of edges (dependencies).
 *
 * @template T The type of the node identifiers in the graph
 *
 * @example
 * ```typescript
 * const dependencies = new Map([
 *   ['A', ['B', 'C']],
 *   ['B', ['C']],
 *   ['C', ['A']], // Creates cycle: A→B→C→A
 * ]);
 *
 * const graph = new DependencyGraph(dependencies);
 * const result = graph.detectCycles();
 *
 * if (result.hasCycles) {
 *   console.log('Cycles found:', result.cycles);
 *   // Output: [['A', 'B', 'C', 'A']]
 * }
 * ```
 */
export class DependencyGraph<T> {
    private readonly dependencies: Map<T, T[]>;
    private readonly visited: Set<T>;
    private readonly recursionStack: Set<T>;
    private readonly currentPath: T[];
    private readonly detectedCycles: T[][];

    /**
     * Creates a new DependencyGraph instance.
     *
     * @param dependencies A map where keys are nodes and values are arrays of their dependencies.
     *                     An empty array or undefined indicates a node with no dependencies.
     */
    constructor(dependencies: Map<T, T[]>) {
        this.dependencies = dependencies;
        this.visited = new Set();
        this.recursionStack = new Set();
        this.currentPath = [];
        this.detectedCycles = [];
    }

    /**
     * Detects all cycles in the dependency graph.
     *
     * Uses depth-first search with path tracking to identify all strongly connected
     * components that form cycles. Each cycle is reported with the complete path
     * from the first repeated node back to itself.
     *
     * Time Complexity: O(V + E) where V = vertices, E = edges
     * Space Complexity: O(V) for the visited set and recursion stack
     *
     * @returns A CycleDetectionResult containing all detected cycles
     */
    detectCycles(): CycleDetectionResult<T> {
        // Reset state for a fresh analysis
        this.visited.clear();
        this.recursionStack.clear();
        this.currentPath.length = 0;
        this.detectedCycles.length = 0;

        // Perform DFS from each unvisited node
        for (const node of this.dependencies.keys()) {
            if (!this.visited.has(node)) {
                this.dfs(node);
            }
        }

        return {
            hasCycles: this.detectedCycles.length > 0,
            cycles: this.detectedCycles,
        };
    }

    /**
     * Performs depth-first search to detect cycles starting from the given node.
     *
     * The algorithm uses three key data structures:
     * 1. visited: Tracks all nodes that have been fully explored
     * 2. recursionStack: Tracks nodes in the current DFS path (detects back edges)
     * 3. currentPath: Maintains the actual path for cycle reconstruction
     *
     * @param node The starting node for DFS
     * @private
     */
    private dfs(node: T): void {
        // Mark node as visited and add to current recursion path
        this.visited.add(node);
        this.recursionStack.add(node);
        this.currentPath.push(node);

        // Get dependencies for this node (default to empty array if none)
        const deps = this.dependencies.get(node) ?? [];

        // Explore each dependency
        for (const dep of deps) {
            if (!this.visited.has(dep)) {
                // Unvisited node: continue DFS
                this.dfs(dep);
            } else if (this.recursionStack.has(dep)) {
                // Back edge detected: we found a cycle!
                this.recordCycle(dep);
            }
            // If visited but not in recursion stack: cross edge (safe, no cycle)
        }

        // Backtrack: remove node from recursion stack and path
        this.recursionStack.delete(node);
        this.currentPath.pop();
    }

    /**
     * Records a detected cycle by extracting the cycle path from the current DFS path.
     *
     * When a back edge is detected (pointing to a node already in the recursion stack),
     * we extract the cycle by finding where the target node appears in the current path
     * and taking all nodes from that point to the end.
     *
     * @param cycleStartNode The node that completes the cycle (where the back edge points)
     * @private
     */
    private recordCycle(cycleStartNode: T): void {
        // Find where the cycle starts in the current path
        const cycleStartIndex = this.currentPath.indexOf(cycleStartNode);

        if (cycleStartIndex === -1) {
            // This should never happen if the algorithm is correct
            return;
        }

        // Extract the cycle path and append the start node again to show the complete cycle
        const cycle = [
            ...this.currentPath.slice(cycleStartIndex),
            cycleStartNode,
        ];

        this.detectedCycles.push(cycle);
    }

    /**
     * Formats a cycle path as a human-readable string.
     *
     * Converts a cycle array into an arrow-separated string representation.
     * This is useful for error messages and logging.
     *
     * @param cycle The cycle path to format
     * @param formatter Optional function to convert node values to strings
     * @returns A formatted string like "A → B → C → A"
     *
     * @example
     * ```typescript
     * const cycle = [symbolA, symbolB, symbolC, symbolA];
     * const formatted = DependencyGraph.formatCycle(
     *   cycle,
     *   (sym) => sym.description ?? 'unknown'
     * );
     * console.log(formatted); // "A → B → C → A"
     * ```
     */
    static formatCycle<T>(cycle: T[], formatter?: (node: T) => string): string {
        const nodeFormatter = formatter ?? ((node: T) => String(node));
        return cycle.map(nodeFormatter).join(' → ');
    }
}
