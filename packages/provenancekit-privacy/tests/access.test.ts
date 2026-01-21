/**
 * Tests for access control module
 */

import { describe, it, expect } from "vitest";
import {
  // Types
  AccessConditionType,
  CHAIN_IDS,

  // Builders
  erc20Condition,
  erc721Condition,
  erc1155Condition,
  contractCondition,
  siweCondition,
  publicCondition,

  // Combinators
  allOf,
  anyOf,

  // Converters
  toLitCondition,
  toLitUnifiedConditions,

  // Patterns
  requireNFT,
  requireTokens,
  requireDAOMembership,
  requireNFTOwner,
  allowAddresses,
} from "../src/access.js";

describe("Access Control", () => {
  describe("Chain IDs", () => {
    it("should have correct chain IDs", () => {
      expect(CHAIN_IDS.ethereum).toBe(1);
      expect(CHAIN_IDS.polygon).toBe(137);
      expect(CHAIN_IDS.arbitrum).toBe(42161);
      expect(CHAIN_IDS.optimism).toBe(10);
      expect(CHAIN_IDS.base).toBe(8453);
      expect(CHAIN_IDS.sepolia).toBe(11155111);
      expect(CHAIN_IDS.baseSepolia).toBe(84532);
    });
  });

  describe("Condition Builders", () => {
    describe("erc20Condition", () => {
      it("should create ERC-20 condition with defaults", () => {
        const condition = erc20Condition(
          "base",
          "0x1234567890123456789012345678901234567890",
          "1000000000000000000"
        );

        expect(condition.type).toBe(AccessConditionType.ERC20);
        expect(condition.chain).toBe("base");
        expect(condition.contractAddress).toBe(
          "0x1234567890123456789012345678901234567890"
        );
        expect(condition.minBalance).toBe("1000000000000000000");
        expect(condition.decimals).toBe(18);
      });

      it("should accept bigint for minBalance", () => {
        const condition = erc20Condition(
          "ethereum",
          "0x1234567890123456789012345678901234567890",
          1000000000000000000n,
          6
        );

        expect(condition.minBalance).toBe("1000000000000000000");
        expect(condition.decimals).toBe(6);
      });

      it("should lowercase contract address", () => {
        const condition = erc20Condition(
          "polygon",
          "0xABCDEF1234567890123456789012345678901234",
          "100"
        );

        expect(condition.contractAddress).toBe(
          "0xabcdef1234567890123456789012345678901234"
        );
      });
    });

    describe("erc721Condition", () => {
      it("should create basic NFT ownership condition", () => {
        const condition = erc721Condition(
          "base",
          "0x1234567890123456789012345678901234567890"
        );

        expect(condition.type).toBe(AccessConditionType.ERC721);
        expect(condition.chain).toBe("base");
        expect(condition.minBalance).toBe("1");
        expect(condition.tokenId).toBeUndefined();
      });

      it("should support minBalance option", () => {
        const condition = erc721Condition(
          "ethereum",
          "0x1234567890123456789012345678901234567890",
          { minBalance: 5 }
        );

        expect(condition.minBalance).toBe("5");
      });

      it("should support specific tokenId", () => {
        const condition = erc721Condition(
          "polygon",
          "0x1234567890123456789012345678901234567890",
          { tokenId: 42n }
        );

        expect(condition.tokenId).toBe("42");
      });
    });

    describe("erc1155Condition", () => {
      it("should create ERC-1155 condition", () => {
        const condition = erc1155Condition(
          "arbitrum",
          "0x1234567890123456789012345678901234567890",
          "123",
          "5"
        );

        expect(condition.type).toBe(AccessConditionType.ERC1155);
        expect(condition.chain).toBe("arbitrum");
        expect(condition.tokenId).toBe("123");
        expect(condition.minBalance).toBe("5");
      });

      it("should default minBalance to 1", () => {
        const condition = erc1155Condition(
          "base",
          "0x1234567890123456789012345678901234567890",
          "999"
        );

        expect(condition.minBalance).toBe("1");
      });
    });

    describe("contractCondition", () => {
      it("should create custom contract condition", () => {
        const condition = contractCondition(
          "base",
          "0x1234567890123456789012345678901234567890",
          "hasAccess",
          [":userAddress", "123"],
          { comparator: "=", value: "true" }
        );

        expect(condition.type).toBe(AccessConditionType.CONTRACT);
        expect(condition.method).toBe("hasAccess");
        expect(condition.parameters).toEqual([":userAddress", "123"]);
        expect(condition.returnValueTest).toEqual({
          comparator: "=",
          value: "true",
        });
      });

      it("should support ABI parameter", () => {
        const condition = contractCondition(
          "ethereum",
          "0x1234567890123456789012345678901234567890",
          "customMethod",
          [],
          { comparator: ">=", value: "100" },
          '[{"name":"customMethod","type":"function"}]'
        );

        expect(condition.abi).toBe(
          '[{"name":"customMethod","type":"function"}]'
        );
      });
    });

    describe("siweCondition", () => {
      it("should create SIWE condition without addresses", () => {
        const condition = siweCondition();

        expect(condition.type).toBe(AccessConditionType.SIWE);
        expect(condition.allowedAddresses).toBeUndefined();
      });

      it("should create SIWE condition with allowed addresses", () => {
        const condition = siweCondition([
          "0xABCD1234567890123456789012345678901234EF",
          "0x9876543210ABCDEF9876543210ABCDEF98765432",
        ]);

        expect(condition.allowedAddresses).toEqual([
          "0xabcd1234567890123456789012345678901234ef",
          "0x9876543210abcdef9876543210abcdef98765432",
        ]);
      });
    });

    describe("publicCondition", () => {
      it("should create public access condition", () => {
        const condition = publicCondition();

        expect(condition.type).toBe(AccessConditionType.PUBLIC);
      });
    });
  });

  describe("Combinators", () => {
    const nftCondition = erc721Condition(
      "base",
      "0x1111111111111111111111111111111111111111"
    );
    const tokenCondition = erc20Condition(
      "base",
      "0x2222222222222222222222222222222222222222",
      "1000"
    );

    describe("allOf", () => {
      it("should combine conditions with AND", () => {
        const combined = allOf(nftCondition, tokenCondition);

        expect(combined.operator).toBe("and");
        expect(combined.conditions).toHaveLength(2);
        expect(combined.conditions[0]).toBe(nftCondition);
        expect(combined.conditions[1]).toBe(tokenCondition);
      });
    });

    describe("anyOf", () => {
      it("should combine conditions with OR", () => {
        const combined = anyOf(nftCondition, tokenCondition);

        expect(combined.operator).toBe("or");
        expect(combined.conditions).toHaveLength(2);
      });
    });
  });

  describe("Common Access Patterns", () => {
    describe("requireNFT", () => {
      it("should create NFT requirement", () => {
        const condition = requireNFT(
          "base",
          "0x1234567890123456789012345678901234567890"
        );

        expect(condition.type).toBe(AccessConditionType.ERC721);
        expect((condition as any).minBalance).toBe("1");
      });

      it("should support custom minOwned", () => {
        const condition = requireNFT(
          "ethereum",
          "0x1234567890123456789012345678901234567890",
          3
        );

        expect((condition as any).minBalance).toBe("3");
      });
    });

    describe("requireTokens", () => {
      it("should create token balance requirement", () => {
        const condition = requireTokens(
          "polygon",
          "0x1234567890123456789012345678901234567890",
          1000000n
        );

        expect(condition.type).toBe(AccessConditionType.ERC20);
        expect((condition as any).minBalance).toBe("1000000");
      });
    });

    describe("requireDAOMembership", () => {
      it("should create DAO membership requirement", () => {
        const condition = requireDAOMembership(
          "arbitrum",
          "0x1234567890123456789012345678901234567890"
        );

        expect(condition.type).toBe(AccessConditionType.ERC20);
        expect((condition as any).minBalance).toBe("1");
      });

      it("should support custom voting power", () => {
        const condition = requireDAOMembership(
          "base",
          "0x1234567890123456789012345678901234567890",
          1000000000000000000n
        );

        expect((condition as any).minBalance).toBe("1000000000000000000");
      });
    });

    describe("requireNFTOwner", () => {
      it("should create specific NFT ownership requirement", () => {
        const condition = requireNFTOwner(
          "base",
          "0x1234567890123456789012345678901234567890",
          "42"
        );

        expect(condition.type).toBe(AccessConditionType.ERC721);
        expect((condition as any).tokenId).toBe("42");
      });
    });

    describe("allowAddresses", () => {
      it("should create address allowlist", () => {
        const condition = allowAddresses(
          "0x1111111111111111111111111111111111111111",
          "0x2222222222222222222222222222222222222222"
        );

        expect(condition.type).toBe(AccessConditionType.SIWE);
        expect((condition as any).allowedAddresses).toHaveLength(2);
      });
    });
  });

  describe("Lit Protocol Conversion", () => {
    describe("toLitCondition", () => {
      it("should convert ERC-20 condition", () => {
        const condition = erc20Condition(
          "base",
          "0x1234567890123456789012345678901234567890",
          "1000000000000000000"
        );

        const lit = toLitCondition(condition);

        expect(lit.standardContractType).toBe("ERC20");
        expect(lit.chain).toBe("base");
        expect(lit.method).toBe("balanceOf");
        expect(lit.parameters).toEqual([":userAddress"]);
        expect(lit.returnValueTest.comparator).toBe(">=");
        expect(lit.returnValueTest.value).toBe("1000000000000000000");
      });

      it("should convert ERC-721 balance condition", () => {
        const condition = erc721Condition(
          "ethereum",
          "0x1234567890123456789012345678901234567890",
          { minBalance: 2 }
        );

        const lit = toLitCondition(condition);

        expect(lit.standardContractType).toBe("ERC721");
        expect(lit.method).toBe("balanceOf");
        expect(lit.returnValueTest.comparator).toBe(">=");
        expect(lit.returnValueTest.value).toBe("2");
      });

      it("should convert ERC-721 ownerOf condition", () => {
        const condition = erc721Condition(
          "polygon",
          "0x1234567890123456789012345678901234567890",
          { tokenId: "42" }
        );

        const lit = toLitCondition(condition);

        expect(lit.method).toBe("ownerOf");
        expect(lit.parameters).toEqual(["42"]);
        expect(lit.returnValueTest.comparator).toBe("=");
        expect(lit.returnValueTest.value).toBe(":userAddress");
      });

      it("should convert ERC-1155 condition", () => {
        const condition = erc1155Condition(
          "arbitrum",
          "0x1234567890123456789012345678901234567890",
          "123",
          "5"
        );

        const lit = toLitCondition(condition);

        expect(lit.standardContractType).toBe("ERC1155");
        expect(lit.method).toBe("balanceOf");
        expect(lit.parameters).toEqual([":userAddress", "123"]);
        expect(lit.returnValueTest.value).toBe("5");
      });

      it("should convert custom contract condition", () => {
        const condition = contractCondition(
          "base",
          "0x1234567890123456789012345678901234567890",
          "hasRole",
          [":userAddress", "0x123"],
          { comparator: "=", value: "true" }
        );

        const lit = toLitCondition(condition);

        expect(lit.standardContractType).toBe("");
        expect(lit.method).toBe("hasRole");
        expect(lit.parameters).toEqual([":userAddress", "0x123"]);
        expect(lit.returnValueTest).toEqual({
          comparator: "=",
          value: "true",
        });
      });
    });

    describe("toLitUnifiedConditions", () => {
      it("should convert single condition", () => {
        const condition = requireNFT(
          "base",
          "0x1234567890123456789012345678901234567890"
        );

        const unified = toLitUnifiedConditions(condition);

        expect(unified).toHaveLength(1);
        expect((unified[0] as any).standardContractType).toBe("ERC721");
      });

      it("should convert combined conditions with AND", () => {
        const nft = requireNFT(
          "base",
          "0x1111111111111111111111111111111111111111"
        );
        const tokens = requireTokens(
          "base",
          "0x2222222222222222222222222222222222222222",
          1000n
        );

        const combined = allOf(nft, tokens);
        const unified = toLitUnifiedConditions(combined);

        expect(unified).toHaveLength(3); // condition, operator, condition
        expect((unified[0] as any).standardContractType).toBe("ERC721");
        expect((unified[1] as any).operator).toBe("and");
        expect((unified[2] as any).standardContractType).toBe("ERC20");
      });

      it("should convert combined conditions with OR", () => {
        const nft1 = requireNFT(
          "base",
          "0x1111111111111111111111111111111111111111"
        );
        const nft2 = requireNFT(
          "base",
          "0x2222222222222222222222222222222222222222"
        );
        const nft3 = requireNFT(
          "base",
          "0x3333333333333333333333333333333333333333"
        );

        const combined = anyOf(nft1, nft2, nft3);
        const unified = toLitUnifiedConditions(combined);

        // 3 conditions with 2 operators between them
        expect(unified).toHaveLength(5);
        expect((unified[1] as any).operator).toBe("or");
        expect((unified[3] as any).operator).toBe("or");
      });
    });
  });

  describe("Real-World Scenarios", () => {
    it("should support NFT-gated content", () => {
      // User must own at least 1 NFT from the collection
      const condition = requireNFT(
        "base",
        "0xProvenanceNFT00000000000000000000000000"
      );

      const lit = toLitUnifiedConditions(condition);

      expect(lit).toHaveLength(1);
      expect((lit[0] as any).method).toBe("balanceOf");
    });

    it("should support multi-requirement access", () => {
      // User must own NFT AND have 100 tokens
      const hasNFT = requireNFT(
        "base",
        "0xProvenanceNFT00000000000000000000000000"
      );
      const hasTokens = requireTokens(
        "base",
        "0xProvenanceToken000000000000000000000000",
        100n * 10n ** 18n
      );

      const combined = allOf(hasNFT, hasTokens);
      const lit = toLitUnifiedConditions(combined);

      expect(lit).toHaveLength(3);
      expect((lit[1] as any).operator).toBe("and");
    });

    it("should support tiered access", () => {
      // User can access with EITHER gold NFT OR 1000 tokens
      const goldNFT = requireNFT(
        "base",
        "0xGoldNFT00000000000000000000000000000000"
      );
      const manyTokens = requireTokens(
        "base",
        "0xToken0000000000000000000000000000000000",
        1000n * 10n ** 18n
      );

      const combined = anyOf(goldNFT, manyTokens);
      const lit = toLitUnifiedConditions(combined);

      expect(lit).toHaveLength(3);
      expect((lit[1] as any).operator).toBe("or");
    });

    it("should support DAO-gated access", () => {
      // Only DAO members with voting power can access
      const condition = requireDAOMembership(
        "arbitrum",
        "0xDAOGovernanceToken000000000000000000000",
        1000n * 10n ** 18n // 1000 voting tokens
      );

      const lit = toLitCondition(condition);

      expect(lit.standardContractType).toBe("ERC20");
      expect(lit.returnValueTest.value).toBe("1000000000000000000000");
    });
  });
});
