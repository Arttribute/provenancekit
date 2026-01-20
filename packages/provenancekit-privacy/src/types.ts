/**
 * Core types for ProvenanceKit Privacy
 *
 * Defines interfaces for encryption, key management, and access control.
 */

/*─────────────────────────────────────────────────────────────*\
 | Encryption Types                                             |
\*─────────────────────────────────────────────────────────────*/

/**
 * Supported symmetric encryption algorithms
 */
export type CipherAlgorithm =
  | "xchacha20-poly1305" // Recommended - extended nonce, safe with random nonces
  | "aes-256-gcm" // Standard, widely supported
  | "aes-256-gcm-siv" // Nonce-misuse resistant
  | "chacha20-poly1305"; // Standard ChaCha (shorter nonce)

/**
 * Result of an encryption operation
 */
export interface EncryptionResult {
  /** The encrypted data (ciphertext + auth tag) */
  ciphertext: Uint8Array;
  /** The nonce/IV used for encryption (must be stored with ciphertext) */
  nonce: Uint8Array;
  /** Algorithm used for encryption */
  algorithm: CipherAlgorithm;
}

/**
 * Serializable encryption envelope containing all data needed for decryption
 */
export interface EncryptionEnvelope {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded nonce */
  nonce: string;
  /** Algorithm identifier */
  algorithm: CipherAlgorithm;
  /** Version for future compatibility */
  version: "1.0";
}

/*─────────────────────────────────────────────────────────────*\
 | Key Derivation Types                                         |
\*─────────────────────────────────────────────────────────────*/

/**
 * Key derivation method
 */
export type KeyDerivationMethod =
  | "password" // PBKDF2 from password
  | "wallet" // Derived from wallet signature
  | "direct" // Direct key (already derived)
  | "lit-protocol"; // Key from Lit Protocol

/**
 * Options for password-based key derivation
 */
export interface PasswordKeyOptions {
  method: "password";
  /** The password to derive from */
  password: string;
  /** Salt for derivation (will be generated if not provided) */
  salt?: Uint8Array;
  /** Number of iterations (default: 100000) */
  iterations?: number;
  /** Hash algorithm (default: SHA-256) */
  hash?: "SHA-256" | "SHA-384" | "SHA-512";
}

/**
 * Options for wallet-based key derivation
 */
export interface WalletKeyOptions {
  method: "wallet";
  /** Message to sign for key derivation */
  message: string;
  /** The signature from the wallet */
  signature: string;
  /** Optional domain separator */
  domain?: string;
}

/**
 * Options for direct key usage
 */
export interface DirectKeyOptions {
  method: "direct";
  /** The key bytes (must be 32 bytes for 256-bit ciphers) */
  key: Uint8Array;
}

/**
 * Union of all key derivation options
 */
export type KeyDerivationOptions =
  | PasswordKeyOptions
  | WalletKeyOptions
  | DirectKeyOptions;

/**
 * Result of key derivation
 */
export interface DerivedKey {
  /** The derived key bytes */
  key: Uint8Array;
  /** Salt used (for password derivation) */
  salt?: Uint8Array;
  /** Method used for derivation */
  method: KeyDerivationMethod;
}

/*─────────────────────────────────────────────────────────────*\
 | Encryption Provider Interface                                |
\*─────────────────────────────────────────────────────────────*/

/**
 * Interface for encryption providers
 *
 * Allows swapping encryption backends while maintaining consistent API.
 */
export interface IEncryptionProvider {
  /** Provider name */
  readonly name: string;

  /** Supported algorithms */
  readonly supportedAlgorithms: CipherAlgorithm[];

  /**
   * Encrypt data
   * @param data - Data to encrypt
   * @param key - Encryption key (32 bytes)
   * @param algorithm - Cipher algorithm
   * @returns Encryption result with ciphertext and nonce
   */
  encrypt(
    data: Uint8Array,
    key: Uint8Array,
    algorithm?: CipherAlgorithm
  ): Promise<EncryptionResult>;

  /**
   * Decrypt data
   * @param ciphertext - Encrypted data
   * @param key - Decryption key (32 bytes)
   * @param nonce - Nonce used during encryption
   * @param algorithm - Cipher algorithm
   * @returns Decrypted plaintext
   */
  decrypt(
    ciphertext: Uint8Array,
    key: Uint8Array,
    nonce: Uint8Array,
    algorithm?: CipherAlgorithm
  ): Promise<Uint8Array>;
}

/*─────────────────────────────────────────────────────────────*\
 | Key Manager Interface                                        |
\*─────────────────────────────────────────────────────────────*/

/**
 * Interface for key management
 */
export interface IKeyManager {
  /**
   * Derive a key from the given options
   */
  deriveKey(options: KeyDerivationOptions): Promise<DerivedKey>;

  /**
   * Generate a random key
   * @param length - Key length in bytes (default: 32)
   */
  generateKey(length?: number): Uint8Array;

  /**
   * Generate a random nonce for the given algorithm
   */
  generateNonce(algorithm: CipherAlgorithm): Uint8Array;
}

/*─────────────────────────────────────────────────────────────*\
 | Encrypted Storage Types                                      |
\*─────────────────────────────────────────────────────────────*/

/**
 * Metadata stored with encrypted files
 */
export interface EncryptionMetadata {
  /** Algorithm used */
  algorithm: CipherAlgorithm;
  /** Key access method */
  keyAccess: KeyDerivationMethod;
  /** Salt for password derivation (base64) */
  salt?: string;
  /** Hash of original data for integrity verification */
  originalHash?: string;
  /** Original content type */
  contentType?: string;
  /** Original file size */
  originalSize?: number;
  /** Encryption timestamp */
  encryptedAt: string;
}

/**
 * Result of encrypting a file for storage
 */
export interface EncryptedFileResult {
  /** Encrypted data ready for upload */
  encryptedData: Uint8Array;
  /** Metadata to store alongside (in ext:storage or separate) */
  metadata: EncryptionMetadata;
  /** The envelope containing all decryption info (except key) */
  envelope: EncryptionEnvelope;
}

/*─────────────────────────────────────────────────────────────*\
 | Access Control Types (for Lit Protocol integration)          |
\*─────────────────────────────────────────────────────────────*/

/**
 * Access control condition for token gating
 */
export interface AccessControlCondition {
  /** Contract address */
  contractAddress: string;
  /** Chain identifier */
  chain: string;
  /** Contract method to call */
  method: string;
  /** Parameters for the method call */
  parameters: string[];
  /** Test to perform on return value */
  returnValueTest: {
    comparator: ">=" | ">" | "=" | "<" | "<=" | "contains";
    value: string;
  };
}

/**
 * Unified access control conditions (Lit Protocol format)
 */
export interface UnifiedAccessControlConditions {
  conditionType: "evmBasic" | "evmContract" | "solRpc" | "cosmos";
  conditions: AccessControlCondition[];
  operator?: "and" | "or";
}

/**
 * Key access via Lit Protocol
 */
export interface LitKeyAccess {
  method: "lit-protocol";
  /** Access control conditions */
  accessControlConditions: AccessControlCondition[];
  /** Chain for verification */
  chain: string;
  /** Hash of encrypted data (for integrity) */
  dataToEncryptHash: string;
}
