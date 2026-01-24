/**
 * Comprehensive test suite for transaction race conditions and edge cases
 * Part 3/3 of ROADMAP Sub-Issue #12 (Propagation Mode Tests)
 * Issue #40: test(transactional): Race conditions and edge cases (100 tests)
 *
 * This test suite validates:
 * - Race Conditions (40 tests)
 * - Parallel Transaction Scenarios (30 tests)
 * - Error Handling Edge Cases (15 tests)
 * - Performance Stress Tests (15 tests)
 *
 * Addresses Issue #196: Transaction Already Finished Errors
 */

import { Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClsModule } from 'nestjs-cls';
import {
    ClsPluginTransactional,
    Propagation,
    Transactional,
    TransactionHost,
} from '../../src';
import {
    MockDbConnection,
    MockDbClient,
    TransactionAdapterMock,
} from '../transaction-adapter-mock';

// ============================================================================
// Test Services
// ============================================================================

@Injectable()
class RaceConditionService {
    constructor(
        private readonly txHost: TransactionHost<TransactionAdapterMock>,
    ) {}

    @Transactional()
    async parentCompletesBeforeChild(): Promise<{
        parentComplete: boolean;
        childPromise: Promise<void>;
    }> {
        await this.txHost.tx.query('Parent query');
        const childPromise = this.nonAwaitedChild();
        // Parent will complete before child starts
        return { parentComplete: true, childPromise };
    }

    @Transactional()
    async nonAwaitedChild(): Promise<void> {
        // Simulate async delay
        await new Promise((resolve) => setTimeout(resolve, 10));
        await this.txHost.tx.query('Child query');
    }

    @Transactional()
    async parentWithMultipleNonAwaitedChildren(): Promise<{
        childPromises: Promise<void>[];
    }> {
        await this.txHost.tx.query('Parent');
        const childPromises = [
            this.nonAwaitedChild1(),
            this.nonAwaitedChild2(),
            this.nonAwaitedChild3(),
        ];
        return { childPromises };
    }

    @Transactional()
    async nonAwaitedChild1(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 5));
        await this.txHost.tx.query('Child 1');
    }

    @Transactional()
    async nonAwaitedChild2(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 10));
        await this.txHost.tx.query('Child 2');
    }

    @Transactional()
    async nonAwaitedChild3(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 15));
        await this.txHost.tx.query('Child 3');
    }

    @Transactional()
    async siblingsRaceToComplete(delay1: number, delay2: number): Promise<void> {
        await this.txHost.tx.query('Parent');
        const siblings = [
            this.delayedChild(delay1, 'Sibling 1'),
            this.delayedChild(delay2, 'Sibling 2'),
        ];
        await Promise.all(siblings);
    }

    @Transactional()
    async delayedChild(delay: number, name: string): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, delay));
        await this.txHost.tx.query(name);
    }

    @Transactional()
    async tenConcurrentChildren(): Promise<void> {
        await this.txHost.tx.query('Parent with 10 children');
        const children = Array.from({ length: 10 }, (_, i) =>
            this.delayedChild(Math.random() * 20, `Child ${i + 1}`),
        );
        await Promise.all(children);
    }
}

@Injectable()
class ParallelTransactionService {
    constructor(
        private readonly txHost: TransactionHost<TransactionAdapterMock>,
    ) {}

    @Transactional()
    async independentTransaction(id: number): Promise<void> {
        await this.txHost.tx.query(`Transaction ${id}`);
    }

    @Transactional()
    async nestedTransactionTree(id: number, depth: number): Promise<void> {
        await this.txHost.tx.query(`Tree ${id} - Level ${depth}`);
        if (depth > 0) {
            await this.nestedTransactionTree(id, depth - 1);
        }
    }

    async runConcurrentIndependent(count: number): Promise<void> {
        const transactions = Array.from({ length: count }, (_, i) =>
            this.independentTransaction(i + 1),
        );
        await Promise.all(transactions);
    }

    async runConcurrentNested(count: number, depth: number): Promise<void> {
        const transactions = Array.from({ length: count }, (_, i) =>
            this.nestedTransactionTree(i + 1, depth),
        );
        await Promise.all(transactions);
    }
}

@Injectable()
class ErrorHandlingService {
    constructor(
        private readonly txHost: TransactionHost<TransactionAdapterMock>,
    ) {}

    @Transactional()
    async normalOperation(value: string): Promise<void> {
        await this.txHost.tx.query(value);
    }

    @Transactional()
    async operationThatThrows(value: string): Promise<void> {
        await this.txHost.tx.query(value);
        throw new Error('Intentional error');
    }

    @Transactional()
    async nestedWithError(parent: string, child: string): Promise<void> {
        await this.txHost.tx.query(parent);
        try {
            await this.operationThatThrows(child);
        } catch {
            // Recover from error
        }
        await this.txHost.tx.query('Recovery');
    }
}

@Injectable()
class PerformanceService {
    constructor(
        private readonly txHost: TransactionHost<TransactionAdapterMock>,
    ) {}

    @Transactional()
    async fastTransaction(id: number): Promise<void> {
        await this.txHost.tx.query(`Fast ${id}`);
    }

    async runThousandTransactions(): Promise<void> {
        const transactions = Array.from({ length: 1000 }, (_, i) =>
            this.fastTransaction(i + 1),
        );
        await Promise.all(transactions);
    }

    async deepNestedTransaction(depth: number): Promise<void> {
        if (depth === 0) return;
        await this.txHost.withTransaction(async () => {
            await this.txHost.tx.query(`Level ${depth}`);
            await this.deepNestedTransaction(depth - 1);
        });
    }

    async rapidSequentialTransactions(count: number): Promise<void> {
        for (let i = 0; i < count; i++) {
            await this.fastTransaction(i + 1);
        }
    }
}

// Mock adapter with failure simulation
class FailingTransactionAdapter extends TransactionAdapterMock {
    failOnStart = false;
    failOnCommit = false;
    failOnRollback = false;

    optionsFactory = (connection: MockDbConnection) => ({
        wrapWithTransaction: async (
            options: any,
            fn: (...args: any[]) => Promise<any>,
            setTxInstance: (client?: MockDbClient) => void,
        ) => {
            if (this.failOnStart) {
                throw new Error('Failed to start transaction');
            }

            const client = connection.getClient();
            setTxInstance(client);
            await client.begin(options);
            try {
                const result = await fn();
                if (this.failOnCommit) {
                    throw new Error('Failed to commit transaction');
                }
                await client.commit();
                return result;
            } catch (e) {
                if (this.failOnRollback) {
                    throw new Error('Failed to rollback transaction');
                }
                await client.rollback();
                throw e;
            }
        },
        wrapWithNestedTransaction: async (
            _options: any,
            fn: (...args: any[]) => Promise<any>,
            setTxInstance: (client?: MockDbClient) => void,
            tx: MockDbClient,
        ) => {
            setTxInstance(tx);
            try {
                await tx.query('SAVEPOINT nested_transaction;');
                const result = await fn();
                await tx.query('RELEASE SAVEPOINT nested_transaction;');
                return result;
            } catch (e) {
                await tx.query('ROLLBACK TO SAVEPOINT nested_transaction;');
                throw e;
            }
        },
        getFallbackInstance: () => {
            return connection.getClient();
        },
    });
}

// ============================================================================
// Module Setup
// ============================================================================

@Module({
    providers: [MockDbConnection],
    exports: [MockDbConnection],
})
class DbConnectionModule {}

@Module({
    imports: [
        ClsModule.forRoot({
            plugins: [
                new ClsPluginTransactional({
                    imports: [DbConnectionModule],
                    adapter: new TransactionAdapterMock({
                        connectionToken: MockDbConnection,
                    }),
                }),
            ],
        }),
    ],
    providers: [
        RaceConditionService,
        ParallelTransactionService,
        ErrorHandlingService,
        PerformanceService,
    ],
})
class TestModule {}

// ============================================================================
// Test Suite
// ============================================================================

describe('Race Conditions and Edge Cases - Comprehensive Test Suite (100 tests)', () => {
    let module: TestingModule;
    let txHost: TransactionHost<TransactionAdapterMock>;
    let mockDbConnection: MockDbConnection;
    let raceService: RaceConditionService;
    let parallelService: ParallelTransactionService;
    let errorService: ErrorHandlingService;
    let perfService: PerformanceService;

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [TestModule],
        }).compile();
        await module.init();

        txHost = module.get(TransactionHost);
        mockDbConnection = module.get(MockDbConnection);
        raceService = module.get(RaceConditionService);
        parallelService = module.get(ParallelTransactionService);
        errorService = module.get(ErrorHandlingService);
        perfService = module.get(PerformanceService);
    });

    afterEach(async () => {
        await module.close();
    });

    // ========================================================================
    // Section 1: Race Conditions (40 tests)
    // ========================================================================

    describe('Section 1: Race Conditions (40 tests)', () => {
        describe('Parent complete before child starts', () => {
            it('1.1: should handle parent completing before non-awaited child starts (Issue #196)', async () => {
                const { childPromise } =
                    await raceService.parentCompletesBeforeChild();

                // Parent should complete successfully
                const queriesBeforeChild =
                    mockDbConnection.getClientsQueries();
                expect(queriesBeforeChild.length).toBeGreaterThanOrEqual(1);

                // Child should also complete successfully without "Transaction already finished" error
                await expect(childPromise).resolves.not.toThrow();
            });

            it('1.2: should create isolated contexts for parent and child', async () => {
                const { childPromise } =
                    await raceService.parentCompletesBeforeChild();
                await childPromise;

                const queries = mockDbConnection.getClientsQueries();
                // Parent and child should have separate transactions
                expect(queries.length).toBeGreaterThanOrEqual(2);
            });

            it('1.3: should maintain transaction integrity when parent commits first', async () => {
                const { childPromise } =
                    await raceService.parentCompletesBeforeChild();
                await childPromise;

                const queries = mockDbConnection.getClientsQueries();
                queries.forEach((q) => {
                    expect(q[0]).toBe('BEGIN TRANSACTION;');
                    expect(q[q.length - 1]).toMatch(
                        /^(COMMIT|ROLLBACK) TRANSACTION;$/,
                    );
                });
            });

            it('1.4: should handle parent commit before multiple children start', async () => {
                const { childPromises } =
                    await raceService.parentWithMultipleNonAwaitedChildren();

                // All children should complete successfully
                await expect(Promise.all(childPromises)).resolves.not.toThrow();
            });

            it('1.5: should create separate transaction for each non-awaited child', async () => {
                const { childPromises } =
                    await raceService.parentWithMultipleNonAwaitedChildren();
                await Promise.all(childPromises);

                const queries = mockDbConnection.getClientsQueries();
                // 1 parent + 3 children = 4 transactions
                expect(queries.length).toBeGreaterThanOrEqual(4);
            });

            it('1.6: should handle rapid succession of parent completions', async () => {
                const results = await Promise.all([
                    raceService.parentCompletesBeforeChild(),
                    raceService.parentCompletesBeforeChild(),
                    raceService.parentCompletesBeforeChild(),
                ]);

                const allChildPromises = results.map((r) => r.childPromise);
                await expect(
                    Promise.all(allChildPromises),
                ).resolves.not.toThrow();
            });

            it('1.7: should maintain isolation across rapid parent completions', async () => {
                const results = await Promise.all(
                    Array.from({ length: 5 }, () =>
                        raceService.parentCompletesBeforeChild(),
                    ),
                );

                const allChildPromises = results.map((r) => r.childPromise);
                await Promise.all(allChildPromises);

                const queries = mockDbConnection.getClientsQueries();
                // 5 parents + 5 children = 10 transactions
                expect(queries.length).toBeGreaterThanOrEqual(10);
            });

            it('1.8: should handle parent with delayed child (50ms delay)', async () => {
                const childPromise = raceService.delayedChild(50, 'Delayed');
                await new Promise((resolve) => setTimeout(resolve, 10));
                // Parent context is gone, but child should still work
                await expect(childPromise).resolves.not.toThrow();
            });

            it('1.9: should handle parent with very delayed child (100ms delay)', async () => {
                const childPromise = raceService.delayedChild(100, 'Very Delayed');
                await new Promise((resolve) => setTimeout(resolve, 10));
                await expect(childPromise).resolves.not.toThrow();
            });

            it('1.10: should not leak transaction state across parent completions', async () => {
                await raceService.parentCompletesBeforeChild();
                const initialCount = mockDbConnection.getClientsQueries().length;

                await raceService.parentCompletesBeforeChild();
                const finalCount = mockDbConnection.getClientsQueries().length;

                // Should have created new independent transactions
                expect(finalCount).toBeGreaterThan(initialCount);
            });
        });

        describe('Parent complete while child active', () => {
            it('1.11: should handle parent completing while child is executing', async () => {
                let childStarted = false;
                let parentCompleted = false;

                const childPromise = txHost.withTransaction(async () => {
                    childStarted = true;
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    expect(parentCompleted).toBe(true); // Parent completed first
                    await txHost.tx.query('Child query');
                });

                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Parent query');
                    childPromise; // Start child but don't await
                });

                parentCompleted = true;
                await childPromise;

                expect(childStarted).toBe(true);
            });

            it('1.12: should maintain child transaction when parent commits', async () => {
                const childPromise = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 30));
                    await txHost.tx.query('Active child');
                });

                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Parent');
                });

                await childPromise;

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(2);
            });

            it('1.13: should handle multiple children active when parent completes', async () => {
                const child1 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 40));
                    await txHost.tx.query('Child 1');
                });

                const child2 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    await txHost.tx.query('Child 2');
                });

                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Parent');
                });

                await Promise.all([child1, child2]);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(3);
            });

            it('1.14: should handle child throwing error after parent completes', async () => {
                const childPromise = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 20));
                    throw new Error('Child error');
                });

                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Parent');
                });

                await expect(childPromise).rejects.toThrow('Child error');
            });

            it('1.15: should rollback only child when child throws after parent commits', async () => {
                let parentCompleted = false;

                const childPromise = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 30));
                    expect(parentCompleted).toBe(true); // Parent already committed
                    await txHost.tx.query('Child before error');
                    throw new Error('Child error');
                });

                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Parent');
                    await new Promise((resolve) => setTimeout(resolve, 10));
                });

                parentCompleted = true;

                await expect(childPromise).rejects.toThrow('Child error');

                const queries = mockDbConnection.getClientsQueries();

                // Find parent and child transactions
                const parentTx = queries.find(q => q.includes('Parent'));
                const childTx = queries.find(q => q.includes('Child before error'));

                expect(parentTx?.[parentTx.length - 1]).toBe('COMMIT TRANSACTION;');
                expect(childTx?.[childTx.length - 1]).toBe('ROLLBACK TRANSACTION;');
            });

            it('1.16: should handle parent completing while 5 children active', async () => {
                const children = Array.from({ length: 5 }, (_, i) =>
                    txHost.withTransaction(async () => {
                        await new Promise((resolve) =>
                            setTimeout(resolve, (i + 1) * 10),
                        );
                        await txHost.tx.query(`Child ${i + 1}`);
                    }),
                );

                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Parent');
                });

                await Promise.all(children);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(6);
            });

            it('1.17: should handle parent completing while 10 children active', async () => {
                const children = Array.from({ length: 10 }, (_, i) =>
                    txHost.withTransaction(async () => {
                        await new Promise((resolve) =>
                            setTimeout(resolve, Math.random() * 30),
                        );
                        await txHost.tx.query(`Child ${i + 1}`);
                    }),
                );

                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Parent with 10 active children');
                });

                await Promise.all(children);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(11);
            });

            it('1.18: should maintain transaction isolation with staggered completions', async () => {
                const child1 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    await txHost.tx.query('Fast child');
                });

                const child2 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    await txHost.tx.query('Slow child');
                });

                await txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 20));
                    await txHost.tx.query('Parent');
                });

                await Promise.all([child1, child2]);

                const queries = mockDbConnection.getClientsQueries();
                queries.forEach((q) => {
                    expect(q[0]).toBe('BEGIN TRANSACTION;');
                });
            });

            it('1.19: should handle child committing before parent', async () => {
                let childCommitted = false;

                const childPromise = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 5));
                    await txHost.tx.query('Fast child');
                    childCommitted = true;
                });

                await txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 30));
                    await txHost.tx.query('Slow parent');
                    expect(childCommitted).toBe(true);
                });

                await childPromise;
            });

            it('1.20: should handle interleaved child and parent completions', async () => {
                const child1 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    await txHost.tx.query('Child 1');
                });

                const parentPromise = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 25));
                    await txHost.tx.query('Parent');
                });

                const child2 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 40));
                    await txHost.tx.query('Child 2');
                });

                await Promise.all([child1, parentPromise, child2]);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(3);
            });
        });

        describe('Concurrent children racing to complete', () => {
            it('1.21: should handle 2 siblings racing to complete', async () => {
                await raceService.siblingsRaceToComplete(10, 15);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(3); // parent + 2 siblings
            });

            it('1.22: should handle 2 siblings with equal timing', async () => {
                await raceService.siblingsRaceToComplete(10, 10);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(3);
            });

            it('1.23: should handle 2 siblings with reverse timing', async () => {
                await raceService.siblingsRaceToComplete(20, 5);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(3);
            });

            it('1.24: should handle 10 siblings racing concurrently', async () => {
                await raceService.tenConcurrentChildren();

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(11); // parent + 10 children
            });

            it('1.25: should maintain isolation across racing siblings', async () => {
                await raceService.tenConcurrentChildren();

                const queries = mockDbConnection.getClientsQueries();
                queries.forEach((q) => {
                    expect(q[0]).toBe('BEGIN TRANSACTION;');
                    expect(q[q.length - 1]).toMatch(
                        /^(COMMIT|ROLLBACK) TRANSACTION;$/,
                    );
                });
            });

            it('1.26: should handle siblings completing in random order', async () => {
                const promises = Array.from({ length: 5 }, (_, i) =>
                    raceService.siblingsRaceToComplete(
                        Math.random() * 20,
                        Math.random() * 20,
                    ),
                );

                await Promise.all(promises);

                const queries = mockDbConnection.getClientsQueries();
                // 5 iterations × 3 transactions each = 15 total
                expect(queries.length).toBeGreaterThanOrEqual(15);
            });

            it('1.27: should handle siblings where first throws error', async () => {
                const sibling1 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 5));
                    throw new Error('Sibling 1 error');
                });

                const sibling2 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    await txHost.tx.query('Sibling 2 success');
                });

                await expect(sibling1).rejects.toThrow('Sibling 1 error');
                await expect(sibling2).resolves.not.toThrow();
            });

            it('1.28: should handle siblings where second throws error', async () => {
                const sibling1 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 5));
                    await txHost.tx.query('Sibling 1 success');
                });

                const sibling2 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    throw new Error('Sibling 2 error');
                });

                await expect(sibling1).resolves.not.toThrow();
                await expect(sibling2).rejects.toThrow('Sibling 2 error');
            });

            it('1.29: should handle siblings where both throw errors', async () => {
                const sibling1 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 5));
                    throw new Error('Sibling 1 error');
                });

                const sibling2 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    throw new Error('Sibling 2 error');
                });

                await expect(sibling1).rejects.toThrow('Sibling 1 error');
                await expect(sibling2).rejects.toThrow('Sibling 2 error');
            });

            it('1.30: should handle 20 siblings racing with mixed outcomes', async () => {
                const siblings = Array.from({ length: 20 }, (_, i) =>
                    txHost.withTransaction(async () => {
                        await new Promise((resolve) =>
                            setTimeout(resolve, Math.random() * 30),
                        );
                        if (i % 5 === 0) {
                            throw new Error(`Sibling ${i + 1} error`);
                        }
                        await txHost.tx.query(`Sibling ${i + 1}`);
                    }),
                );

                const results = await Promise.allSettled(siblings);

                const successful = results.filter(
                    (r) => r.status === 'fulfilled',
                ).length;
                const failed = results.filter((r) => r.status === 'rejected')
                    .length;

                expect(successful).toBe(16); // 20 - 4 errors
                expect(failed).toBe(4); // Every 5th sibling
            });
        });

        describe('Complex race scenarios', () => {
            it('1.31: should handle grandparent → parent → child race', async () => {
                const childPromise = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 40));
                    await txHost.tx.query('Grandchild');
                });

                const parentPromise = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 25));
                    await txHost.tx.query('Parent');
                });

                await txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    await txHost.tx.query('Grandparent');
                });

                await Promise.all([parentPromise, childPromise]);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(3);
            });

            it('1.32: should handle diamond pattern race (A → B/C → D)', async () => {
                const d = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    await txHost.tx.query('D');
                });

                const b = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 30));
                    await txHost.tx.query('B');
                });

                const c = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 35));
                    await txHost.tx.query('C');
                });

                await txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    await txHost.tx.query('A');
                });

                await Promise.all([b, c, d]);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(4);
            });

            it('1.33: should handle tree structure race (A → B,C,D)', async () => {
                const children = ['B', 'C', 'D'].map((name) =>
                    txHost.withTransaction(async () => {
                        await new Promise((resolve) =>
                            setTimeout(resolve, Math.random() * 30),
                        );
                        await txHost.tx.query(name);
                    }),
                );

                await txHost.withTransaction(async () => {
                    await txHost.tx.query('A');
                });

                await Promise.all(children);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(4);
            });

            it('1.34: should handle wide tree race (A → 15 children)', async () => {
                const children = Array.from({ length: 15 }, (_, i) =>
                    txHost.withTransaction(async () => {
                        await new Promise((resolve) =>
                            setTimeout(resolve, Math.random() * 20),
                        );
                        await txHost.tx.query(`Child ${i + 1}`);
                    }),
                );

                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Root');
                });

                await Promise.all(children);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(16);
            });

            it('1.35: should handle chain race (A → B → C → D → E)', async () => {
                const e = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    await txHost.tx.query('E');
                });

                const d = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 40));
                    await txHost.tx.query('D');
                    await e;
                });

                const c = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 30));
                    await txHost.tx.query('C');
                    await d;
                });

                const b = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 20));
                    await txHost.tx.query('B');
                    await c;
                });

                await txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    await txHost.tx.query('A');
                    await b;
                });

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(5);
            });

            it('1.36: should handle mesh pattern (multiple overlapping races)', async () => {
                const tx1 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 15));
                    await txHost.tx.query('TX1');
                });

                const tx2 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 25));
                    await txHost.tx.query('TX2');
                });

                const tx3 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    await txHost.tx.query('TX3');
                });

                const tx4 = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 30));
                    await txHost.tx.query('TX4');
                });

                await Promise.all([tx1, tx2, tx3, tx4]);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(4);
            });

            it('1.37: should handle recursive fan-out pattern', async () => {
                const createFanOut = async (
                    depth: number,
                    width: number,
                ): Promise<void> => {
                    if (depth === 0) return;
                    const children = Array.from({ length: width }, () =>
                        txHost.withTransaction(async () => {
                            await txHost.tx.query(`Depth ${depth}`);
                            await createFanOut(depth - 1, width);
                        }),
                    );
                    await Promise.all(children);
                };

                await createFanOut(3, 2);

                const queries = mockDbConnection.getClientsQueries();
                // 2^3 = 8 leaf nodes minimum
                expect(queries.length).toBeGreaterThanOrEqual(8);
            });

            it('1.38: should handle alternating timing pattern', async () => {
                const transactions = Array.from({ length: 10 }, (_, i) =>
                    txHost.withTransaction(async () => {
                        await new Promise((resolve) =>
                            setTimeout(resolve, i % 2 === 0 ? 5 : 25),
                        );
                        await txHost.tx.query(`TX ${i + 1}`);
                    }),
                );

                await Promise.all(transactions);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(10);
            });

            it('1.39: should handle burst pattern (rapid succession then pause)', async () => {
                // First burst
                const burst1 = Array.from({ length: 5 }, (_, i) =>
                    txHost.withTransaction(async () => {
                        await txHost.tx.query(`Burst1-${i + 1}`);
                    }),
                );

                await Promise.all(burst1);

                // Pause
                await new Promise((resolve) => setTimeout(resolve, 20));

                // Second burst
                const burst2 = Array.from({ length: 5 }, (_, i) =>
                    txHost.withTransaction(async () => {
                        await txHost.tx.query(`Burst2-${i + 1}`);
                    }),
                );

                await Promise.all(burst2);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(10);
            });

            it('1.40: should handle avalanche pattern (exponential growth)', async () => {
                const wave1 = txHost.withTransaction(async () => {
                    await txHost.tx.query('Wave 1');
                });

                const wave2 = Promise.all([
                    txHost.withTransaction(async () => {
                        await txHost.tx.query('Wave 2-1');
                    }),
                    txHost.withTransaction(async () => {
                        await txHost.tx.query('Wave 2-2');
                    }),
                ]);

                const wave3 = Promise.all([
                    txHost.withTransaction(async () => {
                        await txHost.tx.query('Wave 3-1');
                    }),
                    txHost.withTransaction(async () => {
                        await txHost.tx.query('Wave 3-2');
                    }),
                    txHost.withTransaction(async () => {
                        await txHost.tx.query('Wave 3-3');
                    }),
                    txHost.withTransaction(async () => {
                        await txHost.tx.query('Wave 3-4');
                    }),
                ]);

                await Promise.all([wave1, wave2, wave3]);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(7); // 1 + 2 + 4
            });
        });
    });

    // ========================================================================
    // Section 2: Parallel Transaction Scenarios (30 tests)
    // ========================================================================

    describe('Section 2: Parallel Transaction Scenarios (30 tests)', () => {
        describe('Concurrent independent transactions', () => {
            it('2.1: should handle 10 concurrent independent transactions', async () => {
                await parallelService.runConcurrentIndependent(10);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(10);
            });

            it('2.2: should handle 25 concurrent independent transactions', async () => {
                await parallelService.runConcurrentIndependent(25);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(25);
            });

            it('2.3: should handle 50 concurrent independent transactions', async () => {
                await parallelService.runConcurrentIndependent(50);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(50);
            });

            it('2.4: should handle 100 concurrent independent transactions', async () => {
                await parallelService.runConcurrentIndependent(100);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(100);
            });

            it('2.5: should commit all 100 concurrent transactions successfully', async () => {
                await parallelService.runConcurrentIndependent(100);

                const queries = mockDbConnection.getClientsQueries();
                queries.forEach((q) => {
                    expect(q[q.length - 1]).toBe('COMMIT TRANSACTION;');
                });
            });

            it('2.6: should maintain transaction integrity in 100 concurrent scenarios', async () => {
                await parallelService.runConcurrentIndependent(100);

                const queries = mockDbConnection.getClientsQueries();
                queries.forEach((q, index) => {
                    expect(q).toEqual([
                        'BEGIN TRANSACTION;',
                        `Transaction ${index + 1}`,
                        'COMMIT TRANSACTION;',
                    ]);
                });
            });

            it('2.7: should handle 200 concurrent independent transactions', async () => {
                await parallelService.runConcurrentIndependent(200);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(200);
            });

            it('2.8: should handle repeated 100-transaction bursts', async () => {
                await parallelService.runConcurrentIndependent(100);
                const firstCount = mockDbConnection.getClientsQueries().length;

                mockDbConnection.clients = []; // Reset

                await parallelService.runConcurrentIndependent(100);
                const secondCount = mockDbConnection.getClientsQueries().length;

                expect(firstCount).toBe(100);
                expect(secondCount).toBe(100);
            });

            it('2.9: should handle back-to-back 50-transaction runs', async () => {
                await parallelService.runConcurrentIndependent(50);
                await parallelService.runConcurrentIndependent(50);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(100);
            });

            it('2.10: should handle concurrent runs of concurrent transactions', async () => {
                await Promise.all([
                    parallelService.runConcurrentIndependent(25),
                    parallelService.runConcurrentIndependent(25),
                    parallelService.runConcurrentIndependent(25),
                    parallelService.runConcurrentIndependent(25),
                ]);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(100);
            });
        });

        describe('Concurrent nested transaction trees', () => {
            it('2.11: should handle 10 concurrent nested trees (depth 2)', async () => {
                await parallelService.runConcurrentNested(10, 2);

                const queries = mockDbConnection.getClientsQueries();
                // 10 trees × 3 transactions each = 30 total
                expect(queries.length).toBe(30);
            });

            it('2.12: should handle 25 concurrent nested trees (depth 2)', async () => {
                await parallelService.runConcurrentNested(25, 2);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(75); // 25 × 3
            });

            it('2.13: should handle 50 concurrent nested trees (depth 2)', async () => {
                await parallelService.runConcurrentNested(50, 2);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(150); // 50 × 3
            });

            it('2.14: should handle 100 concurrent nested trees (depth 2)', async () => {
                await parallelService.runConcurrentNested(100, 2);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(300); // 100 × 3
            });

            it('2.15: should handle 50 concurrent nested trees (depth 3)', async () => {
                await parallelService.runConcurrentNested(50, 3);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(200); // 50 × 4
            });

            it('2.16: should handle 25 concurrent nested trees (depth 4)', async () => {
                await parallelService.runConcurrentNested(25, 4);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(125); // 25 × 5
            });

            it('2.17: should handle 100 concurrent nested trees (depth 1)', async () => {
                await parallelService.runConcurrentNested(100, 1);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(200); // 100 × 2
            });

            it('2.18: should commit all nested transactions in 100 concurrent trees', async () => {
                await parallelService.runConcurrentNested(100, 2);

                const queries = mockDbConnection.getClientsQueries();
                queries.forEach((q) => {
                    expect(q[q.length - 1]).toBe('COMMIT TRANSACTION;');
                });
            });

            it('2.19: should maintain tree structure in concurrent nested scenarios', async () => {
                await parallelService.runConcurrentNested(10, 2);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(30);

                // Verify each tree has 3 transactions
                for (let i = 0; i < 10; i++) {
                    const treeQueries = queries.slice(i * 3, (i + 1) * 3);
                    expect(treeQueries.length).toBe(3);
                    treeQueries.forEach((q) => {
                        expect(q[0]).toBe('BEGIN TRANSACTION;');
                    });
                }
            });

            it('2.20: should handle mixed depth concurrent trees', async () => {
                await Promise.all([
                    parallelService.runConcurrentNested(10, 1),
                    parallelService.runConcurrentNested(10, 2),
                    parallelService.runConcurrentNested(10, 3),
                ]);

                const queries = mockDbConnection.getClientsQueries();
                // (10 × 2) + (10 × 3) + (10 × 4) = 20 + 30 + 40 = 90
                expect(queries.length).toBe(90);
            });
        });

        describe('Concurrent transaction patterns', () => {
            it('2.21: should handle alternating independent and nested', async () => {
                await Promise.all([
                    parallelService.runConcurrentIndependent(25),
                    parallelService.runConcurrentNested(25, 1),
                ]);

                const queries = mockDbConnection.getClientsQueries();
                // 25 independent + (25 × 2 nested) = 25 + 50 = 75
                expect(queries.length).toBe(75);
            });

            it('2.22: should handle wave pattern (sequential bursts)', async () => {
                await parallelService.runConcurrentIndependent(20);
                await parallelService.runConcurrentIndependent(30);
                await parallelService.runConcurrentIndependent(50);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(100);
            });

            it('2.23: should handle pyramid pattern (increasing concurrency)', async () => {
                await parallelService.runConcurrentIndependent(10);
                await parallelService.runConcurrentIndependent(20);
                await parallelService.runConcurrentIndependent(30);
                await parallelService.runConcurrentIndependent(40);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(100);
            });

            it('2.24: should handle inverted pyramid (decreasing concurrency)', async () => {
                await parallelService.runConcurrentIndependent(40);
                await parallelService.runConcurrentIndependent(30);
                await parallelService.runConcurrentIndependent(20);
                await parallelService.runConcurrentIndependent(10);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(100);
            });

            it('2.25: should handle diamond pattern concurrency', async () => {
                await parallelService.runConcurrentIndependent(10);
                await parallelService.runConcurrentIndependent(30);
                await parallelService.runConcurrentIndependent(50);
                await parallelService.runConcurrentIndependent(30);
                await parallelService.runConcurrentIndependent(10);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(130);
            });

            it('2.26: should handle concurrent mixed operations', async () => {
                await Promise.all([
                    parallelService.runConcurrentIndependent(20),
                    parallelService.runConcurrentNested(15, 2),
                    parallelService.runConcurrentIndependent(15),
                    parallelService.runConcurrentNested(10, 1),
                ]);

                const queries = mockDbConnection.getClientsQueries();
                // 20 + (15 × 3) + 15 + (10 × 2) = 20 + 45 + 15 + 20 = 100
                expect(queries.length).toBe(100);
            });

            it('2.27: should handle repeated concurrent patterns', async () => {
                for (let i = 0; i < 5; i++) {
                    await parallelService.runConcurrentIndependent(20);
                }

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(100);
            });

            it('2.28: should handle nested concurrent pattern calls', async () => {
                await Promise.all([
                    Promise.all([
                        parallelService.runConcurrentIndependent(10),
                        parallelService.runConcurrentIndependent(10),
                    ]),
                    Promise.all([
                        parallelService.runConcurrentIndependent(10),
                        parallelService.runConcurrentIndependent(10),
                    ]),
                ]);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(40);
            });

            it('2.29: should handle staggered concurrent starts', async () => {
                const p1 = parallelService.runConcurrentIndependent(25);
                await new Promise((resolve) => setTimeout(resolve, 5));

                const p2 = parallelService.runConcurrentIndependent(25);
                await new Promise((resolve) => setTimeout(resolve, 5));

                const p3 = parallelService.runConcurrentIndependent(25);
                await new Promise((resolve) => setTimeout(resolve, 5));

                const p4 = parallelService.runConcurrentIndependent(25);

                await Promise.all([p1, p2, p3, p4]);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(100);
            });

            it('2.30: should handle maximum concurrency stress (500 transactions)', async () => {
                await parallelService.runConcurrentIndependent(500);

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(500);
                queries.forEach((q) => {
                    expect(q[0]).toBe('BEGIN TRANSACTION;');
                    expect(q[q.length - 1]).toBe('COMMIT TRANSACTION;');
                });
            }, 30000); // Increased timeout for heavy load
        });
    });

    // ========================================================================
    // Section 3: Error Handling Edge Cases (15 tests)
    // ========================================================================

    describe('Section 3: Error Handling Edge Cases (15 tests)', () => {
        describe('Adapter failure scenarios', () => {
            it('3.1: should handle startTransaction failure', async () => {
                // Create failing adapter
                const failingAdapter = new FailingTransactionAdapter({
                    connectionToken: MockDbConnection,
                });
                failingAdapter.failOnStart = true;

                const failingModule = await Test.createTestingModule({
                    imports: [
                        ClsModule.forRoot({
                            plugins: [
                                new ClsPluginTransactional({
                                    imports: [DbConnectionModule],
                                    adapter: failingAdapter,
                                }),
                            ],
                        }),
                    ],
                    providers: [ErrorHandlingService],
                }).compile();

                await failingModule.init();
                const failingService = failingModule.get(ErrorHandlingService);

                await expect(
                    failingService.normalOperation('Test'),
                ).rejects.toThrow('Failed to start transaction');

                await failingModule.close();
            });

            it('3.2: should handle commitTransaction failure', async () => {
                const failingAdapter = new FailingTransactionAdapter({
                    connectionToken: MockDbConnection,
                });
                failingAdapter.failOnCommit = true;

                const failingModule = await Test.createTestingModule({
                    imports: [
                        ClsModule.forRoot({
                            plugins: [
                                new ClsPluginTransactional({
                                    imports: [DbConnectionModule],
                                    adapter: failingAdapter,
                                }),
                            ],
                        }),
                    ],
                    providers: [ErrorHandlingService],
                }).compile();

                await failingModule.init();
                const failingService = failingModule.get(ErrorHandlingService);

                await expect(
                    failingService.normalOperation('Test'),
                ).rejects.toThrow('Failed to commit transaction');

                await failingModule.close();
            });

            it('3.3: should handle rollbackTransaction failure', async () => {
                const failingAdapter = new FailingTransactionAdapter({
                    connectionToken: MockDbConnection,
                });
                failingAdapter.failOnRollback = true;

                const failingModule = await Test.createTestingModule({
                    imports: [
                        ClsModule.forRoot({
                            plugins: [
                                new ClsPluginTransactional({
                                    imports: [DbConnectionModule],
                                    adapter: failingAdapter,
                                }),
                            ],
                        }),
                    ],
                    providers: [ErrorHandlingService],
                }).compile();

                await failingModule.init();
                const failingService = failingModule.get(ErrorHandlingService);

                await expect(
                    failingService.operationThatThrows('Test'),
                ).rejects.toThrow('Failed to rollback transaction');

                await failingModule.close();
            });

            it('3.4: should maintain isolation when adapter fails', async () => {
                const failingAdapter = new FailingTransactionAdapter({
                    connectionToken: MockDbConnection,
                });
                failingAdapter.failOnStart = true;

                const failingModule = await Test.createTestingModule({
                    imports: [
                        ClsModule.forRoot({
                            plugins: [
                                new ClsPluginTransactional({
                                    imports: [DbConnectionModule],
                                    adapter: failingAdapter,
                                }),
                            ],
                        }),
                    ],
                    providers: [ErrorHandlingService],
                }).compile();

                await failingModule.init();
                const failingService = failingModule.get(ErrorHandlingService);

                // Multiple failures should be isolated
                await expect(
                    failingService.normalOperation('Test 1'),
                ).rejects.toThrow();
                await expect(
                    failingService.normalOperation('Test 2'),
                ).rejects.toThrow();

                await failingModule.close();
            });

            it('3.5: should handle adapter failure in nested transaction', async () => {
                const failingAdapter = new FailingTransactionAdapter({
                    connectionToken: MockDbConnection,
                });
                failingAdapter.failOnCommit = true;

                const failingModule = await Test.createTestingModule({
                    imports: [
                        ClsModule.forRoot({
                            plugins: [
                                new ClsPluginTransactional({
                                    imports: [DbConnectionModule],
                                    adapter: failingAdapter,
                                }),
                            ],
                        }),
                    ],
                    providers: [ErrorHandlingService],
                }).compile();

                await failingModule.init();
                const failingService = failingModule.get(ErrorHandlingService);

                await expect(
                    failingService.nestedWithError('Parent', 'Child'),
                ).rejects.toThrow();

                await failingModule.close();
            });
        });

        describe('Application error scenarios', () => {
            it('3.6: should rollback on application error', async () => {
                await expect(
                    errorService.operationThatThrows('Query before error'),
                ).rejects.toThrow('Intentional error');

                const queries = mockDbConnection.getClientsQueries();
                expect(queries[0][queries[0].length - 1]).toBe(
                    'ROLLBACK TRANSACTION;',
                );
            });

            it('3.7: should handle error in nested transaction with recovery', async () => {
                await errorService.nestedWithError('Parent', 'Child');

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThanOrEqual(2);
                expect(queries[0]).toContain('Parent');
                expect(queries[0]).toContain('Recovery');
            });

            it('3.8: should maintain parent transaction when child errors', async () => {
                await errorService.nestedWithError('Parent', 'Child');

                const queries = mockDbConnection.getClientsQueries();
                const parentTx = queries[0];
                expect(parentTx[parentTx.length - 1]).toBe('COMMIT TRANSACTION;');
            });

            it('3.9: should rollback child when child throws error', async () => {
                await errorService.nestedWithError('Parent', 'Child');

                const queries = mockDbConnection.getClientsQueries();
                const childTx = queries.find((q) => q.includes('Child'));
                expect(childTx?.[childTx.length - 1]).toBe(
                    'ROLLBACK TRANSACTION;',
                );
            });

            it('3.10: should handle concurrent errors without state pollution', async () => {
                const errors = await Promise.allSettled([
                    errorService.operationThatThrows('Error 1'),
                    errorService.operationThatThrows('Error 2'),
                    errorService.operationThatThrows('Error 3'),
                ]);

                expect(errors.every((e) => e.status === 'rejected')).toBe(true);

                const queries = mockDbConnection.getClientsQueries();
                queries.forEach((q) => {
                    expect(q[q.length - 1]).toBe('ROLLBACK TRANSACTION;');
                });
            });
        });

        describe('Edge case error handling', () => {
            it('3.11: should handle error after successful nested completion', async () => {
                await expect(
                    txHost.withTransaction(async () => {
                        await txHost.tx.query('Parent start');

                        // Nested completes successfully
                        await txHost.withTransaction(async () => {
                            await txHost.tx.query('Nested success');
                        });

                        // Parent throws after nested completes
                        throw new Error('Parent error after nested');
                    }),
                ).rejects.toThrow('Parent error after nested');

                const queries = mockDbConnection.getClientsQueries();
                const parentTx = queries[0];
                expect(parentTx[parentTx.length - 1]).toBe(
                    'ROLLBACK TRANSACTION;',
                );
            }, 10000);

            it('3.12: should handle error in one sibling without affecting others', async () => {
                const sibling1 = errorService
                    .operationThatThrows('Sibling 1')
                    .catch(() => 'error');
                const sibling2 = errorService.normalOperation('Sibling 2');
                const sibling3 = errorService.normalOperation('Sibling 3');

                const results = await Promise.all([
                    sibling1,
                    sibling2,
                    sibling3,
                ]);

                expect(results[0]).toBe('error');

                const queries = mockDbConnection.getClientsQueries();
                const successfulTxs = queries.filter(
                    (q) => q[q.length - 1] === 'COMMIT TRANSACTION;',
                );
                expect(successfulTxs.length).toBeGreaterThanOrEqual(2);
            });

            it('3.13: should handle timeout-like scenarios (very slow operation)', async () => {
                const slowOperation = txHost.withTransaction(async () => {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    await txHost.tx.query('Slow query');
                });

                await expect(slowOperation).resolves.not.toThrow();

                const queries = mockDbConnection.getClientsQueries();
                expect(queries[0][queries[0].length - 1]).toBe(
                    'COMMIT TRANSACTION;',
                );
            }, 10000);

            it('3.14: should handle cascading errors in nested hierarchy', async () => {
                await expect(
                    txHost.withTransaction(async () => {
                        await txHost.tx.query('Level 1');
                        await txHost.withTransaction(async () => {
                            await txHost.tx.query('Level 2');
                            await txHost.withTransaction(async () => {
                                await txHost.tx.query('Level 3');
                                throw new Error('Error at level 3');
                            });
                        });
                    }),
                ).rejects.toThrow('Error at level 3');

                const queries = mockDbConnection.getClientsQueries();
                queries.forEach((q) => {
                    expect(q[q.length - 1]).toBe('ROLLBACK TRANSACTION;');
                });
            });

            it('3.15: should handle error during transaction cleanup', async () => {
                // This tests resilience when errors occur during transaction teardown
                await expect(
                    txHost.withTransaction(async () => {
                        await txHost.tx.query('Query');
                        throw new Error('Error during transaction');
                    }),
                ).rejects.toThrow('Error during transaction');

                // Should still be able to start new transactions
                await expect(
                    txHost.withTransaction(async () => {
                        await txHost.tx.query('New transaction after error');
                    }),
                ).resolves.not.toThrow();
            });
        });
    });

    // ========================================================================
    // Section 4: Performance Stress Tests (15 tests)
    // ========================================================================

    describe('Section 4: Performance Stress Tests (15 tests)', () => {
        describe('Throughput benchmarks', () => {
            it('4.1: should complete 100 transactions within reasonable time', async () => {
                const start = Date.now();
                await perfService.runThousandTransactions();
                const duration = Date.now() - start;

                // Should complete in under 10 seconds (very conservative)
                expect(duration).toBeLessThan(10000);
            }, 15000);

            it('4.2: should maintain consistent performance across iterations', async () => {
                const iterations = 3;
                const durations: number[] = [];

                for (let i = 0; i < iterations; i++) {
                    mockDbConnection.clients = []; // Reset
                    const start = Date.now();
                    await parallelService.runConcurrentIndependent(100);
                    durations.push(Date.now() - start);
                }

                const avgDuration =
                    durations.reduce((a, b) => a + b, 0) / iterations;
                const variance =
                    durations.reduce(
                        (sum, d) => sum + Math.pow(d - avgDuration, 2),
                        0,
                    ) / iterations;

                // Variance should be low (consistent performance)
                expect(variance).toBeLessThan(avgDuration * avgDuration);
            }, 20000);

            it('4.3: should handle 500 sequential transactions efficiently', async () => {
                const start = Date.now();
                await perfService.rapidSequentialTransactions(500);
                const duration = Date.now() - start;

                expect(duration).toBeLessThan(5000);
            }, 10000);

            it('4.4: should handle 1000 concurrent transactions without degradation', async () => {
                const start = Date.now();
                await perfService.runThousandTransactions();
                const duration = Date.now() - start;

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(1000);
                expect(duration).toBeLessThan(10000);
            }, 15000);

            it('4.5: should achieve >100 transactions/second throughput', async () => {
                const start = Date.now();
                await parallelService.runConcurrentIndependent(200);
                const duration = Date.now() - start;

                const throughput = (200 / duration) * 1000; // tx/sec
                expect(throughput).toBeGreaterThan(100);
            }, 10000);
        });

        describe('Deep nesting stress tests', () => {
            it('4.6: should handle 10-level deep nesting without stack overflow', async () => {
                await expect(
                    perfService.deepNestedTransaction(10),
                ).resolves.not.toThrow();
            });

            it('4.7: should handle 15-level deep nesting without stack overflow', async () => {
                await expect(
                    perfService.deepNestedTransaction(15),
                ).resolves.not.toThrow();
            });

            it('4.8: should handle 20-level deep nesting without stack overflow', async () => {
                await expect(
                    perfService.deepNestedTransaction(20),
                ).resolves.not.toThrow();
            }, 15000);

            it('4.9: should handle 25-level deep nesting without stack overflow', async () => {
                await expect(
                    perfService.deepNestedTransaction(25),
                ).resolves.not.toThrow();
            }, 15000);

            it('4.10: should complete deep nesting (20 levels) within reasonable time', async () => {
                const start = Date.now();
                await perfService.deepNestedTransaction(20);
                const duration = Date.now() - start;

                expect(duration).toBeLessThan(5000);
            }, 10000);
        });

        describe('Memory and resource management', () => {
            it('4.11: should not leak memory with 1000 sequential transactions', async () => {
                const initialMemory = process.memoryUsage().heapUsed;

                await perfService.rapidSequentialTransactions(1000);

                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }

                const finalMemory = process.memoryUsage().heapUsed;
                const memoryIncrease = finalMemory - initialMemory;

                // Memory increase should be reasonable (less than 50MB)
                expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
            }, 20000);

            it('4.12: should not accumulate transaction state across runs', async () => {
                await perfService.runThousandTransactions();
                const firstCount = mockDbConnection.clients.length;

                mockDbConnection.clients = [];

                await perfService.runThousandTransactions();
                const secondCount = mockDbConnection.clients.length;

                expect(firstCount).toBe(secondCount);
            }, 20000);

            it('4.13: should cleanup transaction resources after completion', async () => {
                await parallelService.runConcurrentIndependent(100);

                const queries = mockDbConnection.getClientsQueries();
                queries.forEach((q) => {
                    // Every transaction should have cleanup (commit or rollback)
                    expect(q[q.length - 1]).toMatch(
                        /^(COMMIT|ROLLBACK) TRANSACTION;$/,
                    );
                });
            });

            it('4.14: should handle repeated stress cycles without degradation', async () => {
                const durations: number[] = [];

                for (let i = 0; i < 5; i++) {
                    mockDbConnection.clients = [];
                    const start = Date.now();
                    await parallelService.runConcurrentIndependent(100);
                    durations.push(Date.now() - start);
                }

                // Later cycles should not be significantly slower
                const firstCycle = durations[0];
                const lastCycle = durations[4];
                expect(lastCycle).toBeLessThan(firstCycle * 2);
            }, 30000);

            it('4.15: should maintain performance under continuous load', async () => {
                const start = Date.now();

                // Continuous load for 2 seconds
                const promises: Promise<void>[] = [];
                const endTime = Date.now() + 2000;

                while (Date.now() < endTime) {
                    promises.push(
                        parallelService.runConcurrentIndependent(10),
                    );
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }

                await Promise.all(promises);
                const duration = Date.now() - start;

                // Should complete within reasonable time
                expect(duration).toBeLessThan(5000);

                // Should have processed significant number of transactions
                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBeGreaterThan(100);
            }, 10000);
        });
    });
});
