/**
 * @provenancekit/media
 *
 * C2PA media provenance integration for ProvenanceKit - Read and write
 * content credentials for images and videos.
 *
 * @example
 * ```typescript
 * import {
 *   readManifest,
 *   writeManifest,
 *   hasC2PA,
 *   isAIGenerated,
 * } from "@provenancekit/media";
 *
 * // Read C2PA manifest from an image
 * const result = await readManifest("./photo.jpg");
 *
 * console.log("Title:", result.c2pa.title);
 * console.log("Is AI generated:", result.c2pa.aiDisclosure?.isAIGenerated);
 * console.log("Actions:", result.actions.length);
 *
 * // Write C2PA manifest to an image
 * await writeManifest("./input.jpg", "./output.jpg", {
 *   signer: { certificate, privateKey, algorithm: "es256" },
 *   title: "My Photo",
 *   creativeWork: { author: ["John Doe"] },
 * });
 * ```
 *
 * @packageDocumentation
 */

/*─────────────────────────────────────────────────────────────*\
 | Type Exports                                                 |
\*─────────────────────────────────────────────────────────────*/

export type {
  // C2PA Extension Types
  C2PAExtension,
  C2PAAction,
  C2PAActionType,
  C2PAActor,
  C2PAIngredient,
  C2PASignature,

  // Media Types (simplified for this package)
  MediaResource,
  MediaAction,
  MediaAttribution,
  MediaEntity,
  Resource,
  Action,
  Attribution,
  Entity,

  // Options Types
  ReadManifestOptions,
  ManifestReadResult,
  WriteManifestOptions,
  ManifestWriteResult,
  SignerConfig,

  // Error Types
  MediaErrorCode,
  SupportedFormat,
} from "./types.js";

export {
  C2PA_NAMESPACE,
  MediaError,
  SUPPORTED_FORMATS,
  isSupportedFormat,
  getMimeTypeFromExtension,
} from "./types.js";

/*─────────────────────────────────────────────────────────────*\
 | Extension Exports                                            |
\*─────────────────────────────────────────────────────────────*/

export {
  // Extension helpers
  withC2PA,
  getC2PA,
  hasC2PA,
  getManifestLabel,
  isC2PAValid,
  isAIGenerated,
  getAITool,
  getC2PAActions,
  getC2PAIngredients,
  getC2PASignature,
  isManifestEmbedded,
  getRemoteManifestUrl,
  getCreativeWork,
  getValidationErrors,
  getValidationWarnings,
} from "./extension.js";

/*─────────────────────────────────────────────────────────────*\
 | Reader Exports                                               |
\*─────────────────────────────────────────────────────────────*/

export {
  // Reader functions
  readManifest,
  readManifestFromBuffer,
  hasManifest,
  getManifestSummary,
  isC2PAAvailable,
  parseManifestJson,
} from "./reader/index.js";

/*─────────────────────────────────────────────────────────────*\
 | Writer Exports                                               |
\*─────────────────────────────────────────────────────────────*/

export {
  // Writer functions
  writeManifest,
  writeManifestFromEAA,
  updateManifest,
  removeManifest,
} from "./writer/index.js";

/*─────────────────────────────────────────────────────────────*\
 | Converter Exports                                            |
\*─────────────────────────────────────────────────────────────*/

export {
  // Type converters
  actorToEntity,
  softwareAgentToEntity,
  c2paActionToEAAAction,
  createAttributionsFromC2PA,
  createContentReference,
  createResourceFromC2PA,
  convertC2PAToEAA,
  ingredientToResource,
  getIngredientsAsResources,
} from "./converter/index.js";
