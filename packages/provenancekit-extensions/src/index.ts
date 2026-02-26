/**
 * @provenancekit/extensions
 *
 * Type-safe extension schemas and helpers for ProvenanceKit EAA types.
 *
 * This package provides Zod schemas and helper functions for common
 * extension patterns. Extensions follow the `ext:namespace@version` format
 * and can be added to any EAA type (Entity, Action, Resource, Attribution).
 *
 * @example
 * ```typescript
 * import { Attribution, cidRef } from "@provenancekit/eaa-types";
 * import {
 *   withContrib,
 *   withLicense,
 *   withPayment,
 *   withAITool,
 *   withAIAgent,
 *   Licenses,
 *   PAYMENT_METHODS,
 *   calculateDistribution,
 * } from "@provenancekit/extensions";
 *
 * // Human uses AI as a tool
 * const action = withAITool(myAction, {
 *   provider: "anthropic",
 *   model: "claude-3-opus",
 *   promptHash: "sha256:...",
 * });
 *
 * // AI agent as autonomous actor
 * const agent = createAIAgent("agent:coordinator", {
 *   model: { provider: "anthropic", model: "claude-3-opus" },
 *   delegatedBy: "did:key:alice",
 *   autonomyLevel: "supervised",
 *   collaborators: ["agent:specialist-1", "agent:specialist-2"],
 * });
 * ```
 *
 * @packageDocumentation
 */

// Contribution extension
export {
  CONTRIB_NAMESPACE,
  ContribExtension,
  ContribBasis,
  ContribSource,
  withContrib,
  getContrib,
  hasContrib,
  getContribBps,
} from "./contrib";

// License extension
export {
  LICENSE_NAMESPACE,
  LicenseExtension,
  withLicense,
  getLicense,
  hasLicense,
  isLicenseActive,
  Licenses,
  type LicensePreset,
} from "./license";

// Payment extension
export {
  PAYMENT_NAMESPACE,
  PAYMENT_METHODS,
  PaymentExtension,
  PaymentRecipient,
  withPayment,
  getPayment,
  hasPayment,
  getPaymentAddress,
} from "./payment";

// On-chain proof extension
export {
  ONCHAIN_NAMESPACE,
  OnchainExtension,
  withOnchain,
  getOnchain,
  hasOnchain,
  isOnChain,
  getTxHash,
} from "./onchain";

// Storage extension
export {
  STORAGE_NAMESPACE,
  STORAGE_PROVIDERS,
  StorageExtension,
  StorageReplica,
  ReplicaStatus,
  withStorage,
  getStorage,
  hasStorage,
  isPinned,
  getActiveReplicas,
  addReplica,
} from "./storage";

// AI extension (Tool + Agent)
export {
  AI_NAMESPACE,
  // AI as Tool (attached to Action)
  AIToolExtension,
  withAITool,
  getAITool,
  usedAITool,
  getToolModel,
  // AI as Agent (attached to Entity)
  AIAgentExtension,
  withAIAgent,
  getAIAgent,
  isAIAgent,
  getAgentModel,
  createAIAgent,
  addCollaborators,
  setAgentSession,
} from "./ai";

// Action proof extension
export {
  PROOF_NAMESPACE,
  ProofExtension,
  type ActionProof,
  withProof,
  getProof,
  hasProof,
} from "./proof";

// Identity proof extension
export {
  IDENTITY_NAMESPACE,
  IdentityProofExtension,
  withIdentityProof,
  getIdentityProof,
  hasIdentityProof,
} from "./identity";

// Server witness extension
export {
  WITNESS_NAMESPACE,
  EnvironmentAttestation,
  WitnessExtension,
  withWitness,
  getWitness,
  hasWitness,
} from "./witness";

// Tool attestation extension
export {
  TOOL_ATTESTATION_NAMESPACE,
  ToolAttestationLevel,
  ToolAttestationExtension,
  ProviderSignature,
  ToolReceipt,
  withToolAttestation,
  getToolAttestation,
  hasToolAttestation,
  getAttestationLevel,
} from "./tool-attestation";

// Verification result extension
export {
  VERIFICATION_NAMESPACE,
  ClaimStatus,
  VerificationExtension,
  withVerification,
  getVerification,
  isFullyVerified,
} from "./verification";

// Generic utilities
export {
  withExtension,
  getExtension,
  hasExtension,
  withoutExtension,
  getExtensionKeys,
  withExtensions,
  copyExtensions,
  isValidNamespace,
  type Extensible,
} from "./utils";

// Distribution calculator
export {
  calculateDistribution,
  calculateActionDistribution,
  normalizeContributions,
  splitAmount,
  mergeDistributions,
  type Distribution,
  type DistributionEntry,
  type SplitResult,
} from "./distribution";

// Ownership extensions (claim + transfer)
export {
  OWNERSHIP_CLAIM_NAMESPACE,
  OWNERSHIP_TRANSFER_NAMESPACE,
  OwnershipEvidenceType,
  OwnershipClaimExtension,
  OwnershipTransferExtension,
  OwnershipTransferType,
  withOwnershipClaim,
  getOwnershipClaim,
  hasOwnershipClaim,
  withOwnershipTransfer,
  getOwnershipTransfer,
  hasOwnershipTransfer,
} from "./ownership";

/**
 * All extension namespace constants for convenience.
 */
export const NAMESPACES = {
  CONTRIB: "ext:contrib@1.0.0",
  LICENSE: "ext:license@1.0.0",
  PAYMENT: "ext:payment@1.0.0",
  ONCHAIN: "ext:onchain@1.0.0",
  STORAGE: "ext:storage@1.0.0",
  AI: "ext:ai@1.0.0",
  PROOF: "ext:proof@1.0.0",
  IDENTITY: "ext:identity@1.0.0",
  WITNESS: "ext:witness@1.0.0",
  TOOL_ATTESTATION: "ext:tool-attestation@1.0.0",
  VERIFICATION: "ext:verification@1.0.0",
  OWNERSHIP_CLAIM: "ext:ownership:claim@1.0.0",
  OWNERSHIP_TRANSFER: "ext:ownership:transfer@1.0.0",
} as const;
