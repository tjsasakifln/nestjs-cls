import { ProxyProviderManager } from './proxy-provider-manager';
import { getProxyProviderSymbol } from './get-proxy-provider-symbol';

/**
 * Facade for resolving Proxy Providers.
 *
 * This facade provides a clean public API for proxy resolution without
 * creating circular dependencies with ClsService.
 *
 * @example
 * ```typescript
 * import { ProxyResolutionFacade } from 'nestjs-cls';
 *
 * // Resolve all proxy providers
 * await ProxyResolutionFacade.resolveProxyProviders();
 *
 * // Resolve specific proxy providers
 * await ProxyResolutionFacade.resolveProxyProviders([MyService, AnotherService]);
 * ```
 */
export class ProxyResolutionFacade {
    /**
     * Manually trigger resolution of Proxy Providers.
     *
     * This is useful when you need to resolve proxy providers manually,
     * especially when `resolveProxyProviders` is not enabled in the enhancer
     * configuration.
     *
     * @param proxyTokens An optional array of Proxy Provider injection tokens
     * to resolve. If not supplied, resolves all registered proxy providers.
     *
     * @returns A promise that resolves when all proxy providers are resolved.
     */
    static async resolveProxyProviders(proxyTokens?: any[]): Promise<void> {
        const proxySymbols = proxyTokens
            ? proxyTokens.map(getProxyProviderSymbol)
            : [];
        await ProxyProviderManager.resolveProxyProviders(proxySymbols);
    }
}
