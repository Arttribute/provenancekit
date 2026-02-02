/**
 * Tests for reader module.
 *
 * Note: Many tests require c2pa-node which is an optional dependency.
 * Tests that require c2pa-node are skipped when it's not available.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { isC2PAAvailable, parseManifestJson } from "./index.js";
import { MediaError } from "../types.js";

/*─────────────────────────────────────────────────────────────*\
 | isC2PAAvailable Tests                                        |
\*─────────────────────────────────────────────────────────────*/

describe("isC2PAAvailable", () => {
  it("should return boolean", async () => {
    const available = await isC2PAAvailable();
    expect(typeof available).toBe("boolean");
  });
});

/*─────────────────────────────────────────────────────────────*\
 | parseManifestJson Tests                                      |
\*─────────────────────────────────────────────────────────────*/

describe("parseManifestJson", () => {
  it("should throw if no active manifest", () => {
    const json = {};

    expect(() => parseManifestJson(json)).toThrow(MediaError);
    expect(() => parseManifestJson(json)).toThrow("No active manifest found");
  });

  it("should parse minimal manifest", () => {
    const json = {
      active_manifest: {
        label: "urn:uuid:test-manifest",
        claim_generator: "TestApp/1.0",
        claim: {},
      },
    };

    const result = parseManifestJson(json);

    expect(result.manifestLabel).toBe("urn:uuid:test-manifest");
    expect(result.claimGenerator).toBe("TestApp/1.0");
  });

  it("should extract claim generator info", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "ProvenanceKit",
        claim_generator_info: [
          { name: "ProvenanceKit", version: "1.0.0" },
        ],
        claim: {},
      },
    };

    const result = parseManifestJson(json);

    expect(result.claimGenerator).toBe("ProvenanceKit");
    expect(result.claimGeneratorVersion).toBe("1.0.0");
  });

  it("should extract title from dc:title", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {
          "dc:title": "My Photo",
        },
      },
    };

    const result = parseManifestJson(json);

    expect(result.title).toBe("My Photo");
  });

  it("should extract title from title field", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {
          title: "Fallback Title",
        },
      },
    };

    const result = parseManifestJson(json);

    expect(result.title).toBe("Fallback Title");
  });

  it("should extract format", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {
          "dc:format": "image/jpeg",
        },
      },
    };

    const result = parseManifestJson(json);

    expect(result.format).toBe("image/jpeg");
  });

  it("should extract instance ID", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {
          instanceID: "xmp.iid:12345",
        },
      },
    };

    const result = parseManifestJson(json);

    expect(result.instanceId).toBe("xmp.iid:12345");
  });

  it("should parse actions", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {},
        assertions: {
          "c2pa.actions": {
            actions: [
              {
                action: "c2pa.created",
                when: "2025-01-01T00:00:00Z",
                softwareAgent: { name: "Camera", version: "1.0" },
                digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture",
                reason: "Initial capture",
              },
              {
                action: "c2pa.edited",
              },
            ],
          },
        },
      },
    };

    const result = parseManifestJson(json);

    expect(result.actions).toHaveLength(2);
    expect(result.actions?.[0]?.action).toBe("c2pa.created");
    expect(result.actions?.[0]?.when).toBe("2025-01-01T00:00:00Z");
    expect(result.actions?.[0]?.softwareAgent?.name).toBe("Camera");
    expect(result.actions?.[0]?.digitalSourceType).toBeDefined();
    expect(result.actions?.[0]?.reason).toBe("Initial capture");
    expect(result.actions?.[1]?.action).toBe("c2pa.edited");
  });

  it("should parse ingredients", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {},
        ingredients: [
          {
            title: "Source Image",
            format: "image/png",
            document_id: "doc:123",
            instance_id: "inst:456",
            hash: "sha256:abc",
            is_parent: true,
            relationship: "parentOf",
          },
          {
            title: "Overlay",
          },
        ],
      },
    };

    const result = parseManifestJson(json);

    expect(result.ingredients).toHaveLength(2);
    expect(result.ingredients?.[0]?.title).toBe("Source Image");
    expect(result.ingredients?.[0]?.format).toBe("image/png");
    expect(result.ingredients?.[0]?.documentId).toBe("doc:123");
    expect(result.ingredients?.[0]?.instanceId).toBe("inst:456");
    expect(result.ingredients?.[0]?.hash).toBe("sha256:abc");
    expect(result.ingredients?.[0]?.isParent).toBe(true);
    expect(result.ingredients?.[0]?.relationship).toBe("parentOf");
    expect(result.ingredients?.[1]?.title).toBe("Overlay");
  });

  it("should parse signature info", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {},
        signature_info: {
          alg: "es256",
          issuer: "CN=Test CA",
          time: "2025-01-01T00:00:00Z",
        },
      },
    };

    const result = parseManifestJson(json);

    expect(result.signature?.algorithm).toBe("es256");
    expect(result.signature?.issuer).toBe("CN=Test CA");
    expect(result.signature?.timestamp).toBe("2025-01-01T00:00:00Z");
  });

  it("should parse validation status with errors", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {},
        validation_status: [
          { code: "error.signature", explanation: "Invalid signature" },
          { code: "error.hash", explanation: "Hash mismatch" },
        ],
      },
    };

    const result = parseManifestJson(json);

    expect(result.validationStatus?.isValid).toBe(false);
    expect(result.validationStatus?.errors).toContain("Invalid signature");
    expect(result.validationStatus?.errors).toContain("Hash mismatch");
  });

  it("should parse validation status with warnings", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {},
        validation_status: [
          { code: "warning.timestamp", explanation: "No timestamp" },
        ],
      },
    };

    const result = parseManifestJson(json);

    expect(result.validationStatus?.isValid).toBe(true);
    expect(result.validationStatus?.warnings).toContain("No timestamp");
  });

  it("should detect AI from digital source type", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {},
        assertions: {
          "c2pa.actions": {
            actions: [
              {
                action: "c2pa.created",
                digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
              },
            ],
          },
        },
      },
    };

    const result = parseManifestJson(json);

    expect(result.aiDisclosure?.isAIGenerated).toBe(true);
  });

  it("should detect AI from composite trained algorithmic", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {},
        assertions: {
          "c2pa.actions": {
            actions: [
              {
                action: "c2pa.created",
                digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmic",
              },
            ],
          },
        },
      },
    };

    const result = parseManifestJson(json);

    expect(result.aiDisclosure?.isAIGenerated).toBe(true);
  });

  it("should parse AI training assertion", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {},
        assertions: {
          "c2pa.ai_training": {
            use: "allowed",
          },
        },
      },
    };

    const result = parseManifestJson(json);

    expect(result.aiDisclosure?.trainingDataUsed).toBe(true);
  });

  it("should parse creative work assertion", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {},
        assertions: {
          "stds.schema-org.CreativeWork": {
            author: [
              { name: "Alice" },
              "Bob",
            ],
            dateCreated: "2025-01-01",
            copyrightNotice: "© 2025",
          },
        },
      },
    };

    const result = parseManifestJson(json);

    expect(result.creativeWork?.author).toContain("Alice");
    expect(result.creativeWork?.author).toContain("Bob");
    expect(result.creativeWork?.dateCreated).toBe("2025-01-01");
    expect(result.creativeWork?.copyright).toBe("© 2025");
  });

  it("should set isEmbedded to true by default", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {},
      },
    };

    const result = parseManifestJson(json);

    expect(result.isEmbedded).toBe(true);
  });

  it("should handle missing optional fields", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim: {},
      },
    };

    const result = parseManifestJson(json);

    expect(result.manifestLabel).toBe("test");
    expect(result.claimGenerator).toBe("unknown");
    expect(result.title).toBeUndefined();
    expect(result.format).toBeUndefined();
    expect(result.actions).toBeUndefined();
    expect(result.ingredients).toBeUndefined();
  });

  it("should handle action with unknown type", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {},
        assertions: {
          "c2pa.actions": {
            actions: [{}],
          },
        },
      },
    };

    const result = parseManifestJson(json);

    expect(result.actions?.[0]?.action).toBe("c2pa.unknown");
  });

  it("should handle ingredient with missing title", () => {
    const json = {
      active_manifest: {
        label: "test",
        claim_generator: "Test",
        claim: {},
        ingredients: [{}],
      },
    };

    const result = parseManifestJson(json);

    expect(result.ingredients?.[0]?.title).toBe("Unknown");
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Integration Tests (require c2pa-node)                        |
\*─────────────────────────────────────────────────────────────*/

describe("readManifest", () => {
  it("should throw MediaError when c2pa-node not available", async () => {
    const available = await isC2PAAvailable();

    if (!available) {
      const { readManifest } = await import("./index.js");

      await expect(readManifest("/path/to/file.jpg")).rejects.toThrow(MediaError);
      await expect(readManifest("/path/to/file.jpg")).rejects.toThrow(
        "c2pa-node is not available"
      );
    }
  });
});

describe("hasManifest", () => {
  it("should throw if c2pa-node not available", async () => {
    const available = await isC2PAAvailable();

    if (!available) {
      const { hasManifest } = await import("./index.js");

      await expect(hasManifest("/path/to/file.jpg")).rejects.toThrow(MediaError);
    }
  });
});

describe("getManifestSummary", () => {
  it("should throw if c2pa-node not available", async () => {
    const available = await isC2PAAvailable();

    if (!available) {
      const { getManifestSummary } = await import("./index.js");

      await expect(getManifestSummary("/path/to/file.jpg")).rejects.toThrow(MediaError);
    }
  });
});

describe("readManifestFromBuffer", () => {
  it("should throw if c2pa-node not available", async () => {
    const available = await isC2PAAvailable();

    if (!available) {
      const { readManifestFromBuffer } = await import("./index.js");

      await expect(
        readManifestFromBuffer(Buffer.from("test"), "image/jpeg")
      ).rejects.toThrow(MediaError);
    }
  });
});
