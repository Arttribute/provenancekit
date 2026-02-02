/**
 * C2PA manifest writer for ProvenanceKit.
 *
 * Creates and embeds C2PA content credentials in media files.
 *
 * @packageDocumentation
 */

import * as fs from "fs";
import * as path from "path";
import type { Resource, Action, Attribution, Entity } from "@arttribute/eaa-types";
import type {
  C2PAExtension,
  C2PAAction,
  WriteManifestOptions,
  ManifestWriteResult,
  SignerConfig,
} from "../types.js";
import { MediaError, getMimeTypeFromExtension, isSupportedFormat } from "../types.js";
import { createResourceFromC2PA } from "../converter/index.js";

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

/*─────────────────────────────────────────────────────────────*\
 | Manifest Building                                            |
\*─────────────────────────────────────────────────────────────*/

/**
 * Build manifest definition JSON for c2pa-node Builder.
 */
function buildManifestDefinition(
  options: WriteManifestOptions,
  mimeType: string
): Record<string, unknown> {
  const manifest: Record<string, unknown> = {
    claim_generator:
      options.claimGenerator?.name ?? "ProvenanceKit",
    claim_generator_info: [
      {
        name: options.claimGenerator?.name ?? "ProvenanceKit",
        version: options.claimGenerator?.version ?? "1.0.0",
      },
    ],
  };

  // Add title
  if (options.title) {
    manifest["title"] = options.title;
  }

  // Build assertions
  const assertions: Array<{ label: string; data: unknown }> = [];

  // Add actions assertion
  if (options.actions && options.actions.length > 0) {
    const actionsData = {
      actions: options.actions.map((a) => ({
        action: a.action,
        when: a.when ?? new Date().toISOString(),
        softwareAgent: a.softwareAgent,
        digitalSourceType: a.digitalSourceType,
      })),
    };
    assertions.push({
      label: "c2pa.actions",
      data: actionsData,
    });
  }

  // Add creative work assertion
  if (options.creativeWork) {
    const creativeWorkData: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
    };

    if (options.creativeWork.author) {
      creativeWorkData["author"] = options.creativeWork.author.map((a) => ({
        "@type": "Person",
        name: a,
      }));
    }

    if (options.creativeWork.copyright) {
      creativeWorkData["copyrightNotice"] = options.creativeWork.copyright;
    }

    assertions.push({
      label: "stds.schema-org.CreativeWork",
      data: creativeWorkData,
    });
  }

  // Add AI disclosure
  if (options.aiDisclosure) {
    // Use digital source type in actions for AI disclosure
    if (options.aiDisclosure.isAIGenerated && !options.actions?.length) {
      const aiAction = {
        actions: [
          {
            action: "c2pa.created",
            when: new Date().toISOString(),
            digitalSourceType:
              "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
            softwareAgent: options.aiDisclosure.aiTool
              ? { name: options.aiDisclosure.aiTool }
              : undefined,
          },
        ],
      };
      assertions.push({
        label: "c2pa.actions",
        data: aiAction,
      });
    }

    // Add training/mining assertion
    assertions.push({
      label: "c2pa.ai_training",
      data: {
        use: "notAllowed",
        constraint_info:
          "This content may not be used for AI training or data mining.",
      },
    });
  }

  if (assertions.length > 0) {
    manifest["assertions"] = assertions;
  }

  return manifest;
}

/*─────────────────────────────────────────────────────────────*\
 | Main Writer Functions                                        |
\*─────────────────────────────────────────────────────────────*/

/**
 * Write C2PA manifest to a media file.
 *
 * @param inputPath - Path to the input media file
 * @param outputPath - Path for the output file with manifest
 * @param options - Write options including signer config
 * @returns Manifest write result
 *
 * @example
 * ```typescript
 * const result = await writeManifest(
 *   "./input.jpg",
 *   "./output.jpg",
 *   {
 *     signer: {
 *       certificate: fs.readFileSync("cert.pem"),
 *       privateKey: fs.readFileSync("key.pem"),
 *       algorithm: "es256",
 *     },
 *     title: "My Photo",
 *     actions: [
 *       { action: "c2pa.created", softwareAgent: { name: "My App" } }
 *     ],
 *     creativeWork: {
 *       author: ["John Doe"],
 *       copyright: "© 2025 John Doe",
 *     },
 *   }
 * );
 *
 * console.log("Manifest written:", result.manifestLabel);
 * ```
 */
export async function writeManifest(
  inputPath: string,
  outputPath: string,
  options: WriteManifestOptions
): Promise<ManifestWriteResult> {
  const c2pa = await getC2PALibrary();

  if (!c2pa) {
    throw new MediaError(
      "c2pa-node is not available. Install @contentauth/c2pa-node to write C2PA manifests.",
      "C2PA_NOT_AVAILABLE"
    );
  }

  // Verify input file exists
  if (!fs.existsSync(inputPath)) {
    throw new MediaError(`Input file not found: ${inputPath}`, "READING_FAILED", {
      inputPath,
    });
  }

  // Get MIME type from extension
  const ext = path.extname(inputPath);
  const mimeType = getMimeTypeFromExtension(ext);

  if (!mimeType || !isSupportedFormat(mimeType)) {
    throw new MediaError(
      `Unsupported file format: ${ext}`,
      "UNSUPPORTED_FORMAT",
      { extension: ext }
    );
  }

  try {
    // Build manifest definition
    const manifestDef = buildManifestDefinition(options, mimeType);

    // Create builder
    const builder = c2pa.Builder.withJson(JSON.stringify(manifestDef));

    // Add ingredients if specified
    if (options.ingredients) {
      for (const ingredient of options.ingredients) {
        if (fs.existsSync(ingredient.path)) {
          // Use type assertion through unknown for c2pa-node API compatibility
          await (builder as unknown as { addResource: (uri: string, asset: { path: string }) => Promise<void> }).addResource(
            ingredient.path,
            { path: ingredient.path }
          );
        }
      }
    }

    // Create signer
    const certificate =
      typeof options.signer.certificate === "string"
        ? Buffer.from(options.signer.certificate)
        : options.signer.certificate;

    const privateKey =
      typeof options.signer.privateKey === "string"
        ? Buffer.from(options.signer.privateKey)
        : options.signer.privateKey;

    const signer = c2pa.LocalSigner.newSigner(
      certificate,
      privateKey,
      options.signer.algorithm,
      options.signer.tsaUrl
    );

    // Sign and write - use type assertion through unknown for c2pa-node API compatibility
    await (builder as unknown as { sign: (signer: unknown, input: { path: string }, output: { path: string }) => Promise<Buffer> }).sign(
      signer,
      { path: inputPath },
      { path: outputPath }
    );

    // Generate manifest label
    const manifestLabel = `urn:uuid:${crypto.randomUUID()}`;

    // Create C2PA extension from options
    const c2paExtension: C2PAExtension = {
      manifestLabel,
      claimGenerator: options.claimGenerator?.name ?? "ProvenanceKit",
      claimGeneratorVersion: options.claimGenerator?.version ?? "1.0.0",
      title: options.title,
      format: mimeType,
      actions: options.actions?.map((a) => ({
        action: a.action,
        when: a.when ?? new Date().toISOString(),
        softwareAgent: a.softwareAgent,
        digitalSourceType: a.digitalSourceType,
      })),
      signature: {
        algorithm: options.signer.algorithm,
        timestamp: new Date().toISOString(),
        tsaUrl: options.signer.tsaUrl,
      },
      isEmbedded: true,
      aiDisclosure: options.aiDisclosure
        ? {
            isAIGenerated: options.aiDisclosure.isAIGenerated,
            aiTool: options.aiDisclosure.aiTool,
          }
        : undefined,
      creativeWork: options.creativeWork,
    };

    // Create resource
    const resource = createResourceFromC2PA(c2paExtension, {
      filePath: outputPath,
    });

    return {
      outputPath,
      manifestLabel,
      c2pa: c2paExtension,
      resource,
    };
  } catch (error) {
    if (error instanceof MediaError) throw error;

    const message = error instanceof Error ? error.message : String(error);
    throw new MediaError(`Failed to write manifest: ${message}`, "SIGNING_FAILED", {
      inputPath,
      outputPath,
      cause: message,
    });
  }
}

/**
 * Create a signed manifest from EAA provenance data.
 *
 * Converts EAA types back to C2PA format and embeds in the file.
 *
 * @param inputPath - Path to the input media file
 * @param outputPath - Path for the output file
 * @param provenance - EAA provenance data
 * @param signerConfig - Signer configuration
 * @returns Manifest write result
 *
 * @example
 * ```typescript
 * const result = await writeManifestFromEAA(
 *   "./input.jpg",
 *   "./output.jpg",
 *   {
 *     resource,
 *     actions,
 *     attributions,
 *     entities,
 *   },
 *   signerConfig
 * );
 * ```
 */
export async function writeManifestFromEAA(
  inputPath: string,
  outputPath: string,
  provenance: {
    resource: Resource;
    actions?: Action[];
    attributions?: Attribution[];
    entities?: Entity[];
  },
  signerConfig: SignerConfig
): Promise<ManifestWriteResult> {
  // Convert EAA actions to C2PA actions
  const c2paActions: NonNullable<WriteManifestOptions["actions"]> = [];

  if (provenance.actions) {
    for (const action of provenance.actions) {
      // Map EAA action type to C2PA
      let c2paAction: C2PAAction["action"] = "c2pa.edited";

      if (action.type === "create") {
        c2paAction = "c2pa.created";
      } else if (action.type === "transform") {
        c2paAction = "c2pa.edited";
      } else if (action.type === "aggregate") {
        c2paAction = "c2pa.placed";
      }

      // Find software agent from entities
      const performerEntity = provenance.entities?.find(
        (e) => e.id === action.performedBy
      );

      c2paActions.push({
        action: c2paAction,
        when: action.timestamp,
        softwareAgent:
          performerEntity?.role === "ai"
            ? {
                name: performerEntity.name ?? "AI Tool",
                version: performerEntity.metadata?.["version"] as string | undefined,
              }
            : undefined,
      });
    }
  }

  // Extract authors from entities
  const authors = provenance.entities
    ?.filter((e) => e.role === "human" && e.name)
    .map((e) => e.name!)
    .filter(Boolean);

  // Check for AI disclosure
  const hasAI =
    provenance.entities?.some((e) => e.role === "ai") ||
    provenance.attributions?.some((a) => a.entityId?.startsWith("ai:"));

  const aiTool = provenance.entities?.find((e) => e.role === "ai")?.name;

  // Get title from resource (may be in metadata or as a custom field)
  const resourceTitle = (provenance.resource as { name?: string }).name;

  return writeManifest(inputPath, outputPath, {
    signer: signerConfig,
    title: resourceTitle,
    actions: c2paActions.length > 0 ? c2paActions : undefined,
    creativeWork:
      authors && authors.length > 0
        ? { author: authors }
        : undefined,
    aiDisclosure: hasAI
      ? {
          isAIGenerated: true,
          aiTool,
        }
      : undefined,
  });
}

/**
 * Remove C2PA manifest from a file.
 *
 * Creates a copy without embedded provenance.
 *
 * @param inputPath - Path to the input media file
 * @param outputPath - Path for the output file without manifest
 */
export async function removeManifest(
  inputPath: string,
  outputPath: string
): Promise<void> {
  // For now, just copy the file - proper manifest removal would need
  // to parse and rewrite the file structure
  // This is a placeholder for future implementation

  throw new MediaError(
    "Manifest removal not yet implemented. Use the c2patool CLI for this operation.",
    "UNSUPPORTED_FORMAT"
  );
}

/**
 * Update an existing manifest with new information.
 *
 * Reads the existing manifest, modifies it, and re-signs.
 *
 * @param inputPath - Path to the input media file with manifest
 * @param outputPath - Path for the output file
 * @param updates - Updates to apply
 * @param signerConfig - Signer configuration
 * @returns Updated manifest write result
 */
export async function updateManifest(
  inputPath: string,
  outputPath: string,
  updates: Partial<Omit<WriteManifestOptions, "signer">>,
  signerConfig: SignerConfig
): Promise<ManifestWriteResult> {
  // Read existing manifest
  const { readManifest } = await import("../reader/index.js");
  const existing = await readManifest(inputPath);

  // Merge with updates
  const mergedOptions: WriteManifestOptions = {
    signer: signerConfig,
    title: updates.title ?? existing.c2pa.title,
    claimGenerator: updates.claimGenerator ?? {
      name: existing.c2pa.claimGenerator,
      version: existing.c2pa.claimGeneratorVersion,
    },
    actions: updates.actions ?? existing.c2pa.actions?.map((a) => ({
      action: a.action,
      when: a.when,
      softwareAgent: a.softwareAgent,
      digitalSourceType: a.digitalSourceType,
    })),
    creativeWork: updates.creativeWork ?? existing.c2pa.creativeWork,
    aiDisclosure: updates.aiDisclosure ?? existing.c2pa.aiDisclosure,
    ingredients: updates.ingredients,
  };

  return writeManifest(inputPath, outputPath, mergedOptions);
}
