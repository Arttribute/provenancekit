/**
 * C2PA extension (ext:c2pa@1.0.0) for ProvenanceKit.
 *
 * Provides type-safe helpers for attaching C2PA content credentials
 * to EAA Resource objects.
 *
 * @packageDocumentation
 */

import { z } from "zod";
import type { MediaResource as Resource } from "./types.js";
import { C2PA_NAMESPACE, C2PAExtension } from "./types.js";

export { C2PA_NAMESPACE, C2PAExtension };

/*─────────────────────────────────────────────────────────────*\
 | Helper Functions                                             |
\*─────────────────────────────────────────────────────────────*/

/**
 * Add C2PA extension to a resource.
 *
 * @param resource - The resource to extend
 * @param c2pa - C2PA content credentials data
 * @returns Resource with C2PA extension
 *
 * @example
 * ```typescript
 * const resource = withC2PA(res, {
 *   manifestLabel: "urn:uuid:12345",
 *   claimGenerator: "ProvenanceKit/1.0",
 *   title: "My Photo",
 *   format: "image/jpeg",
 *   actions: [{
 *     action: "c2pa.created",
 *     softwareAgent: { name: "Camera App" },
 *   }],
 * });
 * ```
 */
export function withC2PA(
  resource: Resource,
  c2pa: z.input<typeof C2PAExtension>
): Resource {
  const validated = C2PAExtension.parse(c2pa);
  return {
    ...resource,
    extensions: {
      ...resource.extensions,
      [C2PA_NAMESPACE]: validated,
    },
  };
}

/**
 * Get C2PA extension from a resource.
 *
 * @param resource - The resource to read from
 * @returns C2PA extension data or undefined if not present
 */
export function getC2PA(resource: Resource): C2PAExtension | undefined {
  const data = resource.extensions?.[C2PA_NAMESPACE];
  if (!data) return undefined;
  return C2PAExtension.parse(data);
}

/**
 * Check if a resource has C2PA content credentials.
 *
 * @param resource - The resource to check
 * @returns True if C2PA extension exists
 */
export function hasC2PA(resource: Resource): boolean {
  return resource.extensions?.[C2PA_NAMESPACE] !== undefined;
}

/**
 * Get the manifest label from a resource's C2PA extension.
 *
 * @param resource - The resource to read from
 * @returns Manifest label or undefined
 */
export function getManifestLabel(resource: Resource): string | undefined {
  return getC2PA(resource)?.manifestLabel;
}

/**
 * Check if the C2PA manifest is valid.
 *
 * @param resource - The resource to check
 * @returns True if manifest is valid, false if invalid or not present
 */
export function isC2PAValid(resource: Resource): boolean {
  const c2pa = getC2PA(resource);
  return c2pa?.validationStatus?.isValid === true;
}

/**
 * Check if the content has AI disclosure.
 *
 * @param resource - The resource to check
 * @returns True if AI-generated flag is set
 */
export function isAIGenerated(resource: Resource): boolean {
  return getC2PA(resource)?.aiDisclosure?.isAIGenerated === true;
}

/**
 * Get the AI tool used (if disclosed).
 *
 * @param resource - The resource to read from
 * @returns AI tool name or undefined
 */
export function getAITool(resource: Resource): string | undefined {
  return getC2PA(resource)?.aiDisclosure?.aiTool;
}

/**
 * Get actions from a resource's C2PA extension.
 *
 * @param resource - The resource to read from
 * @returns Array of C2PA actions or empty array
 */
export function getC2PAActions(resource: Resource): C2PAExtension["actions"] {
  return getC2PA(resource)?.actions ?? [];
}

/**
 * Get ingredients from a resource's C2PA extension.
 *
 * @param resource - The resource to read from
 * @returns Array of C2PA ingredients or empty array
 */
export function getC2PAIngredients(resource: Resource): C2PAExtension["ingredients"] {
  return getC2PA(resource)?.ingredients ?? [];
}

/**
 * Get signature info from a resource's C2PA extension.
 *
 * @param resource - The resource to read from
 * @returns Signature info or undefined
 */
export function getC2PASignature(resource: Resource): C2PAExtension["signature"] {
  return getC2PA(resource)?.signature;
}

/**
 * Check if the manifest is embedded or remote.
 *
 * @param resource - The resource to check
 * @returns True if embedded, false if remote or unknown
 */
export function isManifestEmbedded(resource: Resource): boolean {
  return getC2PA(resource)?.isEmbedded === true;
}

/**
 * Get the remote manifest URL (if not embedded).
 *
 * @param resource - The resource to read from
 * @returns Remote URL or undefined
 */
export function getRemoteManifestUrl(resource: Resource): string | undefined {
  return getC2PA(resource)?.remoteUrl;
}

/**
 * Get creative work info from C2PA.
 *
 * @param resource - The resource to read from
 * @returns Creative work info or undefined
 */
export function getCreativeWork(resource: Resource): C2PAExtension["creativeWork"] {
  return getC2PA(resource)?.creativeWork;
}

/**
 * Get validation errors from C2PA.
 *
 * @param resource - The resource to read from
 * @returns Array of validation errors or empty array
 */
export function getValidationErrors(resource: Resource): string[] {
  return getC2PA(resource)?.validationStatus?.errors ?? [];
}

/**
 * Get validation warnings from C2PA.
 *
 * @param resource - The resource to read from
 * @returns Array of validation warnings or empty array
 */
export function getValidationWarnings(resource: Resource): string[] {
  return getC2PA(resource)?.validationStatus?.warnings ?? [];
}
