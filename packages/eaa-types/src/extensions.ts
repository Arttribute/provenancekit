import { z } from "zod";

/*─────────────────────────────────────────────────────────────*\
 | ProvenanceKit Extension System                                |
 |                                                               |
 | Allows domain-specific functionality to be added to base      |
 | types without polluting the core provenance model.            |
\*─────────────────────────────────────────────────────────────*/

/**
 * Extension key validation
 * Format: ext:namespace@version
 * Example: ext:x402@1.0.0, ext:myorg:payments@2.1.0
 */
const extensionKeyRegex = /^ext:[a-zA-Z]\w*(?::\w+)*@\d+\.\d+\.\d+$/;

/**
 * Extension definition metadata
 */
export interface ExtensionDefinition {
  /** Unique key: ext:namespace@version */
  readonly key: string;

  /** Human-readable name */
  readonly name: string;

  /** Which base type this extends */
  readonly extends: "Entity" | "Resource" | "Action" | "Attribution" | "Bundle";

  /** Zod schema for validation */
  readonly schema: z.ZodSchema;

  /** Documentation/description */
  readonly description?: string;

  /** URL to extension spec/documentation */
  readonly url?: string;
}

/**
 * Extension Registry
 *
 * Manages all known extensions. Applications can register
 * extensions to enable validation and type checking.
 */
export class ExtensionRegistry {
  private readonly extensions = new Map<string, ExtensionDefinition>();

  /**
   * Register an extension
   * @throws Error if extension key is invalid or already registered
   */
  register(ext: ExtensionDefinition): void {
    // Validate key format
    if (!extensionKeyRegex.test(ext.key)) {
      throw new Error(
        `Invalid extension key: ${ext.key}. Must match format: ext:namespace@version`
      );
    }

    // Check for duplicates
    if (this.extensions.has(ext.key)) {
      throw new Error(`Extension ${ext.key} is already registered`);
    }

    this.extensions.set(ext.key, ext);
  }

  /**
   * Get extension by exact key
   */
  get(key: string): ExtensionDefinition | undefined {
    return this.extensions.get(key);
  }

  /**
   * Find all extensions for a base type
   */
  forType(type: ExtensionDefinition["extends"]): ExtensionDefinition[] {
    return Array.from(this.extensions.values()).filter(
      (ext) => ext.extends === type
    );
  }

  /**
   * Validate extension data against its schema
   */
  validate(key: string, data: unknown): boolean {
    const ext = this.extensions.get(key);
    if (!ext) {
      return false;
    }
    return ext.schema.safeParse(data).success;
  }

  /**
   * Get validation errors for extension data
   */
  getErrors(key: string, data: unknown): z.ZodError | null {
    const ext = this.extensions.get(key);
    if (!ext) {
      throw new Error(`Extension ${key} not found`);
    }

    const result = ext.schema.safeParse(data);
    return result.success ? null : result.error;
  }

  /**
   * List all registered extensions
   */
  list(): ExtensionDefinition[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Get latest version of an extension by namespace
   * @param namespace Extension namespace (e.g., "ext:x402")
   * @returns Latest version or undefined
   */
  latest(namespace: string): ExtensionDefinition | undefined {
    const ns = namespace.startsWith("ext:") ? namespace : `ext:${namespace}`;
    const matching = Array.from(this.extensions.values()).filter((ext) =>
      ext.key.startsWith(`${ns}@`)
    );

    if (matching.length === 0) {
      return undefined;
    }

    // Sort by version (semantic versioning)
    return matching.sort((a, b) =>
      b.key.localeCompare(a.key, undefined, { numeric: true })
    )[0];
  }

  /**
   * Check if extension is registered
   */
  has(key: string): boolean {
    return this.extensions.has(key);
  }

  /**
   * Clear all extensions (mainly for testing)
   */
  clear(): void {
    this.extensions.clear();
  }
}

/**
 * Global extension registry instance
 * Import and use this to register extensions
 */
export const registry = new ExtensionRegistry();

/*─────────────────────────────────────────────────────────────*\
 | Extension Helper Functions                                    |
\*─────────────────────────────────────────────────────────────*/

/**
 * Type for objects that support extensions
 */
export interface Extensible {
  extensions?: Record<string, unknown>;
}

/**
 * Get extension data from an object
 *
 * @param obj Object with extensions field
 * @param key Extension key
 * @returns Extension data or undefined
 *
 * @example
 * const payment = getExtension(entity, "ext:x402@1.0.0");
 */
export function getExtension<T = unknown>(
  obj: Extensible,
  key: string
): T | undefined {
  if (!obj.extensions) {
    return undefined;
  }
  return obj.extensions[key] as T | undefined;
}

/**
 * Set extension data on an object
 *
 * @param obj Object to add extension to
 * @param key Extension key
 * @param data Extension data
 *
 * @example
 * setExtension(entity, "ext:x402@1.0.0", { wallet: "0x..." });
 */
export function setExtension<T>(obj: Extensible, key: string, data: T): void {
  if (!obj.extensions) {
    obj.extensions = {};
  }
  obj.extensions[key] = data;
}

/**
 * Check if object has an extension
 *
 * @param obj Object to check
 * @param key Extension key
 * @returns True if extension exists
 */
export function hasExtension(obj: Extensible, key: string): boolean {
  return !!(obj.extensions && key in obj.extensions);
}

/**
 * Remove extension from an object
 *
 * @param obj Object to remove extension from
 * @param key Extension key
 * @returns True if extension was removed
 */
export function removeExtension(obj: Extensible, key: string): boolean {
  if (!obj.extensions || !(key in obj.extensions)) {
    return false;
  }
  delete obj.extensions[key];
  return true;
}

/**
 * Get all extension keys from an object
 *
 * @param obj Object with extensions
 * @returns Array of extension keys
 */
export function getExtensionKeys(obj: Extensible): string[] {
  if (!obj.extensions) {
    return [];
  }
  return Object.keys(obj.extensions);
}

/**
 * Validate all extensions on an object against registered schemas
 *
 * @param obj Object with extensions
 * @returns Array of validation errors (empty if all valid)
 */
export function validateExtensions(obj: Extensible): Array<{
  key: string;
  error: z.ZodError | string;
}> {
  const errors: Array<{ key: string; error: z.ZodError | string }> = [];

  if (!obj.extensions) {
    return errors;
  }

  for (const [key, data] of Object.entries(obj.extensions)) {
    const ext = registry.get(key);

    if (!ext) {
      // Extension not registered - could be warning or error depending on policy
      continue;
    }

    const validationError = registry.getErrors(key, data);
    if (validationError) {
      errors.push({ key, error: validationError });
    }
  }

  return errors;
}

/**
 * Clone an object and its extensions
 *
 * @param obj Object to clone
 * @returns Deep clone with extensions
 */
export function cloneWithExtensions<T extends Extensible>(obj: T): T {
  return {
    ...obj,
    extensions: obj.extensions ? { ...obj.extensions } : undefined,
  };
}

/*─────────────────────────────────────────────────────────────*\
 | Extension Utilities                                           |
\*─────────────────────────────────────────────────────────────*/

/**
 * Merge extensions from multiple objects
 * Later objects override earlier ones
 *
 * @param objects Objects to merge extensions from
 * @returns Merged extensions object
 */
export function mergeExtensions(
  ...objects: Extensible[]
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  for (const obj of objects) {
    if (obj.extensions) {
      Object.assign(merged, obj.extensions);
    }
  }

  return merged;
}

/**
 * Filter extensions by namespace prefix
 *
 * @param obj Object with extensions
 * @param namespace Namespace prefix (e.g., "ext:x402")
 * @returns Filtered extensions
 */
export function filterExtensionsByNamespace(
  obj: Extensible,
  namespace: string
): Record<string, unknown> {
  if (!obj.extensions) {
    return {};
  }

  const filtered: Record<string, unknown> = {};
  const prefix = namespace.endsWith("@") ? namespace : `${namespace}@`;

  for (const [key, value] of Object.entries(obj.extensions)) {
    if (key.startsWith(prefix)) {
      filtered[key] = value;
    }
  }

  return filtered;
}
