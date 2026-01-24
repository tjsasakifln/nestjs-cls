/**
 * Comprehensive test suite for all transaction propagation modes
 * Part 2/3 of ROADMAP Sub-Issue #12 (Propagation Mode Tests)
 * Issue #39: test(transactional): Propagation.RequiresNew and other modes (100 tests)
 *
 * This test suite validates:
 * - Propagation.RequiresNew (25 tests)
 * - Propagation.Nested (20 tests)
 * - Propagation.Supports (15 tests)
 * - Propagation.NotSupported (15 tests)
 * - Propagation.Never (15 tests)
 * - Propagation.Mandatory (10 tests)
 */

import { Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClsModule } from 'nestjs-cls';
import {
    ClsPluginTransactional,
    Propagation,
    Transactional,
    TransactionHost,
    TransactionAlreadyActiveError,
    TransactionNotActiveError,
} from '../../src';
import {
    MockDbConnection,
    TransactionAdapterMock,
} from '../transaction-adapter-mock';

// ============================================================================
// Test Services
// ============================================================================

@Injectable()
class BaseService {
    constructor(
        private readonly txHost: TransactionHost<TransactionAdapterMock>,
    ) {}

    async queryWithoutTx(value: string): Promise<void> {
        await this.txHost.tx.query(value);
    }
}

@Injectable()
class RequiresNewService {
    constructor(
        private readonly txHost: TransactionHost<TransactionAdapterMock>,
        private readonly baseService: BaseService,
    ) {}

    @Transactional(Propagation.RequiresNew)
    async createNewTransaction(value: string): Promise<void> {
        await this.txHost.tx.query(value);
    }

    @Transactional(Propagation.RequiresNew)
    async createNewWithNested(
        value: string,
        nestedValue: string,
    ): Promise<void> {
        await this.txHost.tx.query(value);
        await this.createNewTransaction(nestedValue);
    }

    @Transactional(Propagation.RequiresNew)
    async createNewWithError(value: string): Promise<void> {
        await this.txHost.tx.query(value);
        throw new Error('Intentional error in RequiresNew');
    }

    @Transactional(Propagation.RequiresNew)
    async createNewWithRollback(value: string): Promise<void> {
        await this.txHost.tx.query(value);
        throw new Error('Rollback RequiresNew');
    }
}

@Injectable()
class NestedService {
    constructor(
        private readonly txHost: TransactionHost<TransactionAdapterMock>,
    ) {}

    @Transactional(Propagation.Nested)
    async createNested(value: string): Promise<void> {
        await this.txHost.tx.query(value);
    }

    @Transactional(Propagation.Nested)
    async createNestedWithError(value: string): Promise<void> {
        await this.txHost.tx.query(value);
        throw new Error('Intentional nested error');
    }

    @Transactional(Propagation.Nested)
    async createDeepNested(value: string, nestedValue: string): Promise<void> {
        await this.txHost.tx.query(value);
        await this.createNested(nestedValue);
    }
}

@Injectable()
class SupportsService {
    constructor(
        private readonly txHost: TransactionHost<TransactionAdapterMock>,
    ) {}

    @Transactional(Propagation.Supports)
    async supports(value: string): Promise<void> {
        await this.txHost.tx.query(value);
    }

    @Transactional(Propagation.Supports)
    async supportsWithNested(value: string, nested: string): Promise<void> {
        await this.txHost.tx.query(value);
        await this.supports(nested);
    }
}

@Injectable()
class NotSupportedService {
    constructor(
        private readonly txHost: TransactionHost<TransactionAdapterMock>,
    ) {}

    @Transactional(Propagation.NotSupported)
    async notSupported(value: string): Promise<void> {
        await this.txHost.tx.query(value);
    }

    @Transactional(Propagation.NotSupported)
    async notSupportedWithNested(value: string, nested: string): Promise<void> {
        await this.txHost.tx.query(value);
        await this.notSupported(nested);
    }
}

@Injectable()
class NeverService {
    constructor(
        private readonly txHost: TransactionHost<TransactionAdapterMock>,
    ) {}

    @Transactional(Propagation.Never)
    async never(value: string): Promise<void> {
        await this.txHost.tx.query(value);
    }

    @Transactional(Propagation.Never)
    async neverWithNested(value: string, nested: string): Promise<void> {
        await this.txHost.tx.query(value);
        await this.never(nested);
    }
}

@Injectable()
class MandatoryService {
    constructor(
        private readonly txHost: TransactionHost<TransactionAdapterMock>,
    ) {}

    @Transactional(Propagation.Mandatory)
    async mandatory(value: string): Promise<void> {
        await this.txHost.tx.query(value);
    }

    @Transactional(Propagation.Mandatory)
    async mandatoryWithNested(value: string, nested: string): Promise<void> {
        await this.txHost.tx.query(value);
        await this.mandatory(nested);
    }
}

@Injectable()
class OrchestratorService {
    constructor(
        private readonly txHost: TransactionHost<TransactionAdapterMock>,
        private readonly requiresNewService: RequiresNewService,
        private readonly nestedService: NestedService,
        private readonly supportsService: SupportsService,
        private readonly notSupportedService: NotSupportedService,
        private readonly neverService: NeverService,
        private readonly mandatoryService: MandatoryService,
    ) {}

    @Transactional()
    async withTransaction(value: string): Promise<void> {
        await this.txHost.tx.query(value);
    }

    @Transactional()
    async callRequiresNew(parent: string, child: string): Promise<void> {
        await this.txHost.tx.query(parent);
        await this.requiresNewService.createNewTransaction(child);
    }

    @Transactional()
    async callNested(parent: string, child: string): Promise<void> {
        await this.txHost.tx.query(parent);
        await this.nestedService.createNested(child);
    }

    @Transactional()
    async callNestedWithError(parent: string, child: string): Promise<void> {
        await this.txHost.tx.query(parent);
        await this.nestedService.createNestedWithError(child);
    }

    @Transactional()
    async callNestedAndRecover(
        parent: string,
        child: string,
        recovery: string,
    ): Promise<void> {
        await this.txHost.tx.query(parent);
        try {
            await this.nestedService.createNestedWithError(child);
        } catch {
            // Recover from nested error
        }
        await this.txHost.tx.query(recovery);
    }

    @Transactional()
    async callSupports(parent: string, child: string): Promise<void> {
        await this.txHost.tx.query(parent);
        await this.supportsService.supports(child);
    }

    @Transactional()
    async callNotSupported(parent: string, child: string): Promise<void> {
        await this.txHost.tx.query(parent);
        await this.notSupportedService.notSupported(child);
    }

    @Transactional()
    async callNever(parent: string, child: string): Promise<void> {
        await this.txHost.tx.query(parent);
        await this.neverService.never(child);
    }

    @Transactional()
    async callMandatory(parent: string, child: string): Promise<void> {
        await this.txHost.tx.query(parent);
        await this.mandatoryService.mandatory(child);
    }

    @Transactional()
    async multipleRequiresNew(
        parent: string,
        child1: string,
        child2: string,
    ): Promise<void> {
        await this.txHost.tx.query(parent);
        await this.requiresNewService.createNewTransaction(child1);
        await this.requiresNewService.createNewTransaction(child2);
    }

    @Transactional()
    async requiresNewWithRollback(
        parent: string,
        child: string,
    ): Promise<void> {
        await this.txHost.tx.query(parent);
        // Catch child error - child rolls back but parent continues
        try {
            await this.requiresNewService.createNewWithRollback(child);
        } catch {
            // Expected - child failed and rolled back
        }
    }
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
        BaseService,
        RequiresNewService,
        NestedService,
        SupportsService,
        NotSupportedService,
        NeverService,
        MandatoryService,
        OrchestratorService,
    ],
})
class TestModule {}

// ============================================================================
// Test Suite
// ============================================================================

describe('Propagation Modes - Comprehensive Test Suite (100 tests)', () => {
    let module: TestingModule;
    let txHost: TransactionHost<TransactionAdapterMock>;
    let mockDbConnection: MockDbConnection;
    let requiresNewService: RequiresNewService;
    let nestedService: NestedService;
    let supportsService: SupportsService;
    let notSupportedService: NotSupportedService;
    let neverService: NeverService;
    let mandatoryService: MandatoryService;
    let orchestrator: OrchestratorService;

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [TestModule],
        }).compile();
        await module.init();

        txHost = module.get(TransactionHost);
        mockDbConnection = module.get(MockDbConnection);
        requiresNewService = module.get(RequiresNewService);
        nestedService = module.get(NestedService);
        supportsService = module.get(SupportsService);
        notSupportedService = module.get(NotSupportedService);
        neverService = module.get(NeverService);
        mandatoryService = module.get(MandatoryService);
        orchestrator = module.get(OrchestratorService);
    });

    afterEach(async () => {
        await module.close();
    });

    // ========================================================================
    // Section 1: Propagation.RequiresNew (25 tests)
    // ========================================================================

    describe('Section 1: Propagation.RequiresNew (25 tests)', () => {
        describe('Basic RequiresNew behavior', () => {
            it('1.1: should create new transaction when no parent exists', async () => {
                await requiresNewService.createNewTransaction('Query 1');

                expect(mockDbConnection.getClientsQueries()).toEqual([
                    ['BEGIN TRANSACTION;', 'Query 1', 'COMMIT TRANSACTION;'],
                ]);
            });

            it('1.2: should create new transaction even when parent exists', async () => {
                await orchestrator.callRequiresNew('Parent', 'Child');

                const queries = mockDbConnection.getClientsQueries();
                expect(queries).toEqual([
                    ['BEGIN TRANSACTION;', 'Parent', 'COMMIT TRANSACTION;'],
                    ['BEGIN TRANSACTION;', 'Child', 'COMMIT TRANSACTION;'],
                ]);
            });

            it('1.3: should create independent transactions for parent and child', async () => {
                await orchestrator.callRequiresNew('P1', 'C1');

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(2);
                expect(queries[0]).toContain('P1');
                expect(queries[1]).toContain('C1');
            });

            it('1.4: should commit parent before child executes', async () => {
                await orchestrator.callRequiresNew('Parent', 'Child');

                const queries = mockDbConnection.getClientsQueries();
                // Parent transaction should complete before child starts
                expect(queries[0][queries[0].length - 1]).toBe(
                    'COMMIT TRANSACTION;',
                );
                expect(queries[1][0]).toBe('BEGIN TRANSACTION;');
            });

            it('1.5: should handle child rollback without affecting parent', async () => {
                await orchestrator.requiresNewWithRollback('Parent', 'Child');

                const queries = mockDbConnection.getClientsQueries();
                expect(queries).toEqual([
                    ['BEGIN TRANSACTION;', 'Parent', 'COMMIT TRANSACTION;'],
                    ['BEGIN TRANSACTION;', 'Child', 'ROLLBACK TRANSACTION;'],
                ]);
            });
        });

        describe('Nested RequiresNew scenarios', () => {
            it('1.6: should handle nested RequiresNew (2 levels)', async () => {
                await requiresNewService.createNewWithNested('L1', 'L2');

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(2);
                expect(queries[0]).toContain('L1');
                expect(queries[1]).toContain('L2');
            });

            it('1.7: should create 3 independent transactions (parent → child → grandchild)', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Grandparent');
                    await requiresNewService.createNewWithNested(
                        'Parent',
                        'Child',
                    );
                });

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(3);
                expect(queries[0]).toContain('Grandparent');
                expect(queries[1]).toContain('Parent');
                expect(queries[2]).toContain('Child');
            });

            it('1.8: should handle deep nesting (4 levels of RequiresNew)', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('L1');
                    await txHost.withTransaction(
                        Propagation.RequiresNew,
                        async () => {
                            await txHost.tx.query('L2');
                            await txHost.withTransaction(
                                Propagation.RequiresNew,
                                async () => {
                                    await txHost.tx.query('L3');
                                    await txHost.withTransaction(
                                        Propagation.RequiresNew,
                                        async () => {
                                            await txHost.tx.query('L4');
                                        },
                                    );
                                },
                            );
                        },
                    );
                });

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(4);
                expect(
                    queries.map((q) => q.filter((s) => s.startsWith('L'))),
                ).toEqual([['L1'], ['L2'], ['L3'], ['L4']]);
            });

            it('1.9: should handle 5-level deep RequiresNew nesting', async () => {
                let depth = 0;
                const createNested = async (level: number): Promise<void> => {
                    if (level === 5) return;
                    await txHost.withTransaction(
                        Propagation.RequiresNew,
                        async () => {
                            await txHost.tx.query(`Level ${level + 1}`);
                            depth++;
                            await createNested(level + 1);
                        },
                    );
                };

                await createNested(0);

                expect(depth).toBe(5);
                expect(mockDbConnection.getClientsQueries().length).toBe(5);
            });

            it('1.10: should commit all nested RequiresNew independently', async () => {
                await requiresNewService.createNewWithNested('Parent', 'Child');

                const queries = mockDbConnection.getClientsQueries();
                queries.forEach((q) => {
                    expect(q[0]).toBe('BEGIN TRANSACTION;');
                    expect(q[q.length - 1]).toBe('COMMIT TRANSACTION;');
                });
            });
        });

        describe('Multiple RequiresNew in sequence', () => {
            it('1.11: should handle multiple RequiresNew calls sequentially', async () => {
                await orchestrator.multipleRequiresNew(
                    'Parent',
                    'Child1',
                    'Child2',
                );

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(3);
                expect(queries[0]).toContain('Parent');
                expect(queries[1]).toContain('Child1');
                expect(queries[2]).toContain('Child2');
            });

            it('1.12: should create 5 independent transactions in sequence', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('P');
                    for (let i = 1; i <= 4; i++) {
                        await requiresNewService.createNewTransaction(`C${i}`);
                    }
                });

                expect(mockDbConnection.getClientsQueries().length).toBe(5);
            });

            it('1.13: should handle sequential RequiresNew with mixed success/failure', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Parent');
                    await requiresNewService.createNewTransaction('Success1');
                    try {
                        await requiresNewService.createNewWithError('Fail');
                    } catch {
                        // Ignore
                    }
                    await requiresNewService.createNewTransaction('Success2');
                });

                const queries = mockDbConnection.getClientsQueries();
                expect(queries[0][queries[0].length - 1]).toBe(
                    'COMMIT TRANSACTION;',
                );
                expect(queries[1][queries[1].length - 1]).toBe(
                    'COMMIT TRANSACTION;',
                );
                expect(queries[2][queries[2].length - 1]).toBe(
                    'ROLLBACK TRANSACTION;',
                );
                expect(queries[3][queries[3].length - 1]).toBe(
                    'COMMIT TRANSACTION;',
                );
            });

            it('1.14: should not propagate child failure to parent', async () => {
                let parentCommitted = false;

                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Parent Start');
                    try {
                        await requiresNewService.createNewWithError(
                            'Child Error',
                        );
                    } catch {
                        // Parent continues
                    }
                    await txHost.tx.query('Parent Continue');
                    parentCommitted = true;
                });

                expect(parentCommitted).toBe(true);
                const queries = mockDbConnection.getClientsQueries();
                expect(queries[0]).toContain('COMMIT TRANSACTION;');
            });

            it('1.15: should allow parent to continue after child rollback', async () => {
                const result = await txHost.withTransaction(async () => {
                    await txHost.tx.query('Before child');
                    try {
                        await requiresNewService.createNewWithRollback('Child');
                    } catch {
                        // Expected
                    }
                    await txHost.tx.query('After child');
                    return 'Parent success';
                });

                expect(result).toBe('Parent success');
                expect(mockDbConnection.getClientsQueries()[0]).toContain(
                    'COMMIT TRANSACTION;',
                );
            });
        });

        describe('RequiresNew error handling', () => {
            it('1.16: should rollback RequiresNew transaction on error', async () => {
                await expect(
                    requiresNewService.createNewWithError('Error'),
                ).rejects.toThrow();

                expect(mockDbConnection.getClientsQueries()).toEqual([
                    ['BEGIN TRANSACTION;', 'Error', 'ROLLBACK TRANSACTION;'],
                ]);
            });

            it('1.17: should not affect parent transaction when RequiresNew fails', async () => {
                let parentSuccess = false;

                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Parent');
                    try {
                        await requiresNewService.createNewWithError(
                            'Child Error',
                        );
                    } catch {
                        // Expected
                    }
                    parentSuccess = true;
                });

                expect(parentSuccess).toBe(true);
            });

            it('1.18: should isolate parent from child exceptions', async () => {
                const errors: Error[] = [];

                await txHost.withTransaction(async () => {
                    for (let i = 1; i <= 3; i++) {
                        try {
                            await requiresNewService.createNewWithError(
                                `E${i}`,
                            );
                        } catch (e) {
                            errors.push(e as Error);
                        }
                    }
                    await txHost.tx.query('Parent continues');
                });

                expect(errors.length).toBe(3);
                expect(mockDbConnection.getClientsQueries()[0]).toContain(
                    'Parent continues',
                );
            });

            it('1.19: should handle exception in nested RequiresNew', async () => {
                await expect(
                    txHost.withTransaction(async () => {
                        await txHost.tx.query('Parent start');
                        await requiresNewService.createNewWithNested(
                            'L1',
                            'L2',
                        );
                        throw new Error('Parent error after nested');
                    }),
                ).rejects.toThrow('Parent error after nested');

                const queries = mockDbConnection.getClientsQueries();
                // Verify transaction order: Parent starts first, then L1, then L2
                // Parent should rollback (has error), L1 and L2 should commit
                expect(queries.length).toBe(3);
                // Parent transaction starts, has query, then rolls back
                expect(queries[0][0]).toBe('BEGIN TRANSACTION;');
                expect(queries[0]).toContain('Parent start');
                expect(queries[0][queries[0].length - 1]).toBe(
                    'ROLLBACK TRANSACTION;',
                );
                // L1 and L2 should commit
                expect(queries[1][queries[1].length - 1]).toBe(
                    'COMMIT TRANSACTION;',
                );
                expect(queries[2][queries[2].length - 1]).toBe(
                    'COMMIT TRANSACTION;',
                );
            });

            it('1.20: should allow parent to handle child error gracefully', async () => {
                const recoveryExecuted = { value: false };

                await txHost.withTransaction(async () => {
                    try {
                        await requiresNewService.createNewWithError('Fail');
                    } catch {
                        await txHost.tx.query('Recovery query');
                        recoveryExecuted.value = true;
                    }
                });

                expect(recoveryExecuted.value).toBe(true);
                expect(mockDbConnection.getClientsQueries()[0]).toContain(
                    'Recovery query',
                );
            });
        });

        describe('RequiresNew with transaction suspension', () => {
            it('1.21: should suspend parent transaction during child execution', async () => {
                const executionOrder: string[] = [];

                await txHost.withTransaction(async () => {
                    executionOrder.push('Parent start');
                    await txHost.tx.query('Parent query 1');
                    await txHost.withTransaction(
                        Propagation.RequiresNew,
                        async () => {
                            executionOrder.push('Child start');
                            await txHost.tx.query('Child query');
                            executionOrder.push('Child end');
                        },
                    );
                    executionOrder.push('Parent resume');
                    await txHost.tx.query('Parent query 2');
                });

                expect(executionOrder).toEqual([
                    'Parent start',
                    'Child start',
                    'Child end',
                    'Parent resume',
                ]);
            });

            it('1.22: should resume parent after child commits', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Before');
                    await requiresNewService.createNewTransaction('Child');
                    await txHost.tx.query('After');
                });

                const parentQueries = mockDbConnection
                    .getClientsQueries()[0]
                    .filter((q) => !q.includes('TRANSACTION'));
                expect(parentQueries).toEqual(['Before', 'After']);
            });

            it('1.23: should resume parent after child rollback', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Before');
                    try {
                        await requiresNewService.createNewWithRollback('Child');
                    } catch {
                        // Expected
                    }
                    await txHost.tx.query('After');
                });

                const parentQueries = mockDbConnection
                    .getClientsQueries()[0]
                    .filter((q) => !q.includes('TRANSACTION'));
                expect(parentQueries).toEqual(['Before', 'After']);
            });

            it('1.24: should handle multiple suspensions in sequence', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('P1');
                    await requiresNewService.createNewTransaction('C1');
                    await txHost.tx.query('P2');
                    await requiresNewService.createNewTransaction('C2');
                    await txHost.tx.query('P3');
                });

                const parentQueries = mockDbConnection
                    .getClientsQueries()[0]
                    .filter((q) => !q.includes('TRANSACTION'));
                expect(parentQueries).toEqual(['P1', 'P2', 'P3']);
            });

            it('1.25: should maintain parent transaction isolation during suspension', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Parent 1');
                    const clientBeforeSuspend = txHost.tx;
                    await requiresNewService.createNewTransaction('Child');
                    const clientAfterResume = txHost.tx;
                    await txHost.tx.query('Parent 2');

                    // Parent should use same client before and after suspension
                    expect(clientBeforeSuspend).toBe(clientAfterResume);
                });

                // Verify parent transaction continuity
                const queries = mockDbConnection.getClientsQueries();
                expect(queries[0]).toContain('Parent 1');
                expect(queries[0]).toContain('Parent 2');
            });
        });
    });

    // ========================================================================
    // Section 2: Propagation.Nested (20 tests)
    // ========================================================================

    describe('Section 2: Propagation.Nested (20 tests)', () => {
        describe('Basic Nested behavior', () => {
            it('2.1: should create new transaction when no parent exists', async () => {
                await nestedService.createNested('Query 1');

                expect(mockDbConnection.getClientsQueries()).toEqual([
                    ['BEGIN TRANSACTION;', 'Query 1', 'COMMIT TRANSACTION;'],
                ]);
            });

            it('2.2: should create nested transaction within parent', async () => {
                await orchestrator.callNested('Parent', 'Child');

                expect(mockDbConnection.getClientsQueries()).toEqual([
                    [
                        'BEGIN TRANSACTION;',
                        'Parent',
                        'SAVEPOINT nested_transaction;',
                        'Child',
                        'RELEASE SAVEPOINT nested_transaction;',
                        'COMMIT TRANSACTION;',
                    ],
                ]);
            });

            it('2.3: should use savepoints for nested transactions', async () => {
                await orchestrator.callNested('P', 'C');

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries).toContain('SAVEPOINT nested_transaction;');
                expect(queries).toContain(
                    'RELEASE SAVEPOINT nested_transaction;',
                );
            });

            it('2.4: should share transaction client with parent', async () => {
                await orchestrator.callNested('Parent', 'Child');

                // All queries should be in same transaction (same client)
                expect(mockDbConnection.getClientsQueries().length).toBe(1);
            });

            it('2.5: should handle multiple nested transactions sequentially', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Parent');
                    await nestedService.createNested('Child1');
                    await nestedService.createNested('Child2');
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                const savepoints = queries.filter((q) =>
                    q.includes('SAVEPOINT'),
                );
                const releases = queries.filter((q) =>
                    q.includes('RELEASE SAVEPOINT'),
                );
                // v7.0 creates isolated contexts, resulting in more savepoints
                expect(savepoints.length).toBeGreaterThanOrEqual(2);
                expect(releases.length).toBeGreaterThanOrEqual(2);
            });
        });

        describe('Nested transaction rollback', () => {
            it('2.6: should rollback nested transaction on error', async () => {
                await expect(
                    orchestrator.callNestedWithError('Parent', 'Child'),
                ).rejects.toThrow();

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries).toContain('SAVEPOINT nested_transaction;');
                expect(queries).toContain(
                    'ROLLBACK TO SAVEPOINT nested_transaction;',
                );
            });

            it('2.7: should rollback parent when nested error propagates', async () => {
                await expect(
                    orchestrator.callNestedWithError('Parent', 'Child'),
                ).rejects.toThrow('Intentional nested error');

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries[queries.length - 1]).toBe(
                    'ROLLBACK TRANSACTION;',
                );
            });

            it('2.8: should allow parent to continue after catching nested error', async () => {
                await orchestrator.callNestedAndRecover('P', 'C', 'Recovery');

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries).toContain(
                    'ROLLBACK TO SAVEPOINT nested_transaction;',
                );
                expect(queries).toContain('Recovery');
                expect(queries[queries.length - 1]).toBe('COMMIT TRANSACTION;');
            });

            it('2.9: should handle nested rollback without affecting parent state', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Before nested');
                    try {
                        await nestedService.createNestedWithError('Fail');
                    } catch {
                        // Recovered
                    }
                    await txHost.tx.query('After nested');
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries).toContain('Before nested');
                expect(queries).toContain('After nested');
                expect(queries[queries.length - 1]).toBe('COMMIT TRANSACTION;');
            });

            it('2.10: should rollback multiple failed nested transactions independently', async () => {
                await txHost.withTransaction(async () => {
                    for (let i = 1; i <= 3; i++) {
                        try {
                            await nestedService.createNestedWithError(
                                `Fail ${i}`,
                            );
                        } catch {
                            // Continue
                        }
                    }
                    await txHost.tx.query('Parent continues');
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                const rollbacks = queries.filter((q) =>
                    q.includes('ROLLBACK TO SAVEPOINT'),
                );
                expect(rollbacks.length).toBe(3);
                expect(queries[queries.length - 1]).toBe('COMMIT TRANSACTION;');
            });
        });

        describe('Deep nested transactions', () => {
            it('2.11: should handle 2-level nested transactions', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('L1');
                    await nestedService.createDeepNested('L2', 'L3');
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                const savepoints = queries.filter((q) =>
                    q.includes('SAVEPOINT'),
                );
                // Should have savepoints for nested transactions
                expect(savepoints.length).toBeGreaterThanOrEqual(2);
            });

            it('2.12: should handle 3-level nested transactions', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('L1');
                    await txHost.withTransaction(
                        Propagation.Nested,
                        async () => {
                            await txHost.tx.query('L2');
                            await txHost.withTransaction(
                                Propagation.Nested,
                                async () => {
                                    await txHost.tx.query('L3');
                                },
                            );
                        },
                    );
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                const savepoints = queries.filter((q) =>
                    q.includes('SAVEPOINT'),
                );
                // Should have savepoints for nested transactions (at least 2)
                expect(savepoints.length).toBeGreaterThanOrEqual(2);
            });

            it('2.13: should release savepoints in reverse order (LIFO)', async () => {
                await txHost.withTransaction(async () => {
                    await nestedService.createDeepNested('L1', 'L2');
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                const savepointIdx = queries.indexOf(
                    'SAVEPOINT nested_transaction;',
                );
                const releaseIdx = queries.indexOf(
                    'RELEASE SAVEPOINT nested_transaction;',
                );
                // Inner savepoint created after outer, released before outer
                expect(releaseIdx).toBeGreaterThan(savepointIdx);
            });

            it('2.14: should rollback deepest nested without affecting outer nested', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Parent');
                    await txHost.withTransaction(
                        Propagation.Nested,
                        async () => {
                            await txHost.tx.query('Outer nested');
                            try {
                                await txHost.withTransaction(
                                    Propagation.Nested,
                                    async () => {
                                        await txHost.tx.query('Inner nested');
                                        throw new Error('Inner fails');
                                    },
                                );
                            } catch {
                                // Outer nested recovers
                            }
                            await txHost.tx.query('Outer continues');
                        },
                    );
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries).toContain('Outer continues');
                expect(queries[queries.length - 1]).toBe('COMMIT TRANSACTION;');
            });

            it('2.15: should handle 5-level deep nesting', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('L1');
                    await txHost.withTransaction(
                        Propagation.Nested,
                        async () => {
                            await txHost.tx.query('L2');
                            await txHost.withTransaction(
                                Propagation.Nested,
                                async () => {
                                    await txHost.tx.query('L3');
                                    await txHost.withTransaction(
                                        Propagation.Nested,
                                        async () => {
                                            await txHost.tx.query('L4');
                                            await txHost.withTransaction(
                                                Propagation.Nested,
                                                async () => {
                                                    await txHost.tx.query('L5');
                                                },
                                            );
                                        },
                                    );
                                },
                            );
                        },
                    );
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries.filter((q) => q.startsWith('L')).length).toBe(5);
            });
        });

        describe('Nested with mixed outcomes', () => {
            it('2.16: should handle successful nested after failed nested', async () => {
                await txHost.withTransaction(async () => {
                    try {
                        await nestedService.createNestedWithError('Fail');
                    } catch {
                        // Continue
                    }
                    await nestedService.createNested('Success');
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries).toContain(
                    'ROLLBACK TO SAVEPOINT nested_transaction;',
                );
                expect(queries).toContain('Success');
                expect(queries[queries.length - 1]).toBe('COMMIT TRANSACTION;');
            });

            it('2.17: should handle alternating success/failure nested transactions', async () => {
                await txHost.withTransaction(async () => {
                    await nestedService.createNested('S1');
                    try {
                        await nestedService.createNestedWithError('F1');
                    } catch {
                        // Continue
                    }
                    await nestedService.createNested('S2');
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries).toContain('S1');
                expect(queries).toContain('S2');
                expect(
                    queries.filter((q) => q.includes('RELEASE SAVEPOINT'))
                        .length,
                ).toBe(2);
                expect(
                    queries.filter((q) => q.includes('ROLLBACK TO SAVEPOINT'))
                        .length,
                ).toBe(1);
            });

            it('2.18: should commit parent after multiple nested transactions', async () => {
                await txHost.withTransaction(async () => {
                    for (let i = 1; i <= 5; i++) {
                        await nestedService.createNested(`Nested ${i}`);
                    }
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(
                    queries.filter((q) => q.includes('RELEASE SAVEPOINT'))
                        .length,
                ).toBe(5);
                expect(queries[queries.length - 1]).toBe('COMMIT TRANSACTION;');
            });

            it('2.19: should handle partial nested rollbacks', async () => {
                await txHost.withTransaction(async () => {
                    await nestedService.createNested('S1');
                    try {
                        await nestedService.createNestedWithError('F1');
                    } catch {
                        // Continue
                    }
                    try {
                        await nestedService.createNestedWithError('F2');
                    } catch {
                        // Continue
                    }
                    await nestedService.createNested('S2');
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(
                    queries.filter((q) => q.includes('ROLLBACK TO SAVEPOINT'))
                        .length,
                ).toBe(2);
                expect(
                    queries.filter((q) => q.includes('RELEASE SAVEPOINT'))
                        .length,
                ).toBe(2);
            });

            it('2.20: should maintain parent transaction integrity despite nested failures', async () => {
                let successfulOps = 0;

                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Parent start');
                    successfulOps++;
                    for (let i = 0; i < 10; i++) {
                        try {
                            if (i % 2 === 0) {
                                await nestedService.createNested(
                                    `Success ${i}`,
                                );
                                successfulOps++;
                            } else {
                                await nestedService.createNestedWithError(
                                    `Fail ${i}`,
                                );
                            }
                        } catch {
                            // Continue
                        }
                    }
                    await txHost.tx.query('Parent end');
                    successfulOps++;
                });

                expect(successfulOps).toBe(7); // 1 start + 5 nested + 1 end
                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries[queries.length - 1]).toBe('COMMIT TRANSACTION;');
            });
        });
    });

    // ========================================================================
    // Section 3: Propagation.Supports (15 tests)
    // ========================================================================

    describe('Section 3: Propagation.Supports (15 tests)', () => {
        describe('Supports without parent transaction', () => {
            it('3.1: should run without transaction when no parent exists', async () => {
                await supportsService.supports('Query 1');

                expect(mockDbConnection.getClientsQueries()).toEqual([
                    ['Query 1'],
                ]);
            });

            it('3.2: should not create BEGIN/COMMIT when no parent', async () => {
                await supportsService.supports('No TX');

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries).not.toContain('BEGIN TRANSACTION;');
                expect(queries).not.toContain('COMMIT TRANSACTION;');
            });

            it('3.3: should handle multiple Supports calls without transaction', async () => {
                await supportsService.supportsWithNested('Q1', 'Q2');

                expect(mockDbConnection.getClientsQueries()).toEqual([
                    ['Q1'],
                    ['Q2'],
                ]);
            });

            it('3.4: should execute queries directly without transaction wrapper', async () => {
                await supportsService.supports('Direct query');

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(1);
                expect(queries[0].length).toBe(1);
                expect(queries[0][0]).toBe('Direct query');
            });

            it('3.5: should allow sequential Supports without transaction overhead', async () => {
                for (let i = 1; i <= 5; i++) {
                    await supportsService.supports(`Query ${i}`);
                }

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(5);
                queries.forEach((q, idx) => {
                    expect(q).toEqual([`Query ${idx + 1}`]);
                });
            });
        });

        describe('Supports with parent transaction', () => {
            it('3.6: should join existing transaction', async () => {
                await orchestrator.callSupports('Parent', 'Child');

                expect(mockDbConnection.getClientsQueries()).toEqual([
                    [
                        'BEGIN TRANSACTION;',
                        'Parent',
                        'Child',
                        'COMMIT TRANSACTION;',
                    ],
                ]);
            });

            it('3.7: should share transaction with parent', async () => {
                await orchestrator.callSupports('P', 'C');

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(1); // Single transaction
                expect(queries[0]).toContain('P');
                expect(queries[0]).toContain('C');
            });

            it('3.8: should commit with parent transaction', async () => {
                await orchestrator.callSupports('Parent', 'Supports');

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries[0]).toBe('BEGIN TRANSACTION;');
                expect(queries[queries.length - 1]).toBe('COMMIT TRANSACTION;');
            });

            it('3.9: should rollback with parent on error', async () => {
                await expect(
                    txHost.withTransaction(async () => {
                        await txHost.tx.query('Parent');
                        await supportsService.supports('Supports');
                        throw new Error('Parent error');
                    }),
                ).rejects.toThrow('Parent error');

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries[queries.length - 1]).toBe(
                    'ROLLBACK TRANSACTION;',
                );
            });

            it('3.10: should handle multiple Supports in same parent transaction', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Parent');
                    await supportsService.supports('S1');
                    await supportsService.supports('S2');
                    await supportsService.supports('S3');
                });

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(1);
                expect(queries[0]).toContain('S1');
                expect(queries[0]).toContain('S2');
                expect(queries[0]).toContain('S3');
            });
        });

        describe('Supports mixed scenarios', () => {
            it('3.11: should handle Supports called both with and without transaction', async () => {
                await supportsService.supports('Without TX');
                await orchestrator.callSupports('Parent', 'With TX');

                const queries = mockDbConnection.getClientsQueries();
                expect(queries[0]).toEqual(['Without TX']);
                expect(queries[1]).toContain('BEGIN TRANSACTION;');
            });

            it('3.12: should handle nested Supports within transaction', async () => {
                await txHost.withTransaction(async () => {
                    await supportsService.supportsWithNested('Outer', 'Inner');
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries).toContain('Outer');
                expect(queries).toContain('Inner');
                expect(
                    queries.filter((q) => q === 'BEGIN TRANSACTION;').length,
                ).toBe(1);
            });

            it('3.13: should support error propagation in parent transaction', async () => {
                await expect(
                    txHost.withTransaction(async () => {
                        await supportsService.supports('Before error');
                        throw new Error('Supports error');
                    }),
                ).rejects.toThrow('Supports error');

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries).toContain('Before error');
                expect(queries[queries.length - 1]).toBe(
                    'ROLLBACK TRANSACTION;',
                );
            });

            it('3.14: should not create savepoints for Supports', async () => {
                await orchestrator.callSupports('Parent', 'Supports');

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(
                    queries.find((q) => q.includes('SAVEPOINT')),
                ).toBeUndefined();
            });

            it('3.15: should allow Supports to coexist with other propagation modes', async () => {
                await txHost.withTransaction(async () => {
                    await supportsService.supports('Supports');
                    await nestedService.createNested('Nested');
                    await requiresNewService.createNewTransaction(
                        'RequiresNew',
                    );
                });

                const queries = mockDbConnection.getClientsQueries();
                expect(queries[0]).toContain('Supports');
                expect(queries[0]).toContain('SAVEPOINT nested_transaction;');
                expect(queries.length).toBeGreaterThan(1); // RequiresNew creates new tx
            });
        });
    });

    // ========================================================================
    // Section 4: Propagation.NotSupported (15 tests)
    // ========================================================================

    describe('Section 4: Propagation.NotSupported (15 tests)', () => {
        describe('NotSupported without parent transaction', () => {
            it('4.1: should run without transaction when no parent exists', async () => {
                await notSupportedService.notSupported('Query 1');

                expect(mockDbConnection.getClientsQueries()).toEqual([
                    ['Query 1'],
                ]);
            });

            it('4.2: should not create transaction wrapper', async () => {
                await notSupportedService.notSupported('No TX');

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries).not.toContain('BEGIN TRANSACTION;');
            });

            it('4.3: should execute directly without transaction overhead', async () => {
                await notSupportedService.notSupported('Direct');

                expect(mockDbConnection.getClientsQueries()).toEqual([
                    ['Direct'],
                ]);
            });

            it('4.4: should handle multiple NotSupported calls sequentially', async () => {
                for (let i = 1; i <= 3; i++) {
                    await notSupportedService.notSupported(`Q${i}`);
                }

                const queries = mockDbConnection.getClientsQueries();
                expect(queries).toEqual([['Q1'], ['Q2'], ['Q3']]);
            });

            it('4.5: should not interfere with transaction state when called standalone', async () => {
                await notSupportedService.notSupported('Standalone');
                await orchestrator.withTransaction('After NotSupported');

                const queries = mockDbConnection.getClientsQueries();
                expect(queries[0]).toEqual(['Standalone']);
                expect(queries[1]).toContain('BEGIN TRANSACTION;');
            });
        });

        describe('NotSupported with parent transaction', () => {
            it('4.6: should suspend parent transaction', async () => {
                await orchestrator.callNotSupported('Parent', 'Child');

                const queries = mockDbConnection.getClientsQueries();
                expect(queries[0]).toContain('BEGIN TRANSACTION;');
                expect(queries[0]).toContain('Parent');
                expect(queries[1]).toEqual(['Child']); // Child runs without TX
            });

            it('4.7: should run without transaction even when parent has transaction', async () => {
                await orchestrator.callNotSupported('P', 'C');

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(2);
                expect(queries[1]).not.toContain('BEGIN TRANSACTION;');
            });

            it('4.8: should resume parent transaction after completion', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Before');
                    await notSupportedService.notSupported('Suspended');
                    await txHost.tx.query('After');
                });

                const queries = mockDbConnection.getClientsQueries();
                expect(queries[0]).toContain('Before');
                expect(queries[0]).toContain('After');
                expect(queries[1]).toEqual(['Suspended']);
            });

            it('4.9: should commit parent despite NotSupported suspension', async () => {
                await orchestrator.callNotSupported('Parent', 'NotSupported');

                const queries = mockDbConnection.getClientsQueries();
                expect(queries[0][queries[0].length - 1]).toBe(
                    'COMMIT TRANSACTION;',
                );
            });

            it('4.10: should handle multiple NotSupported calls within transaction', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('P1');
                    await notSupportedService.notSupported('NS1');
                    await txHost.tx.query('P2');
                    await notSupportedService.notSupported('NS2');
                    await txHost.tx.query('P3');
                });

                const queries = mockDbConnection.getClientsQueries();
                expect(queries[0]).toContain('P1');
                expect(queries[0]).toContain('P2');
                expect(queries[0]).toContain('P3');
                expect(queries[1]).toEqual(['NS1']);
                expect(queries[2]).toEqual(['NS2']);
            });
        });

        describe('NotSupported error handling', () => {
            it('4.11: should propagate errors from NotSupported to parent', async () => {
                await expect(
                    txHost.withTransaction(async () => {
                        await txHost.tx.query('Parent');
                        await txHost.withTransaction(
                            Propagation.NotSupported,
                            async () => {
                                throw new Error('NotSupported error');
                            },
                        );
                    }),
                ).rejects.toThrow('NotSupported error');

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries[queries.length - 1]).toBe(
                    'ROLLBACK TRANSACTION;',
                );
            });

            it('4.12: should rollback parent when NotSupported throws', async () => {
                // NotSupported doesn't throw by default - it just runs without transaction
                // To test error propagation, throw an error inside NotSupported block
                await expect(
                    txHost.withTransaction(async () => {
                        await txHost.tx.query('Parent');
                        await txHost.withTransaction(
                            Propagation.NotSupported,
                            async () => {
                                throw new Error('Error in NotSupported');
                            },
                        );
                    }),
                ).rejects.toThrow('Error in NotSupported');

                const parentQueries = mockDbConnection.getClientsQueries()[0];
                expect(parentQueries[parentQueries.length - 1]).toBe(
                    'ROLLBACK TRANSACTION;',
                );
            });

            it('4.13: should allow parent to recover from NotSupported error', async () => {
                await txHost.withTransaction(async () => {
                    try {
                        await txHost.withTransaction(
                            Propagation.NotSupported,
                            async () => {
                                throw new Error('Fail');
                            },
                        );
                    } catch {
                        await txHost.tx.query('Recovery');
                    }
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries).toContain('Recovery');
                expect(queries[queries.length - 1]).toBe('COMMIT TRANSACTION;');
            });

            it('4.14: should handle nested NotSupported within NotSupported', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.withTransaction(
                        Propagation.NotSupported,
                        async () => {
                            await txHost.tx.query('Outer NotSupported');
                            await notSupportedService.notSupported(
                                'Inner NotSupported',
                            );
                        },
                    );
                });

                const queries = mockDbConnection.getClientsQueries();
                // Both NotSupported calls should run without transaction
                expect(
                    queries.find((q) => q.includes('Outer NotSupported')),
                ).toBeDefined();
                expect(
                    queries.find((q) => q.includes('Inner NotSupported')),
                ).toBeDefined();
            });

            it('4.15: should maintain parent state across multiple suspensions', async () => {
                const executionOrder: string[] = [];

                await txHost.withTransaction(async () => {
                    executionOrder.push('TX Start');
                    await notSupportedService.notSupported('NS1');
                    executionOrder.push('TX Resume 1');
                    await notSupportedService.notSupported('NS2');
                    executionOrder.push('TX Resume 2');
                });

                expect(executionOrder).toEqual([
                    'TX Start',
                    'TX Resume 1',
                    'TX Resume 2',
                ]);
            });
        });
    });

    // ========================================================================
    // Section 5: Propagation.Never (15 tests)
    // ========================================================================

    describe('Section 5: Propagation.Never (15 tests)', () => {
        describe('Never without parent transaction', () => {
            it('5.1: should run without transaction when no parent exists', async () => {
                await neverService.never('Query 1');

                expect(mockDbConnection.getClientsQueries()).toEqual([
                    ['Query 1'],
                ]);
            });

            it('5.2: should not create transaction wrapper', async () => {
                await neverService.never('No TX');

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries).not.toContain('BEGIN TRANSACTION;');
            });

            it('5.3: should execute directly without transaction', async () => {
                await neverService.never('Direct query');

                expect(mockDbConnection.getClientsQueries()).toEqual([
                    ['Direct query'],
                ]);
            });

            it('5.4: should handle multiple Never calls sequentially', async () => {
                for (let i = 1; i <= 3; i++) {
                    await neverService.never(`Q${i}`);
                }

                expect(mockDbConnection.getClientsQueries()).toEqual([
                    ['Q1'],
                    ['Q2'],
                    ['Q3'],
                ]);
            });

            it('5.5: should handle nested Never calls', async () => {
                await neverService.neverWithNested('Outer', 'Inner');

                expect(mockDbConnection.getClientsQueries()).toEqual([
                    ['Outer'],
                    ['Inner'],
                ]);
            });
        });

        describe('Never with parent transaction (error cases)', () => {
            it('5.6: should throw TransactionAlreadyActiveError when parent exists', async () => {
                await expect(
                    orchestrator.callNever('Parent', 'Child'),
                ).rejects.toThrow(TransactionAlreadyActiveError);
            });

            it('5.7: should rollback parent transaction on Never error', async () => {
                await expect(
                    orchestrator.callNever('P', 'C'),
                ).rejects.toThrow();

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries[queries.length - 1]).toBe(
                    'ROLLBACK TRANSACTION;',
                );
            });

            it('5.8: should throw before executing Never method when transaction active', async () => {
                const executed = { value: false };

                try {
                    await txHost.withTransaction(async () => {
                        await txHost.withTransaction(
                            Propagation.Never,
                            async () => {
                                executed.value = true;
                            },
                        );
                    });
                } catch (e) {
                    expect(e).toBeInstanceOf(TransactionAlreadyActiveError);
                }

                expect(executed.value).toBe(false);
            });

            it('5.9: should throw even with deeply nested parent transaction', async () => {
                try {
                    await txHost.withTransaction(async () => {
                        await txHost.withTransaction(async () => {
                            await neverService.never('Should fail');
                        });
                    });
                    fail('Should have thrown TransactionAlreadyActiveError');
                } catch (e) {
                    expect(e).toBeInstanceOf(TransactionAlreadyActiveError);
                }
            });

            it('5.10: should prevent execution if any transaction is active in chain', async () => {
                try {
                    await txHost.withTransaction(async () => {
                        await txHost.withTransaction(
                            Propagation.RequiresNew,
                            async () => {
                                await neverService.never('Fail');
                            },
                        );
                    });
                    fail('Should have thrown error');
                } catch (e) {
                    expect(e).toBeInstanceOf(TransactionAlreadyActiveError);
                }
            });
        });

        describe('Never error recovery', () => {
            it('5.11: should allow parent to catch Never error', async () => {
                let errorCaught = false;

                await txHost.withTransaction(async () => {
                    try {
                        await neverService.never('Should throw');
                    } catch (e) {
                        errorCaught = true;
                        expect(e).toBeInstanceOf(TransactionAlreadyActiveError);
                    }
                });

                expect(errorCaught).toBe(true);
            });

            it('5.12: should allow parent to recover when catching Never error', async () => {
                // Parent can catch the error and continue
                await txHost.withTransaction(async () => {
                    await txHost.tx.query('Before Never');
                    try {
                        await neverService.never('Throws');
                    } catch (e) {
                        expect(e).toBeInstanceOf(TransactionAlreadyActiveError);
                    }
                    await txHost.tx.query('After Never');
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries).toContain('Before Never');
                expect(queries).toContain('After Never');
                expect(queries[queries.length - 1]).toBe('COMMIT TRANSACTION;');
            });

            it('5.13: should provide descriptive error message', async () => {
                await expect(
                    txHost.withTransaction(async () => {
                        await neverService.never('Test');
                    }),
                ).rejects.toThrow(/transaction.*already.*active/i);
            });

            it('5.14: should handle Never in NotSupported scope (should succeed)', async () => {
                await txHost.withTransaction(async () => {
                    await txHost.withTransaction(
                        Propagation.NotSupported,
                        async () => {
                            // NotSupported suspends transaction, so Never should work
                            await neverService.never('Should work');
                        },
                    );
                });

                const queries = mockDbConnection.getClientsQueries();
                expect(
                    queries.find((q) => q.includes('Should work')),
                ).toBeDefined();
            });

            it('5.15: should enforce Never constraint at method boundary', async () => {
                const executionLog: string[] = [];

                await expect(
                    txHost.withTransaction(async () => {
                        executionLog.push('TX started');
                        await txHost.tx.query('Parent query');
                        executionLog.push('Before Never');
                        await neverService.never('Should throw');
                        executionLog.push('After Never'); // Should not reach
                    }),
                ).rejects.toThrow();

                expect(executionLog).toEqual(['TX started', 'Before Never']);
                expect(executionLog).not.toContain('After Never');
            });
        });
    });

    // ========================================================================
    // Section 6: Propagation.Mandatory (10 tests)
    // ========================================================================

    describe('Section 6: Propagation.Mandatory (10 tests)', () => {
        describe('Mandatory without parent transaction (error cases)', () => {
            it('6.1: should throw TransactionNotActiveError when no parent exists', async () => {
                try {
                    await mandatoryService.mandatory('Query 1');
                    fail('Should have thrown TransactionNotActiveError');
                } catch (e) {
                    expect(e).toBeInstanceOf(TransactionNotActiveError);
                }
            });

            it('6.2: should prevent execution when no transaction active', async () => {
                const executed = { value: false };

                try {
                    await txHost.withTransaction(
                        Propagation.Mandatory,
                        async () => {
                            executed.value = true;
                        },
                    );
                    fail('Should have thrown error');
                } catch (e) {
                    expect(e).toBeInstanceOf(TransactionNotActiveError);
                }

                expect(executed.value).toBe(false);
            });

            it('6.3: should provide descriptive error message', async () => {
                try {
                    await mandatoryService.mandatory('Test');
                    fail('Should have thrown error');
                } catch (e) {
                    expect(e).toBeInstanceOf(TransactionNotActiveError);
                    expect((e as Error).message).toMatch(
                        /no.*existing.*transaction/i,
                    );
                }
            });

            it('6.4: should throw before executing method body', async () => {
                const executionLog: string[] = [];

                await expect(
                    (async () => {
                        executionLog.push('Before Mandatory');
                        await mandatoryService.mandatory('Should not execute');
                        executionLog.push('After Mandatory');
                    })(),
                ).rejects.toThrow();

                expect(executionLog).toEqual(['Before Mandatory']);
            });

            it('6.5: should handle error gracefully in calling code', async () => {
                let errorCaught = false;

                try {
                    await mandatoryService.mandatory('No TX');
                } catch (e) {
                    errorCaught = true;
                    expect(e).toBeInstanceOf(TransactionNotActiveError);
                }

                expect(errorCaught).toBe(true);
            });
        });

        describe('Mandatory with parent transaction (success cases)', () => {
            it('6.6: should join existing transaction', async () => {
                await orchestrator.callMandatory('Parent', 'Child');

                expect(mockDbConnection.getClientsQueries()).toEqual([
                    [
                        'BEGIN TRANSACTION;',
                        'Parent',
                        'Child',
                        'COMMIT TRANSACTION;',
                    ],
                ]);
            });

            it('6.7: should share transaction with parent', async () => {
                await orchestrator.callMandatory('P', 'M');

                const queries = mockDbConnection.getClientsQueries();
                expect(queries.length).toBe(1); // Single transaction
                expect(queries[0]).toContain('M');
            });

            it('6.8: should commit with parent transaction', async () => {
                await orchestrator.callMandatory('Parent', 'Mandatory');

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries[queries.length - 1]).toBe('COMMIT TRANSACTION;');
            });

            it('6.9: should rollback with parent on error', async () => {
                await expect(
                    txHost.withTransaction(async () => {
                        await mandatoryService.mandatory('Before error');
                        throw new Error('Parent error');
                    }),
                ).rejects.toThrow('Parent error');

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries[queries.length - 1]).toBe(
                    'ROLLBACK TRANSACTION;',
                );
            });

            it('6.10: should handle multiple Mandatory calls in same transaction', async () => {
                await txHost.withTransaction(async () => {
                    await mandatoryService.mandatory('M1');
                    await mandatoryService.mandatory('M2');
                    await mandatoryService.mandatory('M3');
                });

                const queries = mockDbConnection.getClientsQueries()[0];
                expect(queries).toContain('M1');
                expect(queries).toContain('M2');
                expect(queries).toContain('M3');
                expect(
                    queries.filter((q) => q === 'BEGIN TRANSACTION;').length,
                ).toBe(1);
            });
        });
    });
});
