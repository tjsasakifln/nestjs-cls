import { ContextType, ExecutionContext } from '@nestjs/common';
import { ClsStore } from '../../cls.options';
import { RequestIdentityResolver } from './request-identity-resolver';

/**
 * This static class can be used to save the CLS store in a WeakMap based on the ExecutionContext
 * or any object that is passed to the `setByRawContext` method.
 *
 * It is used internally by the `ClsMiddleware`, `ClsInterceptor` and `ClsGuard` to prevent
 * instantiating the context multiple times for the same request.
 *
 * It can also be used as an escape hatch to retrieve the CLS store based on the ExecutionContext
 * or the "raw context" when the ExecutionContext is not available.
 * * For HTTP, it is the Request (@Req) object
 * * For WS, it is the data object
 * * For RPC (microservices), it is the RpcContext (@Ctx) object
 * * For GraphQL, it is the GqlContext object
 *
 * Implementation uses a hybrid Symbol+WeakMap strategy for robust object identity tracking:
 * - Primary: Symbol tagging (works with Proxies, wrapper chains, and most transformations)
 * - Fallback: WeakMap (for frozen/sealed objects that cannot accept Symbol properties)
 *
 * This approach solves issues with Proxy wrappers, Object.create() clones, and other
 * transformations that break strict WeakMap identity comparison.
 *
 * @see Issue #9 - Replace WeakMap-only tracking with hybrid Symbol+WeakMap strategy
 * @see Issue #129 - Context Leaking (ClsGuard)
 * @see docs/research/weakmap-identity-pitfalls.md
 */
export class ContextClsStoreMap {
    /**
     * Global symbol used for tagging objects with their CLS store.
     * Uses Symbol.for() to ensure the same symbol is used across modules and dynamic imports.
     * The double underscore prefix (__) follows the convention for internal/private symbols.
     *
     * This symbol is:
     * - Non-enumerable (won't appear in Object.keys() or JSON.stringify())
     * - Proxy-transparent (accessible through Proxy wrappers)
     * - Globally unique (via Symbol.for() registry)
     */
    private static readonly CLS_STORE_SYMBOL = Symbol.for(
        '__nestjs_cls_store__',
    );

    /**
     * Fallback WeakMap for objects that cannot accept Symbol properties
     * (frozen, sealed, or non-extensible objects).
     */
    private static readonly contextMap = new WeakMap<any, ClsStore>();

    private constructor() {}

    static set(context: ExecutionContext, value: ClsStore): void {
        const ctx = this.getContextByType(context);
        this.setByRaw(ctx, value);
    }

    static get(context: ExecutionContext): ClsStore | undefined {
        const ctx = this.getContextByType(context);
        return this.getByRaw(ctx);
    }

    /**
     * Store a CLS store associated with the given raw context object.
     *
     * Primary strategy: Tag the object with a Symbol property.
     * Fallback strategy: Use WeakMap if Symbol tagging fails (frozen/sealed objects).
     *
     * @param ctx - The raw context object (request, WS data, RPC context, etc.)
     * @param value - The CLS store to associate with the context
     */
    static setByRaw(ctx: any, value: ClsStore): void {
        if (ctx == null) {
            return; // Guard against null/undefined contexts
        }

        try {
            // Primary: Tag with Symbol (works with Proxies, wrappers, etc.)
            ctx[this.CLS_STORE_SYMBOL] = value;
        } catch (_e) {
            // Fallback: Object is frozen/sealed/non-extensible, use WeakMap
            this.contextMap.set(ctx, value);
        }
    }

    /**
     * Retrieve the CLS store associated with the given raw context object.
     *
     * Primary strategy: Check for Symbol property (handles Proxies transparently).
     * Fallback strategy: Check WeakMap if Symbol not found (frozen/sealed objects).
     *
     * @param ctx - The raw context object (request, WS data, RPC context, etc.)
     * @returns The associated CLS store, or undefined if not found
     */
    static getByRaw(ctx: any): ClsStore | undefined {
        if (ctx == null) {
            return undefined; // Guard against null/undefined contexts
        }

        // Primary: Check Symbol property (transparently works through Proxy wrappers)
        const symbolStore = ctx[this.CLS_STORE_SYMBOL];
        if (symbolStore !== undefined) {
            return symbolStore;
        }

        // Fallback: Check WeakMap (for frozen/sealed objects)
        return this.contextMap.get(ctx);
    }

    private static getContextByType(context: ExecutionContext): any {
        switch (context.getType() as ContextType | 'graphql') {
            case 'http':
                const request = context.switchToHttp().getRequest();
                // Use framework-agnostic request identity resolution
                // This eliminates the need for framework-specific hacks (e.g., request.raw ?? request)
                // and works consistently across Express, Fastify, Koa, and other frameworks.
                // @see RequestIdentityResolver for implementation details
                return RequestIdentityResolver.getIdentity(request);
            case 'ws':
                return context.switchToWs();
            case 'rpc':
                return context.switchToRpc().getContext();
            case 'graphql':
                // As per the GqlExecutionContext, the context is the second argument
                return context.getArgByIndex(2);
            default:
                return {};
        }
    }
}
