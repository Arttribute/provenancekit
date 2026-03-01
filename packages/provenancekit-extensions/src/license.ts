import { z } from "zod";
import type { Resource, Attribution } from "@provenancekit/eaa-types";

/**
 * Namespace for license extension.
 * @example "ext:license@1.0.0"
 */
export const LICENSE_NAMESPACE = "ext:license@1.0.0" as const;

/**
 * License extension schema.
 *
 * Defines usage rights and terms for content. Attach to a Resource to declare
 * general terms, or to an Attribution (with role "licensee") to record that
 * a specific entity has been granted rights.
 *
 * @example
 * ```typescript
 * // General license on a resource
 * const resource = withLicense(res, {
 *   type: "CC-BY-4.0",
 *   commercial: true,
 *   derivatives: true,
 *   attribution: "required",
 * });
 *
 * // Specific grant to an entity (on an attribution)
 * const grant = withLicense(
 *   { resourceRef: cidRef("bafy..."), entityId: "bob", role: "licensee" },
 *   {
 *     type: "commercial-license",
 *     commercial: true,
 *     derivatives: true,
 *     grantedBy: "alice",
 *     grantType: "purchase",
 *     transactionRef: "0xabc...def",
 *   }
 * );
 * ```
 */
export const LicenseExtension = z.object({
  /** License identifier (SPDX or custom) */
  type: z.string(),

  /** Commercial use allowed? */
  commercial: z.boolean().optional(),

  /** Derivative works allowed? */
  derivatives: z.boolean().optional(),

  /** ShareAlike required? */
  shareAlike: z.boolean().optional(),

  /** Attribution requirement */
  attribution: z.enum(["required", "requested", "none"]).optional(),

  /** Specific attribution text to use */
  attributionText: z.string().optional(),

  /** URL to full license terms */
  termsUrl: z.string().url().optional(),

  /** Geographic jurisdiction */
  jurisdiction: z.string().optional(),

  /** License expiration date (ISO 8601) */
  expires: z.string().datetime().optional(),

  /** Entity ID of who granted the rights (for per-entity grants on attributions) */
  grantedBy: z.string().optional(),

  /** How rights were acquired: license, purchase, transfer, open, agreement */
  grantType: z
    .enum(["license", "purchase", "transfer", "open", "agreement"])
    .optional(),

  /** Reference to a payment/purchase transaction backing this grant */
  transactionRef: z.string().optional(),

  /**
   * Whether use of this work for AI training is permitted, reserved, or unspecified.
   *
   * - `"permitted"` — Rights holder explicitly allows AI training use
   * - `"reserved"` — Rights holder reserves this right; AI training is NOT permitted
   *   (machine-readable DSM Article 4(3) opt-out / EU AI Act Art. 53(1)(c))
   * - `"unspecified"` — No explicit position stated (default)
   *
   * @remarks
   * DSM Directive Art. 4(3) requires rightsholders to be able to reserve rights
   * for text and data mining "in an appropriate manner, such as machine-readable means".
   * Setting this field to "reserved" satisfies that requirement.
   *
   * @example
   * ```typescript
   * // Opt out of AI training
   * const resource = withLicense(res, {
   *   ...Licenses.CC_BY,
   *   aiTraining: "reserved",
   * });
   * ```
   */
  aiTraining: z.enum(["permitted", "reserved", "unspecified"]).optional(),
});

export type LicenseExtension = z.infer<typeof LicenseExtension>;

/**
 * Add license extension to a resource or attribution.
 *
 * @param obj - The resource or attribution to extend
 * @param license - License data
 * @returns Object with license extension
 *
 * @example
 * ```typescript
 * const licensed = withLicense(resource, Licenses.CC_BY);
 * ```
 */
export function withLicense<T extends Resource | Attribution>(
  obj: T,
  license: z.input<typeof LicenseExtension>
): T {
  const validated = LicenseExtension.parse(license);
  return {
    ...obj,
    extensions: { ...obj.extensions, [LICENSE_NAMESPACE]: validated },
  };
}

/**
 * Get license extension from a resource or attribution.
 *
 * @param obj - The resource or attribution to read from
 * @returns License data or undefined if not present
 */
export function getLicense(
  obj: Resource | Attribution
): LicenseExtension | undefined {
  const data = obj.extensions?.[LICENSE_NAMESPACE];
  if (!data) return undefined;
  return LicenseExtension.parse(data);
}

/**
 * Check if an object has license extension.
 *
 * @param obj - The resource or attribution to check
 * @returns True if license extension exists
 */
export function hasLicense(obj: Resource | Attribution): boolean {
  return obj.extensions?.[LICENSE_NAMESPACE] !== undefined;
}

/**
 * Check if a license is currently active (not expired).
 *
 * @param obj - The resource or attribution to check
 * @param now - Reference date (defaults to current time)
 * @returns True if the license exists and has not expired
 */
export function isLicenseActive(
  obj: Resource | Attribution,
  now: Date = new Date()
): boolean {
  const license = getLicense(obj);
  if (!license) return false;
  if (!license.expires) return true;
  return new Date(license.expires) > now;
}

/**
 * Check if the AI training right is reserved on a resource or attribution.
 *
 * Returns true when `aiTraining === "reserved"`, meaning the rights holder
 * has explicitly opted out of AI training use under DSM Art. 4(3).
 *
 * @param obj - The resource or attribution to check
 * @returns True if AI training is reserved (not permitted)
 *
 * @example
 * ```typescript
 * if (hasAITrainingReservation(resource)) {
 *   // Respect the opt-out — do not use for training
 * }
 * ```
 */
export function hasAITrainingReservation(obj: Resource | Attribution): boolean {
  return getLicense(obj)?.aiTraining === "reserved";
}

/**
 * Common license presets using SPDX identifiers.
 *
 * @example
 * ```typescript
 * const resource = withLicense(res, Licenses.CC_BY);
 * const proprietary = withLicense(res, Licenses.PROPRIETARY);
 * ```
 */
export const Licenses = {
  /** Public domain - no restrictions */
  CC0: {
    type: "CC0-1.0",
    commercial: true,
    derivatives: true,
    attribution: "none" as const,
    termsUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },

  /** Attribution required */
  CC_BY: {
    type: "CC-BY-4.0",
    commercial: true,
    derivatives: true,
    attribution: "required" as const,
    termsUrl: "https://creativecommons.org/licenses/by/4.0/",
  },

  /** Attribution + ShareAlike */
  CC_BY_SA: {
    type: "CC-BY-SA-4.0",
    commercial: true,
    derivatives: true,
    shareAlike: true,
    attribution: "required" as const,
    termsUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },

  /** Attribution + NonCommercial */
  CC_BY_NC: {
    type: "CC-BY-NC-4.0",
    commercial: false,
    derivatives: true,
    attribution: "required" as const,
    termsUrl: "https://creativecommons.org/licenses/by-nc/4.0/",
  },

  /** Attribution + NonCommercial + ShareAlike */
  CC_BY_NC_SA: {
    type: "CC-BY-NC-SA-4.0",
    commercial: false,
    derivatives: true,
    shareAlike: true,
    attribution: "required" as const,
    termsUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  },

  /** Attribution + NoDerivatives */
  CC_BY_ND: {
    type: "CC-BY-ND-4.0",
    commercial: true,
    derivatives: false,
    attribution: "required" as const,
    termsUrl: "https://creativecommons.org/licenses/by-nd/4.0/",
  },

  /** MIT License */
  MIT: {
    type: "MIT",
    commercial: true,
    derivatives: true,
    attribution: "required" as const,
    termsUrl: "https://opensource.org/licenses/MIT",
  },

  /** Apache 2.0 License */
  APACHE_2: {
    type: "Apache-2.0",
    commercial: true,
    derivatives: true,
    attribution: "required" as const,
    termsUrl: "https://www.apache.org/licenses/LICENSE-2.0",
  },

  /** All rights reserved */
  PROPRIETARY: {
    type: "proprietary",
    commercial: false,
    derivatives: false,
    attribution: "required" as const,
  },
} as const;

export type LicensePreset = keyof typeof Licenses;
