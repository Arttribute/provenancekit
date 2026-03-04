/**
 * Tests for types module.
 */

import { describe, it, expect } from "vitest";
import {
  C2PAExtension,
  C2PAAction,
  C2PAActionType,
  C2PAActor,
  C2PAIngredient,
  C2PASignature,
  MediaError,
  SUPPORTED_FORMATS,
  isSupportedFormat,
  getMimeTypeFromExtension,
  C2PA_NAMESPACE,
} from "./types.js";

/*─────────────────────────────────────────────────────────────*\
 | Constants                                                    |
\*─────────────────────────────────────────────────────────────*/

describe("C2PA_NAMESPACE", () => {
  it("should be ext:c2pa@1.0.0", () => {
    expect(C2PA_NAMESPACE).toBe("ext:c2pa@1.0.0");
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Schema Validation                                            |
\*─────────────────────────────────────────────────────────────*/

describe("C2PAActionType", () => {
  it("should accept valid action types", () => {
    const validTypes = [
      "c2pa.created",
      "c2pa.placed",
      "c2pa.cropped",
      "c2pa.resized",
      "c2pa.edited",
      "c2pa.filtered",
      "c2pa.color_adjusted",
      "c2pa.orientation",
      "c2pa.converted",
      "c2pa.opened",
      "c2pa.unknown",
      "c2pa.drawing",
      "c2pa.published",
      "c2pa.transcoded",
      "c2pa.repackaged",
      "c2pa.removed",
    ];

    for (const type of validTypes) {
      expect(C2PAActionType.parse(type)).toBe(type);
    }
  });

  it("should reject invalid action types", () => {
    expect(() => C2PAActionType.parse("invalid")).toThrow();
    expect(() => C2PAActionType.parse("created")).toThrow();
    expect(() => C2PAActionType.parse("")).toThrow();
  });
});

describe("C2PAActor", () => {
  it("should accept minimal actor", () => {
    const actor = C2PAActor.parse({});
    expect(actor).toEqual({});
  });

  it("should accept full actor", () => {
    const actor = C2PAActor.parse({
      type: "human",
      name: "John Doe",
      identifier: "mailto:john@example.com",
      credentials: [{ type: "certificate", url: "https://example.com/cert" }],
    });

    expect(actor.type).toBe("human");
    expect(actor.name).toBe("John Doe");
    expect(actor.identifier).toBe("mailto:john@example.com");
    expect(actor.credentials).toHaveLength(1);
  });

  it("should accept AI actor type", () => {
    const actor = C2PAActor.parse({
      type: "ai",
      name: "DALL-E",
    });

    expect(actor.type).toBe("ai");
    expect(actor.name).toBe("DALL-E");
  });

  it("should accept organization actor type", () => {
    const actor = C2PAActor.parse({
      type: "organization",
      name: "Acme Corp",
    });

    expect(actor.type).toBe("organization");
  });

  it("should reject invalid actor type", () => {
    expect(() =>
      C2PAActor.parse({
        type: "robot",
      })
    ).toThrow();
  });
});

describe("C2PAAction", () => {
  it("should accept minimal action", () => {
    const action = C2PAAction.parse({
      action: "c2pa.created",
    });

    expect(action.action).toBe("c2pa.created");
  });

  it("should accept full action", () => {
    const action = C2PAAction.parse({
      action: "c2pa.edited",
      when: "2025-01-01T00:00:00Z",
      softwareAgent: {
        name: "Photoshop",
        version: "25.0",
      },
      actors: [{ type: "human", name: "Jane" }],
      parameters: { crop: { x: 0, y: 0, width: 100, height: 100 } },
      digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture",
      reason: "Cropped for composition",
      relatedActions: ["action-1"],
    });

    expect(action.action).toBe("c2pa.edited");
    expect(action.when).toBe("2025-01-01T00:00:00Z");
    expect(action.softwareAgent?.name).toBe("Photoshop");
    expect(action.actors).toHaveLength(1);
    expect(action.parameters?.crop).toBeDefined();
  });
});

describe("C2PAIngredient", () => {
  it("should accept minimal ingredient", () => {
    const ingredient = C2PAIngredient.parse({
      title: "Source Image",
    });

    expect(ingredient.title).toBe("Source Image");
  });

  it("should accept full ingredient", () => {
    const ingredient = C2PAIngredient.parse({
      title: "Background Photo",
      format: "image/jpeg",
      documentId: "doc:12345",
      instanceId: "inst:67890",
      hash: "sha256:abc123",
      isParent: true,
      relationship: "parentOf",
      thumbnail: {
        format: "image/jpeg",
        data: "base64encodeddata",
      },
      validationStatus: [
        {
          code: "valid",
          url: "https://example.com/validation",
          explanation: "Manifest is valid",
        },
      ],
    });

    expect(ingredient.format).toBe("image/jpeg");
    expect(ingredient.isParent).toBe(true);
    expect(ingredient.relationship).toBe("parentOf");
    expect(ingredient.thumbnail?.format).toBe("image/jpeg");
  });

  it("should accept all relationship types", () => {
    expect(C2PAIngredient.parse({ title: "A", relationship: "parentOf" }).relationship).toBe("parentOf");
    expect(C2PAIngredient.parse({ title: "B", relationship: "componentOf" }).relationship).toBe("componentOf");
    expect(C2PAIngredient.parse({ title: "C", relationship: "inputTo" }).relationship).toBe("inputTo");
  });
});

describe("C2PASignature", () => {
  it("should accept minimal signature", () => {
    const sig = C2PASignature.parse({
      algorithm: "es256",
    });

    expect(sig.algorithm).toBe("es256");
  });

  it("should accept full signature", () => {
    const sig = C2PASignature.parse({
      algorithm: "ps256",
      certificateChain: ["cert1", "cert2"],
      issuer: "CN=Test CA",
      timestamp: "2025-01-01T00:00:00Z",
      tsaUrl: "https://timestamp.example.com",
    });

    expect(sig.certificateChain).toHaveLength(2);
    expect(sig.issuer).toBe("CN=Test CA");
    expect(sig.tsaUrl).toBe("https://timestamp.example.com");
  });
});

describe("C2PAExtension", () => {
  it("should accept minimal extension", () => {
    const ext = C2PAExtension.parse({
      manifestLabel: "urn:uuid:12345",
      claimGenerator: "ProvenanceKit/1.0",
    });

    expect(ext.manifestLabel).toBe("urn:uuid:12345");
    expect(ext.claimGenerator).toBe("ProvenanceKit/1.0");
  });

  it("should accept full extension", () => {
    const ext = C2PAExtension.parse({
      manifestLabel: "urn:uuid:12345",
      claimGenerator: "ProvenanceKit",
      claimGeneratorVersion: "1.0.0",
      title: "My Photo",
      format: "image/jpeg",
      instanceId: "inst:abc",
      actions: [{ action: "c2pa.created" }],
      ingredients: [{ title: "Source" }],
      signature: { algorithm: "es256" },
      validationStatus: {
        isValid: true,
        errors: [],
        warnings: ["Minor warning"],
      },
      isEmbedded: true,
      remoteUrl: undefined,
      aiDisclosure: {
        isAIGenerated: false,
        aiTool: undefined,
        trainingDataUsed: false,
      },
      creativeWork: {
        author: ["John Doe"],
        dateCreated: "2025-01-01",
        copyright: "© 2025 John Doe",
      },
    });

    expect(ext.title).toBe("My Photo");
    expect(ext.format).toBe("image/jpeg");
    expect(ext.actions).toHaveLength(1);
    expect(ext.ingredients).toHaveLength(1);
    expect(ext.validationStatus?.isValid).toBe(true);
    expect(ext.aiDisclosure?.isAIGenerated).toBe(false);
    expect(ext.creativeWork?.author).toContain("John Doe");
  });
});

/*─────────────────────────────────────────────────────────────*\
 | MediaError                                                   |
\*─────────────────────────────────────────────────────────────*/

describe("MediaError", () => {
  it("should create error with code", () => {
    const error = new MediaError("Test error", "NO_MANIFEST");

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("NO_MANIFEST");
    expect(error.name).toBe("MediaError");
  });

  it("should create error with details", () => {
    const error = new MediaError("File not found", "READING_FAILED", {
      filePath: "/path/to/file.jpg",
      cause: "ENOENT",
    });

    expect(error.code).toBe("READING_FAILED");
    expect(error.details?.filePath).toBe("/path/to/file.jpg");
    expect(error.details?.cause).toBe("ENOENT");
  });

  it("should support all error codes", () => {
    const codes = [
      "NO_MANIFEST",
      "INVALID_MANIFEST",
      "VALIDATION_FAILED",
      "UNSUPPORTED_FORMAT",
      "SIGNING_FAILED",
      "READING_FAILED",
      "C2PA_NOT_AVAILABLE",
    ] as const;

    for (const code of codes) {
      const error = new MediaError(`Error: ${code}`, code);
      expect(error.code).toBe(code);
    }
  });

  it("should be an instance of Error", () => {
    const error = new MediaError("Test", "NO_MANIFEST");
    expect(error).toBeInstanceOf(Error);
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Format Utilities                                             |
\*─────────────────────────────────────────────────────────────*/

describe("SUPPORTED_FORMATS", () => {
  it("should include common image formats", () => {
    expect(SUPPORTED_FORMATS).toContain("image/jpeg");
    expect(SUPPORTED_FORMATS).toContain("image/png");
    expect(SUPPORTED_FORMATS).toContain("image/heic");
    expect(SUPPORTED_FORMATS).toContain("image/heif");
    expect(SUPPORTED_FORMATS).toContain("image/avif");
    expect(SUPPORTED_FORMATS).toContain("image/webp");
  });

  it("should include video formats", () => {
    expect(SUPPORTED_FORMATS).toContain("video/mp4");
    expect(SUPPORTED_FORMATS).toContain("video/quicktime");
  });

  it("should include audio formats", () => {
    expect(SUPPORTED_FORMATS).toContain("audio/mpeg");
    expect(SUPPORTED_FORMATS).toContain("audio/mp4");
  });

  it("should include PDF", () => {
    expect(SUPPORTED_FORMATS).toContain("application/pdf");
  });
});

describe("isSupportedFormat", () => {
  it("should return true for supported formats", () => {
    expect(isSupportedFormat("image/jpeg")).toBe(true);
    expect(isSupportedFormat("image/png")).toBe(true);
    expect(isSupportedFormat("video/mp4")).toBe(true);
    expect(isSupportedFormat("application/pdf")).toBe(true);
  });

  it("should return false for unsupported formats", () => {
    expect(isSupportedFormat("text/plain")).toBe(false);
    expect(isSupportedFormat("application/json")).toBe(false);
    expect(isSupportedFormat("image/gif")).toBe(false);
    expect(isSupportedFormat("image/svg+xml")).toBe(false);
  });
});

describe("getMimeTypeFromExtension", () => {
  it("should return correct MIME type for image extensions", () => {
    expect(getMimeTypeFromExtension("jpg")).toBe("image/jpeg");
    expect(getMimeTypeFromExtension("jpeg")).toBe("image/jpeg");
    expect(getMimeTypeFromExtension("png")).toBe("image/png");
    expect(getMimeTypeFromExtension("heic")).toBe("image/heic");
    expect(getMimeTypeFromExtension("heif")).toBe("image/heif");
    expect(getMimeTypeFromExtension("avif")).toBe("image/avif");
    expect(getMimeTypeFromExtension("webp")).toBe("image/webp");
  });

  it("should return correct MIME type for video extensions", () => {
    expect(getMimeTypeFromExtension("mp4")).toBe("video/mp4");
    expect(getMimeTypeFromExtension("mov")).toBe("video/quicktime");
  });

  it("should return correct MIME type for audio extensions", () => {
    expect(getMimeTypeFromExtension("mp3")).toBe("audio/mpeg");
    expect(getMimeTypeFromExtension("m4a")).toBe("audio/mp4");
  });

  it("should return correct MIME type for PDF", () => {
    expect(getMimeTypeFromExtension("pdf")).toBe("application/pdf");
  });

  it("should handle extensions with leading dot", () => {
    expect(getMimeTypeFromExtension(".jpg")).toBe("image/jpeg");
    expect(getMimeTypeFromExtension(".PNG")).toBe("image/png");
  });

  it("should be case-insensitive", () => {
    expect(getMimeTypeFromExtension("JPG")).toBe("image/jpeg");
    expect(getMimeTypeFromExtension("PNG")).toBe("image/png");
    expect(getMimeTypeFromExtension("Mp4")).toBe("video/mp4");
  });

  it("should return undefined for unknown extensions", () => {
    expect(getMimeTypeFromExtension("txt")).toBeUndefined();
    expect(getMimeTypeFromExtension("gif")).toBeUndefined();
    expect(getMimeTypeFromExtension("svg")).toBeUndefined();
    expect(getMimeTypeFromExtension("unknown")).toBeUndefined();
  });
});
