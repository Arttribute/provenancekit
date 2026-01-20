/**
 * Generic extension utilities.
 *
 * These helpers work with any object that has an extensions field,
 * allowing you to add/get/check custom extensions without specific schemas.
 *
 * For type-safe operations, use the specific extension helpers
 * (withContrib, getLicense, etc.).
 */

/** Type for objects that can have extensions */
export type Extensible = { extensions?: Record<string, unknown> };

/**
 * Add any extension to any extensible object.
 *
 * Use this for custom extensions not covered by the standard schemas.
 *
 * @param obj - The object to extend
 * @param namespace - Extension namespace (e.g., "ext:myorg:custom@1.0.0")
 * @param data - Extension data
 * @returns Object with the extension added
 *
 * @example
 * ```typescript
 * const resource = withExtension(res, "ext:myorg:audit@1.0.0", {
 *   auditor: "bob",
 *   passed: true,
 * });
 * ```
 */
export function withExtension<T extends Extensible>(
  obj: T,
  namespace: string,
  data: unknown
): T {
  return {
    ...obj,
    extensions: { ...obj.extensions, [namespace]: data },
  };
}

/**
 * Get extension data from any extensible object.
 *
 * @param obj - The object to read from
 * @param namespace - Extension namespace
 * @returns Extension data or undefined
 *
 * @example
 * ```typescript
 * const audit = getExtension<AuditData>(resource, "ext:myorg:audit@1.0.0");
 * ```
 */
export function getExtension<E = unknown>(
  obj: Extensible,
  namespace: string
): E | undefined {
  return obj.extensions?.[namespace] as E | undefined;
}

/**
 * Check if an object has a specific extension.
 *
 * @param obj - The object to check
 * @param namespace - Extension namespace
 * @returns True if the extension exists
 */
export function hasExtension(obj: Extensible, namespace: string): boolean {
  return obj.extensions?.[namespace] !== undefined;
}

/**
 * Remove an extension from an object.
 *
 * @param obj - The object to modify
 * @param namespace - Extension namespace to remove
 * @returns Object without the specified extension
 *
 * @example
 * ```typescript
 * const cleaned = withoutExtension(resource, "ext:temp@1.0.0");
 * ```
 */
export function withoutExtension<T extends Extensible>(
  obj: T,
  namespace: string
): T {
  if (!obj.extensions || !(namespace in obj.extensions)) return obj;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [namespace]: _, ...rest } = obj.extensions;
  return { ...obj, extensions: rest };
}

/**
 * Get all extension namespaces from an object.
 *
 * @param obj - The object to read from
 * @returns Array of extension namespaces
 *
 * @example
 * ```typescript
 * const namespaces = getExtensionKeys(resource);
 * // ["ext:contrib@1.0.0", "ext:license@1.0.0"]
 * ```
 */
export function getExtensionKeys(obj: Extensible): string[] {
  return Object.keys(obj.extensions ?? {});
}

/**
 * Merge multiple extensions into an object.
 *
 * @param obj - The object to extend
 * @param extensions - Map of namespace to data
 * @returns Object with all extensions added
 *
 * @example
 * ```typescript
 * const extended = withExtensions(resource, {
 *   "ext:contrib@1.0.0": { weight: 6000 },
 *   "ext:license@1.0.0": { type: "MIT" },
 * });
 * ```
 */
export function withExtensions<T extends Extensible>(
  obj: T,
  extensions: Record<string, unknown>
): T {
  return {
    ...obj,
    extensions: { ...obj.extensions, ...extensions },
  };
}

/**
 * Copy extensions from one object to another.
 *
 * @param from - Source object
 * @param to - Target object
 * @param namespaces - Optional list of namespaces to copy (copies all if not specified)
 * @returns Target object with copied extensions
 */
export function copyExtensions<T extends Extensible>(
  from: Extensible,
  to: T,
  namespaces?: string[]
): T {
  if (!from.extensions) return to;

  const toCopy = namespaces
    ? Object.fromEntries(
        namespaces
          .filter((ns) => ns in from.extensions!)
          .map((ns) => [ns, from.extensions![ns]])
      )
    : from.extensions;

  return {
    ...to,
    extensions: { ...to.extensions, ...toCopy },
  };
}

/**
 * Validate that an extension namespace follows the correct format.
 *
 * Format: `ext:namespace[@version]`
 *
 * @param namespace - The namespace to validate
 * @returns True if valid
 *
 * @example
 * ```typescript
 * isValidNamespace("ext:contrib@1.0.0");  // true
 * isValidNamespace("ext:myorg:custom");   // true
 * isValidNamespace("invalid");            // false
 * ```
 */
export function isValidNamespace(namespace: string): boolean {
  return /^ext:[a-zA-Z]\w*(?::\w+)*(?:@\d+\.\d+\.\d+)?$/.test(namespace);
}
