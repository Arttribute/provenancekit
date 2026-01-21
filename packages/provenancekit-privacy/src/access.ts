/**
 * Access Control for Token-Gated Encryption
 *
 * Provides interfaces and helpers for access-controlled encryption.
 * Designed to work with Lit Protocol but can support other backends.
 *
 * @example
 * ```ts
 * import { buildAccessCondition, AccessConditionType } from "@provenancekit/privacy";
 *
 * const condition = buildAccessCondition({
 *   type: AccessConditionType.ERC721,
 *   chain: "base",
 *   contractAddress: "0x...",
 *   method: "balanceOf",
 *   comparator: ">=",
 *   value: "1",
 * });
 * ```
 */

/*─────────────────────────────────────────────────────────────*\
 | Supported Chains                                             |
\*─────────────────────────────────────────────────────────────*/

export type SupportedChain =
  | "ethereum"
  | "polygon"
  | "arbitrum"
  | "optimism"
  | "base"
  | "sepolia"
  | "baseSepolia"
  | "polygonMumbai";

export const CHAIN_IDS: Record<SupportedChain, number> = {
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  sepolia: 11155111,
  baseSepolia: 84532,
  polygonMumbai: 80001,
};

/*─────────────────────────────────────────────────────────────*\
 | Access Condition Types                                       |
\*─────────────────────────────────────────────────────────────*/

/**
 * Types of access conditions supported
 */
export enum AccessConditionType {
  /** ERC-20 token balance check */
  ERC20 = "erc20",
  /** ERC-721 NFT ownership check */
  ERC721 = "erc721",
  /** ERC-1155 multi-token balance check */
  ERC1155 = "erc1155",
  /** Custom contract method call */
  CONTRACT = "contract",
  /** SIWE (Sign-In with Ethereum) authentication */
  SIWE = "siwe",
  /** Always true (public access) */
  PUBLIC = "public",
}

/**
 * Comparison operators for access conditions
 */
export type Comparator = "=" | "!=" | ">" | "<" | ">=" | "<=";

/**
 * Logical operators for combining conditions
 */
export type LogicalOperator = "and" | "or";

/*─────────────────────────────────────────────────────────────*\
 | Access Condition Interfaces                                  |
\*─────────────────────────────────────────────────────────────*/

/**
 * Base interface for all access conditions
 */
export interface BaseAccessCondition {
  type: AccessConditionType;
  chain?: SupportedChain;
}

/**
 * ERC-20 token balance condition
 */
export interface ERC20Condition extends BaseAccessCondition {
  type: AccessConditionType.ERC20;
  chain: SupportedChain;
  contractAddress: string;
  /** Minimum balance required (as string for BigInt support) */
  minBalance: string;
  /** Token decimals (default: 18) */
  decimals?: number;
}

/**
 * ERC-721 NFT ownership condition
 */
export interface ERC721Condition extends BaseAccessCondition {
  type: AccessConditionType.ERC721;
  chain: SupportedChain;
  contractAddress: string;
  /** Minimum number of NFTs required (default: 1) */
  minBalance?: string;
  /** Specific token ID required (optional) */
  tokenId?: string;
}

/**
 * ERC-1155 multi-token condition
 */
export interface ERC1155Condition extends BaseAccessCondition {
  type: AccessConditionType.ERC1155;
  chain: SupportedChain;
  contractAddress: string;
  tokenId: string;
  minBalance: string;
}

/**
 * Custom contract method call condition
 */
export interface ContractCondition extends BaseAccessCondition {
  type: AccessConditionType.CONTRACT;
  chain: SupportedChain;
  contractAddress: string;
  /** Method name or function signature */
  method: string;
  /** ABI for the method (optional, for complex methods) */
  abi?: string;
  /** Parameters to pass to the method (use ":userAddress" for caller) */
  parameters: string[];
  /** Expected return value comparison */
  returnValueTest: {
    comparator: Comparator;
    value: string;
  };
}

/**
 * SIWE authentication condition
 */
export interface SIWECondition extends BaseAccessCondition {
  type: AccessConditionType.SIWE;
  /** Allowed wallet addresses (empty = any authenticated wallet) */
  allowedAddresses?: string[];
}

/**
 * Public access (no restrictions)
 */
export interface PublicCondition extends BaseAccessCondition {
  type: AccessConditionType.PUBLIC;
}

/**
 * Union of all access condition types
 */
export type AccessCondition =
  | ERC20Condition
  | ERC721Condition
  | ERC1155Condition
  | ContractCondition
  | SIWECondition
  | PublicCondition;

/**
 * Combined conditions with logical operators
 */
export interface CombinedConditions {
  conditions: AccessCondition[];
  operator: LogicalOperator;
}

/**
 * Full access control specification
 */
export type AccessControlSpec = AccessCondition | CombinedConditions;

/*─────────────────────────────────────────────────────────────*\
 | Lit Protocol Format (for compatibility)                      |
\*─────────────────────────────────────────────────────────────*/

/**
 * Lit Protocol Access Control Condition format
 * https://developer.litprotocol.com/sdk/access-control/evm/basic-examples
 */
export interface LitAccessControlCondition {
  contractAddress: string;
  standardContractType?: "ERC20" | "ERC721" | "ERC1155" | "";
  chain: string;
  method: string;
  parameters: string[];
  returnValueTest: {
    comparator: string;
    value: string;
  };
}

/**
 * Lit Protocol operator for combining conditions
 */
export interface LitOperator {
  operator: "and" | "or";
}

/**
 * Lit unified access control conditions (can include operators)
 */
export type LitUnifiedConditions = (LitAccessControlCondition | LitOperator)[];

/*─────────────────────────────────────────────────────────────*\
 | Condition Builders                                           |
\*─────────────────────────────────────────────────────────────*/

/**
 * Build an ERC-20 token balance condition
 */
export function erc20Condition(
  chain: SupportedChain,
  contractAddress: string,
  minBalance: string | bigint,
  decimals = 18
): ERC20Condition {
  return {
    type: AccessConditionType.ERC20,
    chain,
    contractAddress: contractAddress.toLowerCase(),
    minBalance: minBalance.toString(),
    decimals,
  };
}

/**
 * Build an ERC-721 NFT ownership condition
 */
export function erc721Condition(
  chain: SupportedChain,
  contractAddress: string,
  options?: { minBalance?: string | number; tokenId?: string | bigint }
): ERC721Condition {
  return {
    type: AccessConditionType.ERC721,
    chain,
    contractAddress: contractAddress.toLowerCase(),
    minBalance: options?.minBalance?.toString() ?? "1",
    tokenId: options?.tokenId?.toString(),
  };
}

/**
 * Build an ERC-1155 multi-token condition
 */
export function erc1155Condition(
  chain: SupportedChain,
  contractAddress: string,
  tokenId: string | bigint,
  minBalance: string | bigint = "1"
): ERC1155Condition {
  return {
    type: AccessConditionType.ERC1155,
    chain,
    contractAddress: contractAddress.toLowerCase(),
    tokenId: tokenId.toString(),
    minBalance: minBalance.toString(),
  };
}

/**
 * Build a custom contract method condition
 */
export function contractCondition(
  chain: SupportedChain,
  contractAddress: string,
  method: string,
  parameters: string[],
  returnValueTest: { comparator: Comparator; value: string },
  abi?: string
): ContractCondition {
  return {
    type: AccessConditionType.CONTRACT,
    chain,
    contractAddress: contractAddress.toLowerCase(),
    method,
    parameters,
    returnValueTest,
    abi,
  };
}

/**
 * Build a SIWE authentication condition.
 *
 * @remarks
 * When converting to Lit Protocol format via `toLitCondition()`, only the first
 * address in `allowedAddresses` is used. For multiple allowed addresses, use
 * `anyOf()` to combine multiple SIWE conditions, or use `allowAddresses()` helper.
 *
 * @example
 * ```ts
 * // Single address
 * siweCondition(["0x123..."]);
 *
 * // Multiple addresses - use anyOf
 * anyOf(
 *   siweCondition(["0x123..."]),
 *   siweCondition(["0x456..."])
 * );
 *
 * // Or use helper
 * allowAddresses("0x123...", "0x456...");
 * ```
 */
export function siweCondition(allowedAddresses?: string[]): SIWECondition {
  return {
    type: AccessConditionType.SIWE,
    allowedAddresses: allowedAddresses?.map((a) => a.toLowerCase()),
  };
}

/**
 * Build a public access condition (no restrictions)
 */
export function publicCondition(): PublicCondition {
  return { type: AccessConditionType.PUBLIC };
}

/**
 * Combine multiple conditions with AND
 */
export function allOf(...conditions: AccessCondition[]): CombinedConditions {
  return { conditions, operator: "and" };
}

/**
 * Combine multiple conditions with OR
 */
export function anyOf(...conditions: AccessCondition[]): CombinedConditions {
  return { conditions, operator: "or" };
}

/*─────────────────────────────────────────────────────────────*\
 | Convert to Lit Protocol Format                               |
\*─────────────────────────────────────────────────────────────*/

/**
 * Convert a single condition to Lit Protocol format
 */
export function toLitCondition(
  condition: AccessCondition
): LitAccessControlCondition {
  switch (condition.type) {
    case AccessConditionType.ERC20:
      return {
        contractAddress: condition.contractAddress,
        standardContractType: "ERC20",
        chain: condition.chain,
        method: "balanceOf",
        parameters: [":userAddress"],
        returnValueTest: {
          comparator: ">=",
          value: condition.minBalance,
        },
      };

    case AccessConditionType.ERC721:
      if (condition.tokenId) {
        return {
          contractAddress: condition.contractAddress,
          standardContractType: "ERC721",
          chain: condition.chain,
          method: "ownerOf",
          parameters: [condition.tokenId],
          returnValueTest: {
            comparator: "=",
            value: ":userAddress",
          },
        };
      }
      return {
        contractAddress: condition.contractAddress,
        standardContractType: "ERC721",
        chain: condition.chain,
        method: "balanceOf",
        parameters: [":userAddress"],
        returnValueTest: {
          comparator: ">=",
          value: condition.minBalance ?? "1",
        },
      };

    case AccessConditionType.ERC1155:
      return {
        contractAddress: condition.contractAddress,
        standardContractType: "ERC1155",
        chain: condition.chain,
        method: "balanceOf",
        parameters: [":userAddress", condition.tokenId],
        returnValueTest: {
          comparator: ">=",
          value: condition.minBalance,
        },
      };

    case AccessConditionType.CONTRACT:
      return {
        contractAddress: condition.contractAddress,
        standardContractType: "",
        chain: condition.chain,
        method: condition.method,
        parameters: condition.parameters,
        returnValueTest: condition.returnValueTest,
      };

    case AccessConditionType.SIWE:
      // SIWE in Lit is handled differently - return a basic wallet check
      // NOTE: Only first address is used. For multiple addresses, use anyOf() combinator.
      return {
        contractAddress: "",
        standardContractType: "",
        chain: "ethereum",
        method: "",
        parameters: [],
        returnValueTest: {
          comparator: "=",
          value: condition.allowedAddresses?.[0] ?? ":userAddress",
        },
      };

    case AccessConditionType.PUBLIC:
      // Public means no real condition - return always true
      return {
        contractAddress: "",
        standardContractType: "",
        chain: "ethereum",
        method: "",
        parameters: [],
        returnValueTest: {
          comparator: "=",
          value: "true",
        },
      };
  }
}

/**
 * Convert access control spec to Lit Protocol unified conditions
 */
export function toLitUnifiedConditions(
  spec: AccessControlSpec
): LitUnifiedConditions {
  // Single condition
  if ("type" in spec) {
    return [toLitCondition(spec)];
  }

  // Combined conditions
  const result: LitUnifiedConditions = [];
  for (let i = 0; i < spec.conditions.length; i++) {
    if (i > 0) {
      result.push({ operator: spec.operator });
    }
    result.push(toLitCondition(spec.conditions[i]));
  }
  return result;
}

/*─────────────────────────────────────────────────────────────*\
 | IAccessControlProvider Interface                             |
\*─────────────────────────────────────────────────────────────*/

/**
 * Result of encrypting with access control
 */
export interface AccessControlledEncryptionResult {
  /** Encrypted ciphertext */
  ciphertext: Uint8Array;
  /** Hash of original data (for verification) */
  dataHash: string;
  /** Access conditions used */
  accessConditions: AccessControlSpec;
  /** Provider-specific metadata (e.g., Lit Protocol's encryptedSymmetricKey) */
  metadata: Record<string, unknown>;
}

/**
 * Interface for access control providers (e.g., Lit Protocol)
 */
export interface IAccessControlProvider {
  /** Provider name */
  readonly name: string;

  /** Initialize the provider */
  initialize(): Promise<void>;

  /** Disconnect/cleanup */
  disconnect(): Promise<void>;

  /**
   * Encrypt data with access control
   * @param data Data to encrypt
   * @param accessConditions Who can decrypt
   * @returns Encrypted result with metadata
   */
  encrypt(
    data: Uint8Array,
    accessConditions: AccessControlSpec
  ): Promise<AccessControlledEncryptionResult>;

  /**
   * Decrypt access-controlled data
   * @param encryptedResult Result from encrypt()
   * @returns Decrypted data
   */
  decrypt(
    encryptedResult: AccessControlledEncryptionResult
  ): Promise<Uint8Array>;

  /**
   * Check if current user meets access conditions
   * @param accessConditions Conditions to check
   * @returns True if user can access
   */
  checkAccess(accessConditions: AccessControlSpec): Promise<boolean>;
}

/*─────────────────────────────────────────────────────────────*\
 | Common Access Patterns                                       |
\*─────────────────────────────────────────────────────────────*/

/**
 * Require ownership of a specific NFT collection
 */
export function requireNFT(
  chain: SupportedChain,
  contractAddress: string,
  minOwned = 1
): AccessCondition {
  return erc721Condition(chain, contractAddress, {
    minBalance: minOwned.toString(),
  });
}

/**
 * Require a minimum token balance
 */
export function requireTokens(
  chain: SupportedChain,
  contractAddress: string,
  minBalance: bigint,
  decimals = 18
): AccessCondition {
  return erc20Condition(chain, contractAddress, minBalance.toString(), decimals);
}

/**
 * Require membership in a DAO (via governance token)
 */
export function requireDAOMembership(
  chain: SupportedChain,
  governanceTokenAddress: string,
  minVotingPower: bigint = 1n
): AccessCondition {
  return erc20Condition(
    chain,
    governanceTokenAddress,
    minVotingPower.toString()
  );
}

/**
 * Require being the owner of a specific NFT
 */
export function requireNFTOwner(
  chain: SupportedChain,
  contractAddress: string,
  tokenId: string | bigint
): AccessCondition {
  return erc721Condition(chain, contractAddress, {
    tokenId: tokenId.toString(),
  });
}

/**
 * Allow access to a specific list of addresses
 */
export function allowAddresses(...addresses: string[]): AccessCondition {
  return siweCondition(addresses);
}
