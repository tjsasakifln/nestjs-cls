import { ContextClsStoreMap } from './context-cls-store-map';
import { ClsStore } from '../../cls.options';
import { ExecutionContext } from '@nestjs/common';

describe('ContextClsStoreMap', () => {
    let store: ClsStore;

    beforeEach(() => {
        store = { user: 'test-user' } as any;
    });

    describe('Symbol+WeakMap Hybrid Strategy', () => {
        it('should use Symbol tagging for regular objects', () => {
            const obj = { id: 'test' };
            ContextClsStoreMap.setByRaw(obj, store);

            // Verify Symbol was set
            const CLS_STORE_SYMBOL = Symbol.for('__nestjs_cls_store__');
            expect(obj[CLS_STORE_SYMBOL]).toBe(store);

            // Verify retrieval works
            const retrieved = ContextClsStoreMap.getByRaw(obj);
            expect(retrieved).toBe(store);
        });

        it('should use WeakMap fallback for frozen objects', () => {
            const frozen = Object.freeze({ id: 'frozen' });
            ContextClsStoreMap.setByRaw(frozen, store);

            // Symbol cannot be set on frozen object
            const CLS_STORE_SYMBOL = Symbol.for('__nestjs_cls_store__');
            expect(frozen[CLS_STORE_SYMBOL]).toBeUndefined();

            // But retrieval works via WeakMap fallback
            const retrieved = ContextClsStoreMap.getByRaw(frozen);
            expect(retrieved).toBe(store);
        });

        it('should work transparently through Proxy wrappers', () => {
            const obj = { id: 'test' };
            ContextClsStoreMap.setByRaw(obj, store);

            const proxied = new Proxy(obj, {
                get(target, prop) {
                    return target[prop];
                },
            });

            const retrieved = ContextClsStoreMap.getByRaw(proxied);
            expect(retrieved).toBe(store);
        });
    });

    describe('Null/Undefined Handling', () => {
        it('should handle null context in setByRaw', () => {
            // Should not throw
            expect(() => {
                ContextClsStoreMap.setByRaw(null, store);
            }).not.toThrow();
        });

        it('should handle undefined context in setByRaw', () => {
            // Should not throw
            expect(() => {
                ContextClsStoreMap.setByRaw(undefined, store);
            }).not.toThrow();
        });

        it('should return undefined for null context in getByRaw', () => {
            const retrieved = ContextClsStoreMap.getByRaw(null);
            expect(retrieved).toBeUndefined();
        });

        it('should return undefined for undefined context in getByRaw', () => {
            const retrieved = ContextClsStoreMap.getByRaw(undefined);
            expect(retrieved).toBeUndefined();
        });
    });

    describe('ExecutionContext Integration', () => {
        it('should handle HTTP context type', () => {
            const request = { url: '/test' };
            const mockContext = {
                getType: () => 'http',
                switchToHttp: () => ({
                    getRequest: () => request,
                }),
            } as any as ExecutionContext;

            ContextClsStoreMap.set(mockContext, store);
            const retrieved = ContextClsStoreMap.get(mockContext);

            expect(retrieved).toBe(store);
        });

        it('should handle WS context type', () => {
            const wsContext = { data: 'ws-data' };
            const mockContext = {
                getType: () => 'ws',
                switchToWs: () => wsContext,
            } as any as ExecutionContext;

            ContextClsStoreMap.set(mockContext, store);
            const retrieved = ContextClsStoreMap.get(mockContext);

            expect(retrieved).toBe(store);
        });

        it('should handle RPC context type', () => {
            const rpcContext = { rpc: 'context' };
            const mockContext = {
                getType: () => 'rpc',
                switchToRpc: () => ({
                    getContext: () => rpcContext,
                }),
            } as any as ExecutionContext;

            ContextClsStoreMap.set(mockContext, store);
            const retrieved = ContextClsStoreMap.get(mockContext);

            expect(retrieved).toBe(store);
        });

        it('should handle GraphQL context type', () => {
            const gqlContext = { gql: 'context' };
            const mockContext = {
                getType: () => 'graphql',
                getArgByIndex: (index: number) => (index === 2 ? gqlContext : null),
            } as any as ExecutionContext;

            ContextClsStoreMap.set(mockContext, store);
            const retrieved = ContextClsStoreMap.get(mockContext);

            expect(retrieved).toBe(store);
        });

        it('should handle unknown/default context type (returns new object each time)', () => {
            const mockContext = {
                getType: () => 'unknown',
            } as any as ExecutionContext;

            ContextClsStoreMap.set(mockContext, store);
            const retrieved = ContextClsStoreMap.get(mockContext);

            // Default context returns {} which is a new object each time
            // So the store cannot be retrieved (expected behavior for unknown types)
            expect(retrieved).toBeUndefined();
        });
    });

    describe('Symbol+WeakMap Interaction', () => {
        it('should prefer Symbol over WeakMap when both could apply', () => {
            const obj = { id: 'test' };

            // Set via Symbol
            ContextClsStoreMap.setByRaw(obj, store);

            // Symbol should be checked first
            const retrieved = ContextClsStoreMap.getByRaw(obj);
            expect(retrieved).toBe(store);

            // Verify it's using Symbol, not WeakMap
            const CLS_STORE_SYMBOL = Symbol.for('__nestjs_cls_store__');
            expect(obj[CLS_STORE_SYMBOL]).toBe(store);
        });

        it('should return undefined for object without store', () => {
            const obj = { id: 'test' };
            const retrieved = ContextClsStoreMap.getByRaw(obj);
            expect(retrieved).toBeUndefined();
        });
    });
});
