/**
 * C2PA manifest reader for ProvenanceKit.
 *
 * Reads C2PA content credentials from media files and converts
 * them to EAA provenance records.
 *
 * @packageDocumentation
 */

import type { Resource, Action, Attribution, Entity } from "@arttribute/eaa-types";
import type {
  C2PAExtension,
  C2PAAction,
  C2PAIngredient,
  C2PASignature,
  ReadManifestOptions,
  ManifestReadResult,
} from "../types.js";
import { MediaError, getMimeTypeFromExtension } from "../types.js";
import { convertC2PAToEAA } from "../converter/index.js";

/*─────────────────────────────────────────────────────────────*\
 | C2PA Library Detection                                       |
\*─────────────────────────────────────────────────────────────*/

/**
 * Dynamically import c2pa-node if available.
 */
async function getC2PALibrary(): Promise<typeof import("@contentauth/c2pa-node") | null> {
  try {
    return await import("@contentauth/c2pa-node");
  } catch {
    return null;
  }
}

/**
 * Check if c2pa-node is available.
 */
export async function isC2PAAvailable(): Promise<boolean> {
  const lib = await getC2PALibrary();
  return lib !== null;
}

/*─────────────────────────────────────────────────────────────*\
 | Manifest Parsing                                             |
\*─────────────────────────────────────────────────────────────*/

/**
 * Parse raw manifest JSON to C2PAExtension.
 *
 * @param manifestJson - Raw manifest JSON from c2pa-node
 * @returns Parsed C2PA extension
 */
export function parseManifestJson(manifestJson: unknown): C2PAExtension {
  const manifest = manifestJson as Record<string, unknown>;

  // Extract active manifest
  const activeManifest = manifest["active_manifest"] as Record<string, unknown> | undefined;
  if (!activeManifest) {
    throw new MediaError("No active manifest found", "INVALID_MANIFEST");
  }

  // Extract claim
  const claim = activeManifest["claim"] as Record<string, unknown> | undefined;

  // Extract claim generator
  const claimGenerator = (activeManifest["claim_generator"] as string) ?? "unknown";
  const claimGeneratorInfo = (activeManifest["claim_generator_info"] as Record<string, unknown>[]) ?? [];
  const claimGeneratorVersion = claimGeneratorInfo[0]?.["version"] as string | undefined;

  // Extract title
  const title = (claim?.["dc:title"] as string) ?? (claim?.["title"] as string);

  // Extract format
  const format = (claim?.["dc:format"] as string) ?? (claim?.["format"] as string);

  // Extract instance ID
  const instanceId = claim?.["instanceID"] as string | undefined;

  // Extract actions
  const actionsData = (activeManifest["assertions"] as Record<string, unknown>)?.["c2pa.actions"] as
    | Record<string, unknown>
    | undefined;
  const actions: C2PAAction[] = [];

  if (actionsData?.["actions"]) {
    const actionsList = actionsData["actions"] as Record<string, unknown>[];
    for (const actionData of actionsList) {
      const actionType = (actionData["action"] as string) ?? "c2pa.unknown";
      const action: C2PAAction = {
        action: actionType as C2PAAction["action"],
        when: actionData["when"] as string | undefined,
        softwareAgent: actionData["softwareAgent"]
          ? {
              name: (actionData["softwareAgent"] as Record<string, unknown>)["name"] as string,
              version: (actionData["softwareAgent"] as Record<string, unknown>)["version"] as
                | string
                | undefined,
            }
          : undefined,
        digitalSourceType: actionData["digitalSourceType"] as string | undefined,
        reason: actionData["reason"] as string | undefined,
        parameters: actionData["parameters"] as Record<string, unknown> | undefined,
      };
      actions.push(action);
    }
  }

  // Extract ingredients
  const ingredientsData = (activeManifest["ingredients"] as Record<string, unknown>[]) ?? [];
  const ingredients: C2PAIngredient[] = [];

  for (const ingData of ingredientsData) {
    const ingredient: C2PAIngredient = {
      title: (ingData["title"] as string) ?? "Unknown",
      format: ingData["format"] as string | undefined,
      documentId: ingData["document_id"] as string | undefined,
      instanceId: ingData["instance_id"] as string | undefined,
      hash: ingData["hash"] as string | undefined,
      isParent: ingData["is_parent"] as boolean | undefined,
      relationship: ingData["relationship"] as "parentOf" | "componentOf" | "inputTo" | undefined,
    };
    ingredients.push(ingredient);
  }

  // Extract signature info
  const signatureInfo = activeManifest["signature_info"] as Record<string, unknown> | undefined;
  let signature: C2PASignature | undefined;

  if (signatureInfo) {
    signature = {
      algorithm: (signatureInfo["alg"] as string) ?? "unknown",
      issuer: signatureInfo["issuer"] as string | undefined,
      timestamp: signatureInfo["time"] as string | undefined,
    };
  }

  // Extract validation status
  const validationStatus = activeManifest["validation_status"] as Record<string, unknown>[] | undefined;
  let validationResult:
    | { isValid: boolean; errors?: string[]; warnings?: string[] }
    | undefined;

  if (validationStatus) {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const status of validationStatus) {
      const code = status["code"] as string;
      const explanation = status["explanation"] as string;

      if (code?.startsWith("error") || code?.includes("failure")) {
        errors.push(explanation ?? code);
      } else if (code?.startsWith("warning")) {
        warnings.push(explanation ?? code);
      }
    }

    validationResult = {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // Extract AI disclosure
  const aiAssertions = (activeManifest["assertions"] as Record<string, unknown>)?.[
    "c2pa.ai_training"
  ] as Record<string, unknown> | undefined;
  let aiDisclosure:
    | { isAIGenerated: boolean; aiTool?: string; trainingDataUsed?: boolean }
    | undefined;

  // Check for AI-related digital source type in actions
  const hasAISourceType = actions.some(
    (a) =>
      a.digitalSourceType?.includes("trainedAlgorithmic") ||
      a.digitalSourceType?.includes("compositeWithTrainedAlgorithmic")
  );

  if (hasAISourceType || aiAssertions) {
    aiDisclosure = {
      isAIGenerated: hasAISourceType,
      trainingDataUsed: aiAssertions?.["use"] !== "notAllowed",
    };
  }

  // Extract creative work
  const creativeWorkData = (activeManifest["assertions"] as Record<string, unknown>)?.[
    "stds.schema-org.CreativeWork"
  ] as Record<string, unknown> | undefined;
  let creativeWork:
    | { author?: string[]; dateCreated?: string; copyright?: string }
    | undefined;

  if (creativeWorkData) {
    const authors = creativeWorkData["author"] as
      | Array<{ name?: string } | string>
      | undefined;
    creativeWork = {
      author: authors?.map((a) => (typeof a === "string" ? a : a.name ?? "Unknown")),
      dateCreated: creativeWorkData["dateCreated"] as string | undefined,
      copyright: creativeWorkData["copyrightNotice"] as string | undefined,
    };
  }

  // Build C2PA extension
  const c2paExtension: C2PAExtension = {
    manifestLabel: (activeManifest["label"] as string) ?? "unknown",
    claimGenerator,
    claimGeneratorVersion,
    title,
    format,
    instanceId,
    actions: actions.length > 0 ? actions : undefined,
    ingredients: ingredients.length > 0 ? ingredients : undefined,
    signature,
    validationStatus: validationResult,
    isEmbedded: true, // Will be updated if remote
    aiDisclosure,
    creativeWork,
  };

  return c2paExtension;
}

/*─────────────────────────────────────────────────────────────*\
 | Main Reader Functions                                        |
\*─────────────────────────────────────────────────────────────*/

/**
 * Read C2PA manifest from a file path.
 *
 * @param filePath - Path to the media file
 * @param options - Read options
 * @returns Manifest read result with EAA types
 *
 * @example
 * ```typescript
 * const result = await readManifest("./photo.jpg");
 *
 * console.log("Title:", result.c2pa.title);
 * console.log("Actions:", result.actions.length);
 * console.log("Is AI generated:", result.c2pa.aiDisclosure?.isAIGenerated);
 * ```
 */
export async function readManifest(
  filePath: string,
  options: ReadManifestOptions = {}
): Promise<ManifestReadResult> {
  const c2pa = await getC2PALibrary();

  if (!c2pa) {
    throw new MediaError(
      "c2pa-node is not available. Install @contentauth/c2pa-node to read C2PA manifests.",
      "C2PA_NOT_AVAILABLE"
    );
  }

  try {
    // Build settings
    const settings: Record<string, unknown> = {};

    if (options.verify !== undefined || options.verifyTrust !== undefined) {
      settings["verify"] = {
        verify_after_reading: options.verify ?? true,
        verify_trust: options.verifyTrust ?? false,
      };
    }

    if (options.trustAnchors) {
      settings["trust"] = {
        trust_anchors: options.trustAnchors,
      };
    }

    // Read manifest
    const reader = await c2pa.Reader.fromAsset(
      { path: filePath } as Parameters<typeof c2pa.Reader.fromAsset>[0],
      Object.keys(settings).length > 0 ? settings : undefined
    );

    if (!reader) {
      throw new MediaError("No C2PA manifest found in file", "NO_MANIFEST", {
        filePath,
      });
    }

    const manifestJson = reader.json();

    if (!manifestJson) {
      throw new MediaError("No C2PA manifest found in file", "NO_MANIFEST", {
        filePath,
      });
    }

    // Parse manifest
    const c2paExtension = parseManifestJson(manifestJson);

    // Update embedded status
    c2paExtension.isEmbedded = reader.isEmbedded();
    if (!reader.isEmbedded()) {
      c2paExtension.remoteUrl = reader.remoteUrl() ?? undefined;
    }

    // Convert to EAA types
    const { resource, actions, attributions, entities } = convertC2PAToEAA(c2paExtension, {
      filePath,
    });

    return {
      c2pa: c2paExtension,
      resource,
      actions,
      attributions,
      entities,
      rawManifest: manifestJson,
    };
  } catch (error) {
    if (error instanceof MediaError) throw error;

    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("no manifest") || message.includes("No manifest")) {
      throw new MediaError("No C2PA manifest found in file", "NO_MANIFEST", {
        filePath,
        cause: message,
      });
    }

    throw new MediaError(`Failed to read manifest: ${message}`, "READING_FAILED", {
      filePath,
      cause: message,
    });
  }
}

/**
 * Read C2PA manifest from a buffer.
 *
 * @param buffer - Media file buffer
 * @param mimeType - MIME type of the file
 * @param options - Read options
 * @returns Manifest read result with EAA types
 */
export async function readManifestFromBuffer(
  buffer: Buffer,
  mimeType: string,
  options: ReadManifestOptions = {}
): Promise<ManifestReadResult> {
  const c2pa = await getC2PALibrary();

  if (!c2pa) {
    throw new MediaError(
      "c2pa-node is not available. Install @contentauth/c2pa-node to read C2PA manifests.",
      "C2PA_NOT_AVAILABLE"
    );
  }

  try {
    // Build settings
    const settings: Record<string, unknown> = {};

    if (options.verify !== undefined || options.verifyTrust !== undefined) {
      settings["verify"] = {
        verify_after_reading: options.verify ?? true,
        verify_trust: options.verifyTrust ?? false,
      };
    }

    // Read manifest - using buffer with asset info
    const reader = await c2pa.Reader.fromAsset(
      { buffer, mimeType } as Parameters<typeof c2pa.Reader.fromAsset>[0],
      Object.keys(settings).length > 0 ? settings : undefined
    );

    if (!reader) {
      throw new MediaError("No C2PA manifest found in buffer", "NO_MANIFEST");
    }

    const manifestJson = reader.json();

    if (!manifestJson) {
      throw new MediaError("No C2PA manifest found in buffer", "NO_MANIFEST");
    }

    // Parse manifest
    const c2paExtension = parseManifestJson(manifestJson);

    // Update embedded status
    c2paExtension.isEmbedded = reader.isEmbedded();

    // Convert to EAA types
    const { resource, actions, attributions, entities } = convertC2PAToEAA(c2paExtension);

    return {
      c2pa: c2paExtension,
      resource,
      actions,
      attributions,
      entities,
      rawManifest: manifestJson,
    };
  } catch (error) {
    if (error instanceof MediaError) throw error;

    const message = error instanceof Error ? error.message : String(error);
    throw new MediaError(`Failed to read manifest from buffer: ${message}`, "READING_FAILED", {
      cause: message,
    });
  }
}

/**
 * Check if a file has C2PA content credentials.
 *
 * @param filePath - Path to the media file
 * @returns True if file has C2PA manifest
 */
export async function hasManifest(filePath: string): Promise<boolean> {
  try {
    await readManifest(filePath, { verify: false });
    return true;
  } catch (error) {
    if (error instanceof MediaError && error.code === "NO_MANIFEST") {
      return false;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Get a quick summary of C2PA manifest without full conversion.
 *
 * @param filePath - Path to the media file
 * @returns Quick summary or null if no manifest
 */
export async function getManifestSummary(
  filePath: string
): Promise<{
  hasManifest: boolean;
  isValid: boolean | null;
  title: string | null;
  creator: string | null;
  isAIGenerated: boolean;
  actionCount: number;
  ingredientCount: number;
} | null> {
  try {
    const result = await readManifest(filePath, { verify: true });

    return {
      hasManifest: true,
      isValid: result.c2pa.validationStatus?.isValid ?? null,
      title: result.c2pa.title ?? null,
      creator: result.c2pa.creativeWork?.author?.[0] ?? null,
      isAIGenerated: result.c2pa.aiDisclosure?.isAIGenerated ?? false,
      actionCount: result.c2pa.actions?.length ?? 0,
      ingredientCount: result.c2pa.ingredients?.length ?? 0,
    };
  } catch (error) {
    if (error instanceof MediaError && error.code === "NO_MANIFEST") {
      return null;
    }
    throw error;
  }
}
