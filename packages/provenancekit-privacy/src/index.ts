/**
 * @provenancekit/privacy
 *
 * Privacy-preserving utilities for ProvenanceKit.
 *
 * Features:
 * - Symmetric encryption (XChaCha20-Poly1305, AES-GCM)
 * - Key derivation (password, wallet signature)
 * - Encrypted file storage wrapper
 * - Type-safe encryption envelopes
 *
 * @example
 * ```ts
 * import {
 *   encrypt, decrypt, generateKey,
 *   deriveKeyFromPassword,
 *   EncryptedFileStorage
 * } from "@provenancekit/privacy";
 *
 * // Generate a key
 * const key = generateKey();
 *
 * // Encrypt some data
 * const result = encrypt(new TextEncoder().encode("secret"), key);
 *
 * // Decrypt it back
 * const plaintext = decrypt(result.ciphertext, key, result.nonce, result.algorithm);
 * ```
 *
 * @packageDocumentation
 */

/*─────────────────────────────────────────────────────────────*\
 | Type Exports                                                 |
\*─────────────────────────────────────────────────────────────*/

export type {
  // Cipher types
  CipherAlgorithm,
  EncryptionResult,
  EncryptionEnvelope,

  // Key types
  KeyDerivationMethod,
  KeyDerivationOptions,
  PasswordKeyOptions,
  WalletKeyOptions,
  DirectKeyOptions,
  DerivedKey,

  // Interface types
  IEncryptionProvider,
  IKeyManager,

  // Storage types
  EncryptionMetadata,

  // Access control types
  AccessControlCondition,
  UnifiedAccessControlConditions,
  LitKeyAccess,
} from "./types.js";

/*─────────────────────────────────────────────────────────────*\
 | Cipher Exports                                               |
\*─────────────────────────────────────────────────────────────*/

export {
  // Core functions
  encrypt,
  decrypt,
  generateKey,
  generateNonce,

  // String/JSON helpers
  encryptString,
  decryptToString,
  encryptJson,
  decryptToJson,

  // Envelope functions
  toEnvelope,
  fromEnvelope,
  encryptToEnvelope,
  decryptFromEnvelope,

  // Base64 utilities
  toBase64,
  fromBase64,

  // Constants
  KEY_LENGTH,
  NONCE_LENGTHS,
  DEFAULT_ALGORITHM,

  // Provider
  NobleEncryptionProvider,
  defaultEncryptionProvider,
} from "./ciphers.js";

/*─────────────────────────────────────────────────────────────*\
 | Key Derivation Exports                                       |
\*─────────────────────────────────────────────────────────────*/

export {
  // Password derivation
  deriveKeyFromPassword,
  DEFAULT_ITERATIONS,
  DEFAULT_SALT_LENGTH,

  // Wallet derivation
  deriveKeyFromWallet,
  getWalletSignMessage,
  WALLET_KEY_DOMAIN,

  // Direct key
  wrapDirectKey,

  // Unified derivation
  deriveKey,

  // Key manager
  DefaultKeyManager,
  defaultKeyManager,

  // Utilities
  hexToBytes,
  bytesToHex,
  constantTimeEqual,
  generateSalt,
} from "./keys.js";

/*─────────────────────────────────────────────────────────────*\
 | Encrypted Storage Exports                                    |
\*─────────────────────────────────────────────────────────────*/

export type {
  MinimalFileStorage,
  EncryptedUploadResult,
  EncryptedUploadOptions,
  EncryptedDownloadOptions,
} from "./storage.js";

export {
  EncryptedFileStorage,
  createEncryptedStorageExtension,
  extractEnvelopeFromExtension,
  encryptAndUpload,
  downloadAndDecrypt,
} from "./storage.js";

/*─────────────────────────────────────────────────────────────*\
 | Access Control Exports                                       |
\*─────────────────────────────────────────────────────────────*/

export type {
  SupportedChain,
  Comparator,
  LogicalOperator,
  BaseAccessCondition,
  ERC20Condition,
  ERC721Condition,
  ERC1155Condition,
  ContractCondition,
  SIWECondition,
  PublicCondition,
  AccessCondition,
  CombinedConditions,
  AccessControlSpec,
  LitAccessControlCondition,
  LitOperator,
  LitUnifiedConditions,
  AccessControlledEncryptionResult,
  IAccessControlProvider,
} from "./access.js";

export {
  // Enums and constants
  AccessConditionType,
  CHAIN_IDS,

  // Condition builders
  erc20Condition,
  erc721Condition,
  erc1155Condition,
  contractCondition,
  siweCondition,
  publicCondition,

  // Combinators
  allOf,
  anyOf,

  // Lit Protocol conversion
  toLitCondition,
  toLitUnifiedConditions,

  // Common access patterns
  requireNFT,
  requireTokens,
  requireDAOMembership,
  requireNFTOwner,
  allowAddresses,
} from "./access.js";

/*─────────────────────────────────────────────────────────────*\
 | Selective Disclosure Exports                                 |
\*─────────────────────────────────────────────────────────────*/

export type {
  Disclosure,
  DisclosureDigest,
  SelectiveDisclosureDocument,
  EncodedDisclosure,
  SelectiveDisclosure,
  SelectiveDisclosurePresentation,
  VerificationResult,
  CreateSelectiveDisclosureOptions,
} from "./disclosure.js";

export {
  // Core API
  createSelectiveDisclosure,
  createPresentation,
  verifyPresentation,

  // Utilities
  getClaimKeys,
  isExpired,

  // Provenance helpers
  createAttributionDisclosure,
  createResourceDisclosure,

  // Serialization
  serializeSelectiveDisclosure,
  deserializeSelectiveDisclosure,
  serializePresentation,
  deserializePresentation,
} from "./disclosure.js";

/*─────────────────────────────────────────────────────────────*\
 | Commitment Scheme Exports                                    |
\*─────────────────────────────────────────────────────────────*/

export type {
  Commitment,
  CommitmentResult,
  CommitmentOpening,
  SerializedCommitment,
  WeightCommitment,
  WeightOpening,
} from "./commitments.js";

export {
  // Core commitment functions
  generateBlinding,
  commit,
  verify,

  // Homomorphic operations
  addCommitments,
  subtractCommitments,
  sumCommitments,
  sumBlindings,

  // Contribution weight helpers
  commitContributionWeights,
  verifyWeightSum,
  verifyWeightOpening,

  // Serialization
  serializeCommitment,
  deserializeCommitment,
  serializeWeightOpening,
  deserializeWeightOpening,

  // Contract integration
  commitmentToBytes,
  commitmentFromBytes,
  commitmentHash,
} from "./commitments.js";
