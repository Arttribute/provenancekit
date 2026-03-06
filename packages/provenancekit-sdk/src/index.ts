export * from "./client";
export * from "./errors";
export * from "./types";
export { type ApiClientOptions } from "./api";
export {
  createViemAdapter,
  createEIP1193Adapter,
  type IChainAdapter,
  type RecordActionParams,
  type RecordActionResult,
  type ViemAdapterOptions,
  type ViemWalletClient,
  type ViemPublicClient,
  type EIP1193Provider,
  type EIP1193AdapterOptions,
} from "./chain";

// Extension inspection helpers — use these to read provenance data from bundles
export {
  getWitness,
  hasWitness,
  type WitnessExtension,
  type EnvironmentAttestation,
} from "@provenancekit/extensions";

export {
  getVerification,
  isFullyVerified,
  type VerificationExtension,
  type ClaimStatus,
} from "@provenancekit/extensions";

export {
  getProof,
  hasProof,
  type ProofExtension,
} from "@provenancekit/extensions";
export {
  decryptVector,
  cosineSimilarity,
  searchVectors,
  resolveKey,
} from "./vector-crypto";
export {
  signBundle,
  verifyBundle,
  generateKeyPair,
  canonicalize,
  signAction,
  verifyAction,
  canonicalizeAction,
  signFullAction,
  verifyFullAction,
  canonicalizeFullAction,
  signRegistration,
  verifyRegistration,
  createServerWitness,
  verifyServerWitness,
  hashActionProof,
  derivePublicKey,
  verifyEd25519Signature,
  type ActionSignPayload,
  type FullActionSignPayload,
  type ActionProof,
  type ServerWitnessPayload,
  type ServerWitness,
} from "./signing";
