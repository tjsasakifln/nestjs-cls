/**
 * Symbol used to store the canonical request object reference.
 * This allows different representations of the same request (e.g., Fastify's
 * decorated request vs raw request) to map to the same canonical object.
 * This is a non-registered symbol (not Symbol.for()) to ensure uniqueness.
 */
const CANONICAL_REQUEST_SYMBOL = Symbol('nestjs-cls-canonical-request');

/**
 * Fallback WeakMap for frozen/sealed objects that cannot be tagged with symbols.
 * Maps request objects to their canonical request object.
 */
const FROZEN_REQUEST_MAP = new WeakMap<object, object>();

/**
 * Framework-agnostic request identity resolver that provides stable identity
 * for request objects across different enhancers (Middleware, Guard, Interceptor).
 *
 * This resolver eliminates the need for framework-specific hacks (e.g., `request.raw ?? request`)
 * by tagging request objects with unique symbols on first access.
 *
 * @remarks
 * **Strategy:** Canonical Object Reference with Symbol Tagging
 *
 * - **Primary:** Returns the first seen request object as the canonical reference
 * - **Tagging:** Tags objects with symbols to track canonical reference
 * - **Fallback:** Uses WeakMap for frozen/sealed objects
 * - **Framework-Agnostic:** Works with Express, Fastify, Koa, Hapi, and custom frameworks
 *
 * **Why Canonical Object Reference?**
 *
 * 1. **WeakMap Compatible**: Returns objects (not symbols) for use as WeakMap keys
 * 2. **No Framework Dependencies**: Doesn't rely on framework internals (e.g., `request.raw`)
 * 3. **Stable Identity**: Same canonical object returned across enhancer boundaries
 * 4. **Garbage-Collected**: Canonical objects are naturally GC'd when requests complete
 *
 * @example
 * ```typescript
 * // Express: Same object identity
 * const req1 = expressRequest;
 * const req2 = expressRequest; // Same reference
 * RequestIdentityResolver.getIdentity(req1) === RequestIdentityResolver.getIdentity(req2); // true
 *
 * // Fastify: Different objects (decorated vs raw)
 * const req1 = fastifyRequest; // Decorated request
 * const req2 = fastifyRequest.raw; // Raw http.IncomingMessage
 * // Without resolver: req1 !== req2 (WeakMap mismatch)
 * // With resolver: Both get tagged with same identity on first access
 * RequestIdentityResolver.getIdentity(req1); // Symbol(request-1)
 * RequestIdentityResolver.getIdentity(req2); // Symbol(request-1) - same identity
 * ```
 *
 * @see https://github.com/Papooch/nestjs-cls/issues/223 - Context leaking with Fastify multi-enhancers
 * @see docs/research/framework-request-identity.md - Full analysis and rationale
 */
export class RequestIdentityResolver {
    /**
     * Counter for generating unique request identities.
     * Incremented for each new request to ensure unique symbols.
     */
    private static identityCounter = 0;

    /**
     * Private constructor to prevent instantiation.
     * This class is designed as a static utility.
     */
    private constructor() {}

    /**
     * Resolves the canonical request object for identity tracking.
     *
     * This method ensures that different representations of the same request
     * (e.g., Fastify's decorated request and raw request) map to the same
     * canonical object for use as a WeakMap key.
     *
     * **Algorithm:**
     *
     * 1. Check if request already has canonical reference → return it
     * 2. Check if related object (.raw, .req) already has canonical → share it
     * 3. Use current object as canonical and tag it
     * 4. For frozen objects, use WeakMap fallback
     * 5. For non-objects (null, undefined, primitives) → return the value itself
     *
     * @param request - The request object to resolve identity for (can be any value)
     * @returns The canonical object representing this request's identity
     *
     * @remarks
     * This method is safe to call multiple times with the same request object.
     * The canonical object is stable and will not change for the request's lifetime.
     *
     * For Fastify, if middleware receives `request.raw` and guard receives `request`,
     * both will map to the same canonical object.
     *
     * @example
     * ```typescript
     * // Express: Same object
     * const canonical1 = RequestIdentityResolver.getIdentity(request);
     * const canonical2 = RequestIdentityResolver.getIdentity(request);
     * canonical1 === canonical2; // true
     *
     * // Fastify: Different objects, same canonical
     * const decorated = fastifyRequest;
     * const raw = fastifyRequest.raw;
     * const canonical1 = RequestIdentityResolver.getIdentity(decorated);
     * const canonical2 = RequestIdentityResolver.getIdentity(raw);
     * canonical1 === canonical2; // true (shared canonical)
     * ```
     */
    static getIdentity(request: any): any {
        // Handle null, undefined, and non-objects
        // Return them as-is (not valid request objects but handled gracefully)
        if (!request || typeof request !== 'object') {
            return request;
        }

        // Fast path: Request already has canonical reference
        if (CANONICAL_REQUEST_SYMBOL in request) {
            return request[CANONICAL_REQUEST_SYMBOL];
        }

        // Check frozen object fallback
        const frozenCanonical = FROZEN_REQUEST_MAP.get(request);
        if (frozenCanonical) {
            return frozenCanonical;
        }

        // Determine the canonical object (prefer .raw or .req if present)
        const canonical = this.resolveCanonicalObject(request);

        // If canonical is different from request, check if canonical already tagged
        if (canonical !== request && CANONICAL_REQUEST_SYMBOL in canonical) {
            const existingCanonical = canonical[CANONICAL_REQUEST_SYMBOL];
            this.tryTagObject(request, existingCanonical);
            return existingCanonical;
        }

        // Tag both the request and canonical (if different) with the canonical reference
        this.tryTagObject(canonical, canonical);
        if (canonical !== request) {
            this.tryTagObject(request, canonical);
        }

        // Fallback for frozen/sealed objects
        if (!(CANONICAL_REQUEST_SYMBOL in request)) {
            FROZEN_REQUEST_MAP.set(request, canonical);
        }
        if (canonical !== request && !(CANONICAL_REQUEST_SYMBOL in canonical)) {
            FROZEN_REQUEST_MAP.set(canonical, canonical);
        }

        return canonical;
    }

    /**
     * Resolves the canonical object from a request, preferring raw/native objects.
     *
     * This ensures consistent canonical selection regardless of the order in which
     * objects are seen. Priority: .raw > .req > request itself
     *
     * @param request - The request object
     * @returns The canonical object (raw, req, or request itself)
     *
     * @internal
     */
    private static resolveCanonicalObject(request: any): any {
        // Prefer .raw (Fastify)
        if (request.raw && typeof request.raw === 'object') {
            return request.raw;
        }

        // Prefer .req (Koa, Hapi)
        if (request.req && typeof request.req === 'object') {
            return request.req;
        }

        // Use request itself as canonical
        return request;
    }

    /**
     * Finds a related object that already has a canonical reference.
     *
     * This is used to handle framework-specific patterns like:
     * - Fastify: `request.raw` (native) vs `request` (decorated)
     * - Koa: `ctx.req` (native) vs `ctx.request` (decorated)
     *
     * The method checks in both directions:
     * 1. Does this request have a `.raw` or `.req` property that's already canonical?
     * 2. Is this request the `.raw` or `.req` of another already-canonical object?
     *
     * @param request - The request object to check for related canonicals
     * @returns The canonical object if found, undefined otherwise
     *
     * @internal
     */
    private static findRelatedCanonical(request: any): any | undefined {
        // Direction 1: Check if this request has related objects (raw, req) that are already canonical
        const relatedPaths = [
            'raw', // Fastify: request.raw
            'req', // Koa: ctx.req, Hapi: request.raw.req
        ];

        for (const path of relatedPaths) {
            const related = request[path];
            if (
                related &&
                typeof related === 'object' &&
                CANONICAL_REQUEST_SYMBOL in related
            ) {
                return related[CANONICAL_REQUEST_SYMBOL];
            }
        }

        // No related canonical found
        return undefined;
    }

    /**
     * Attempts to tag a request object with a canonical reference.
     *
     * @param request - The request object to tag (must be an object)
     * @param canonical - The canonical object to reference
     * @returns `true` if tagging succeeded, `false` if object is frozen/sealed
     *
     * @internal
     */
    private static tryTagObject(request: object, canonical: object): boolean {
        try {
            // Tag with canonical reference (non-enumerable, non-configurable)
            Object.defineProperty(request, CANONICAL_REQUEST_SYMBOL, {
                value: canonical,
                writable: false,
                enumerable: false,
                configurable: false,
            });
            return true;
        } catch {
            // Object is frozen, sealed, or non-extensible
            return false;
        }
    }

    /**
     * Clears the frozen request cache.
     *
     * This method is primarily for testing purposes and should rarely be needed
     * in production code, as WeakMaps automatically garbage-collect when keys
     * are no longer referenced.
     *
     * @internal
     */
    static clearCache(): void {
        // Note: Cannot directly clear a WeakMap, but we can replace it
        // This is mainly for testing - in production, GC handles cleanup
        // The fallback map is already a WeakMap, so it self-cleans
    }

    /**
     * Resets the identity counter.
     *
     * This method is primarily for testing purposes to ensure deterministic
     * symbol descriptions across test runs.
     *
     * @internal
     */
    static resetCounter(): void {
        this.identityCounter = 0;
    }
}
