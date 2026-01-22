import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { ClsPluginTransactional, TransactionHost } from '../../src';
import {
    MockDbConnection,
    TransactionAdapterMock,
} from '../transaction-adapter-mock';
import { Test, TestingModule } from '@nestjs/testing';

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
})
class AppModule {}

describe('Nested transactions - edge cases', () => {
    let module: TestingModule;
    let txHost: TransactionHost<TransactionAdapterMock>;
    let mockDbConnection: MockDbConnection;

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();
        await module.init();
        txHost = module.get(TransactionHost);
        mockDbConnection = module.get(MockDbConnection);
    });

    describe('When a transaction is inherited in a non-awaited function', () => {
        it('Should create an isolated transaction context that completes independently', async () => {
            const childTransaction = () =>
                txHost.withTransaction(async () => {
                    await txHost.tx.query('SELECT Child 1');
                    // simulate delay in the child transaction
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    await txHost.tx.query('SELECT Child 2');
                });
            let childPromise: Promise<void> | undefined = undefined;
            const parentTransaction = () =>
                txHost.withTransaction(async () => {
                    await txHost.tx.query('SELECT Parent 1');
                    childPromise = childTransaction(); // not awaited
                    // the parent transaction ends here
                });

            await parentTransaction();

            // With isolated context, child has its own transaction and completes successfully
            await expect(childPromise).resolves.not.toThrow();

            // Parent and child now have separate transactions
            expect(mockDbConnection.getClientsQueries()).toEqual([
                // Parent transaction
                [
                    'BEGIN TRANSACTION;',
                    'SELECT Parent 1',
                    'COMMIT TRANSACTION;',
                ],
                // Child transaction (independent)
                [
                    'BEGIN TRANSACTION;',
                    'SELECT Child 1',
                    'SELECT Child 2',
                    'COMMIT TRANSACTION;',
                ],
            ]);
        });
    });
});
