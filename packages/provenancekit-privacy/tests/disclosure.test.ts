/**
 * Tests for selective disclosure module
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createSelectiveDisclosure,
  createPresentation,
  verifyPresentation,
  getClaimKeys,
  isExpired,
  createAttributionDisclosure,
  createResourceDisclosure,
  serializeSelectiveDisclosure,
  deserializeSelectiveDisclosure,
  serializePresentation,
  deserializePresentation,
} from "../src/disclosure.js";
import { generateKey } from "../src/ciphers.js";

describe("Selective Disclosure", () => {
  let secret: Uint8Array;

  beforeEach(() => {
    secret = generateKey();
  });

  describe("createSelectiveDisclosure", () => {
    it("should create disclosure with all claims disclosable", () => {
      const claims = {
        name: "Alice",
        role: "author",
        weight: 6000,
      };

      const sd = createSelectiveDisclosure(claims, secret);

      expect(sd.document.version).toBe("sd-prov-1.0");
      expect(sd.document.digests).toHaveLength(3);
      expect(sd.disclosures).toHaveLength(3);
      expect(sd.document.signature).toBeDefined();
    });

    it("should include issuer and subject", () => {
      const sd = createSelectiveDisclosure(
        { claim: "value" },
        secret,
        {
          issuer: "did:example:issuer",
          subject: "did:example:subject",
        }
      );

      expect(sd.document.issuer).toBe("did:example:issuer");
      expect(sd.document.subject).toBe("did:example:subject");
    });

    it("should handle always-visible claims", () => {
      const claims = {
        public: "visible",
        private: "hidden",
        alsoPrivate: "also hidden",
      };

      const sd = createSelectiveDisclosure(claims, secret, {
        alwaysVisible: ["public"],
      });

      expect(sd.document.claims).toEqual({ public: "visible" });
      expect(sd.document.digests).toHaveLength(2);
      expect(sd.disclosures).toHaveLength(2);
    });

    it("should set expiration date", () => {
      const expiresAt = new Date("2030-01-01");
      const sd = createSelectiveDisclosure(
        { claim: "value" },
        secret,
        { expiresAt }
      );

      expect(sd.document.expiresAt).toBe(expiresAt.toISOString());
    });

    it("should handle complex claim values", () => {
      const claims = {
        nested: { foo: "bar", count: 42 },
        array: [1, 2, 3],
        boolean: true,
        null: null,
      };

      const sd = createSelectiveDisclosure(claims, secret);

      expect(sd.document.digests).toHaveLength(4);
      expect(sd.disclosures).toHaveLength(4);
    });
  });

  describe("createPresentation", () => {
    it("should reveal selected claims", () => {
      const sd = createSelectiveDisclosure(
        {
          name: "Alice",
          role: "author",
          weight: 6000,
        },
        secret
      );

      const presentation = createPresentation(sd, ["name", "role"]);

      expect(presentation.disclosures).toHaveLength(2);
      expect(presentation.document).toBe(sd.document);
    });

    it("should reveal no claims when empty array", () => {
      const sd = createSelectiveDisclosure(
        { a: 1, b: 2, c: 3 },
        secret
      );

      const presentation = createPresentation(sd, []);

      expect(presentation.disclosures).toHaveLength(0);
    });

    it("should handle non-existent keys gracefully", () => {
      const sd = createSelectiveDisclosure({ a: 1 }, secret);

      const presentation = createPresentation(sd, ["a", "nonexistent"]);

      expect(presentation.disclosures).toHaveLength(1);
    });
  });

  describe("verifyPresentation", () => {
    it("should verify valid presentation with all disclosures", () => {
      const claims = {
        name: "Alice",
        role: "author",
      };

      const sd = createSelectiveDisclosure(claims, secret);
      const presentation = createPresentation(sd, ["name", "role"]);
      const result = verifyPresentation(presentation, secret);

      expect(result.verified).toBe(true);
      expect(result.disclosed).toEqual(claims);
      expect(result.hidden).toHaveLength(0);
    });

    it("should verify presentation with partial disclosures", () => {
      const sd = createSelectiveDisclosure(
        {
          name: "Alice",
          role: "author",
          weight: 6000,
        },
        secret
      );

      const presentation = createPresentation(sd, ["name"]);
      const result = verifyPresentation(presentation, secret);

      expect(result.verified).toBe(true);
      expect(result.disclosed).toEqual({ name: "Alice" });
      expect(result.hidden).toContain("role");
      expect(result.hidden).toContain("weight");
    });

    it("should reject with wrong secret", () => {
      const sd = createSelectiveDisclosure({ name: "Alice" }, secret);
      const presentation = createPresentation(sd, ["name"]);

      const wrongSecret = generateKey();
      const result = verifyPresentation(presentation, wrongSecret);

      expect(result.verified).toBe(false);
      expect(result.error).toBe("Invalid signature");
    });

    it("should reject tampered disclosures", () => {
      const sd = createSelectiveDisclosure({ name: "Alice" }, secret);
      const presentation = createPresentation(sd, ["name"]);

      // Tamper with the disclosure
      const tamperedDisclosure = btoa(JSON.stringify(["salt", "name", "Bob"]));
      presentation.disclosures[0] = tamperedDisclosure;

      const result = verifyPresentation(presentation, secret);

      expect(result.verified).toBe(false);
      expect(result.error).toContain("Invalid disclosure");
    });

    it("should include always-visible claims in result", () => {
      const sd = createSelectiveDisclosure(
        {
          public: "visible",
          private: "hidden",
        },
        secret,
        { alwaysVisible: ["public"] }
      );

      const presentation = createPresentation(sd, []);
      const result = verifyPresentation(presentation, secret);

      expect(result.verified).toBe(true);
      expect(result.claims).toEqual({ public: "visible" });
      expect(result.hidden).toContain("private");
    });

    it("should detect expired presentations", () => {
      const sd = createSelectiveDisclosure(
        { name: "Alice" },
        secret,
        { expiresAt: new Date("2020-01-01") }
      );

      const presentation = createPresentation(sd, ["name"]);
      const result = verifyPresentation(presentation, secret);

      expect(result.verified).toBe(true);
      expect(result.expired).toBe(true);
    });

    it("should include issuer and subject in result", () => {
      const sd = createSelectiveDisclosure(
        { name: "Alice" },
        secret,
        {
          issuer: "did:example:issuer",
          subject: "did:example:alice",
        }
      );

      const presentation = createPresentation(sd, ["name"]);
      const result = verifyPresentation(presentation, secret);

      expect(result.issuer).toBe("did:example:issuer");
      expect(result.subject).toBe("did:example:alice");
    });
  });

  describe("getClaimKeys", () => {
    it("should return all disclosable keys", () => {
      const sd = createSelectiveDisclosure(
        { a: 1, b: 2, c: 3 },
        secret
      );

      const keys = getClaimKeys(sd);

      expect(keys).toContain("a");
      expect(keys).toContain("b");
      expect(keys).toContain("c");
    });

    it("should include always-visible keys", () => {
      const sd = createSelectiveDisclosure(
        { public: "visible", private: "hidden" },
        secret,
        { alwaysVisible: ["public"] }
      );

      const keys = getClaimKeys(sd);

      expect(keys).toContain("public");
      expect(keys).toContain("private");
    });
  });

  describe("isExpired", () => {
    it("should return false for non-expired presentation", () => {
      const sd = createSelectiveDisclosure(
        { name: "Alice" },
        secret,
        { expiresAt: new Date("2099-01-01") }
      );

      const presentation = createPresentation(sd, ["name"]);

      expect(isExpired(presentation)).toBe(false);
    });

    it("should return true for expired presentation", () => {
      const sd = createSelectiveDisclosure(
        { name: "Alice" },
        secret,
        { expiresAt: new Date("2020-01-01") }
      );

      const presentation = createPresentation(sd, ["name"]);

      expect(isExpired(presentation)).toBe(true);
    });

    it("should return false when no expiration", () => {
      const sd = createSelectiveDisclosure({ name: "Alice" }, secret);
      const presentation = createPresentation(sd, ["name"]);

      expect(isExpired(presentation)).toBe(false);
    });
  });

  describe("Provenance Helpers", () => {
    describe("createAttributionDisclosure", () => {
      it("should create attribution with entity always visible", () => {
        const sd = createAttributionDisclosure(
          {
            entity: { id: "did:example:alice", type: "human" },
            role: "author",
            weight: 6000,
            category: "design",
          },
          secret
        );

        expect(sd.document.claims?.entity).toBeDefined();
        expect(sd.document.digests.map((d) => d.key)).not.toContain("entity");
        expect(sd.document.digests.map((d) => d.key)).toContain("role");
        expect(sd.document.digests.map((d) => d.key)).toContain("weight");
      });

      it("should allow proving role without revealing weight", () => {
        const sd = createAttributionDisclosure(
          {
            entity: { id: "did:example:alice" },
            role: "author",
            weight: 6000,
          },
          secret
        );

        const presentation = createPresentation(sd, ["role"]);
        const result = verifyPresentation(presentation, secret);

        expect(result.verified).toBe(true);
        expect(result.disclosed.role).toBe("author");
        expect(result.disclosed.weight).toBeUndefined();
        expect(result.hidden).toContain("weight");
      });
    });

    describe("createResourceDisclosure", () => {
      it("should create resource with type and ref always visible", () => {
        const sd = createResourceDisclosure(
          {
            type: "document",
            ref: { ref: "bafyabc123", scheme: "ipfs" },
            name: "secret-doc.pdf",
            description: "Confidential document",
          },
          secret
        );

        expect(sd.document.claims?.type).toBe("document");
        expect(sd.document.claims?.ref).toBeDefined();
        expect(sd.document.digests.map((d) => d.key)).toContain("name");
        expect(sd.document.digests.map((d) => d.key)).toContain("description");
      });
    });
  });

  describe("Serialization", () => {
    it("should serialize and deserialize selective disclosure", () => {
      const sd = createSelectiveDisclosure(
        { name: "Alice", role: "author" },
        secret,
        { issuer: "did:example:issuer" }
      );

      const json = serializeSelectiveDisclosure(sd);
      const restored = deserializeSelectiveDisclosure(json);

      expect(restored.document.version).toBe(sd.document.version);
      expect(restored.document.issuer).toBe(sd.document.issuer);
      expect(restored.disclosures).toEqual(sd.disclosures);
    });

    it("should serialize and deserialize presentation", () => {
      const sd = createSelectiveDisclosure(
        { name: "Alice", role: "author" },
        secret
      );
      const presentation = createPresentation(sd, ["name"]);

      const json = serializePresentation(presentation);
      const restored = deserializePresentation(json);

      // Verify the restored presentation
      const result = verifyPresentation(restored, secret);

      expect(result.verified).toBe(true);
      expect(result.disclosed.name).toBe("Alice");
    });
  });

  describe("Real-World Scenarios", () => {
    it("should support contributor proving participation without revealing weight", () => {
      // Scenario: A contributor wants to prove they participated in a project
      // without revealing their exact contribution weight

      const attribution = {
        entity: { id: "did:example:alice", type: "human" },
        role: "contributor",
        weight: 6000, // 60% - sensitive!
        category: "engineering",
        agreedAt: "2025-01-15T10:00:00Z",
      };

      const sd = createAttributionDisclosure(attribution, secret, {
        issuer: "did:example:provenancekit",
        subject: "did:example:alice",
      });

      // Alice creates a presentation showing only that she's a contributor
      const presentation = createPresentation(sd, ["role", "category"]);

      // Verifier checks the presentation
      const result = verifyPresentation(presentation, secret);

      expect(result.verified).toBe(true);
      expect(result.disclosed.role).toBe("contributor");
      expect(result.disclosed.category).toBe("engineering");
      expect(result.disclosed.weight).toBeUndefined();
      expect(result.hidden).toContain("weight");
      expect(result.hidden).toContain("agreedAt");
    });

    it("should support proving license compliance without full provenance", () => {
      // Scenario: Someone wants to prove a resource is CC-BY licensed
      // without revealing all metadata

      const resource = {
        type: "image",
        ref: { ref: "bafyimage123", scheme: "ipfs" },
        name: "confidential-photo.jpg",
        description: "Photo from internal event",
        license: "CC-BY-4.0",
        author: "did:example:photographer",
      };

      const sd = createResourceDisclosure(resource, secret, {
        alwaysVisible: ["type", "ref", "license"],
      });

      // Create presentation showing only license
      const presentation = createPresentation(sd, []);

      const result = verifyPresentation(presentation, secret);

      expect(result.verified).toBe(true);
      expect(result.claims?.license).toBe("CC-BY-4.0");
      expect(result.claims?.type).toBe("image");
      expect(result.disclosed.name).toBeUndefined();
      expect(result.disclosed.author).toBeUndefined();
    });

    it("should support time-limited access proofs", () => {
      // Scenario: Grant access that expires after a set time

      const accessGrant = {
        resource: "premium-content",
        permissions: ["read", "download"],
        grantee: "did:example:subscriber",
      };

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Expires in 24 hours

      const sd = createSelectiveDisclosure(accessGrant, secret, {
        expiresAt,
        issuer: "did:example:platform",
      });

      const presentation = createPresentation(sd, ["resource", "permissions"]);
      const result = verifyPresentation(presentation, secret);

      expect(result.verified).toBe(true);
      expect(result.expired).toBe(false);
      expect(result.disclosed.resource).toBe("premium-content");
      expect(result.disclosed.permissions).toEqual(["read", "download"]);
    });
  });
});
