/**
 * Tests for extension module.
 */

import { describe, it, expect } from "vitest";
import type { Resource } from "@arttribute/eaa-types";
import {
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
  C2PA_NAMESPACE,
} from "./extension.js";

/*─────────────────────────────────────────────────────────────*\
 | Test Fixtures                                                |
\*─────────────────────────────────────────────────────────────*/

function createBaseResource(): Resource {
  return {
    id: "test-resource-1",
    type: "image",
    contentRef: {
      ref: "hash:abc123",
      scheme: "hash",
    },
  };
}

function createC2PAData() {
  return {
    manifestLabel: "urn:uuid:12345-67890",
    claimGenerator: "TestApp/1.0",
    claimGeneratorVersion: "1.0.0",
    title: "Test Image",
    format: "image/jpeg",
    instanceId: "inst:abc123",
    actions: [
      {
        action: "c2pa.created" as const,
        when: "2025-01-01T00:00:00Z",
        softwareAgent: { name: "Camera App", version: "2.0" },
      },
      {
        action: "c2pa.edited" as const,
        when: "2025-01-02T00:00:00Z",
        softwareAgent: { name: "Photo Editor" },
      },
    ],
    ingredients: [
      {
        title: "Background Image",
        format: "image/png",
        hash: "sha256:def456",
        isParent: true,
        relationship: "parentOf" as const,
      },
    ],
    signature: {
      algorithm: "es256",
      issuer: "CN=Test CA",
      timestamp: "2025-01-01T00:00:00Z",
    },
    validationStatus: {
      isValid: true,
      errors: [],
      warnings: ["Certificate expires soon"],
    },
    isEmbedded: true,
    aiDisclosure: {
      isAIGenerated: false,
      aiTool: undefined,
      trainingDataUsed: false,
    },
    creativeWork: {
      author: ["Alice", "Bob"],
      dateCreated: "2025-01-01",
      copyright: "© 2025 Alice & Bob",
    },
  };
}

/*─────────────────────────────────────────────────────────────*\
 | withC2PA Tests                                               |
\*─────────────────────────────────────────────────────────────*/

describe("withC2PA", () => {
  it("should add C2PA extension to resource", () => {
    const resource = createBaseResource();
    const c2paData = {
      manifestLabel: "urn:uuid:test",
      claimGenerator: "Test",
    };

    const result = withC2PA(resource, c2paData);

    expect(result.extensions).toBeDefined();
    expect(result.extensions?.[C2PA_NAMESPACE]).toBeDefined();
    expect(result.extensions?.[C2PA_NAMESPACE].manifestLabel).toBe("urn:uuid:test");
  });

  it("should preserve existing resource properties", () => {
    const resource = createBaseResource();
    resource.name = "My Image";
    resource.metadata = { custom: "value" };

    const result = withC2PA(resource, {
      manifestLabel: "test",
      claimGenerator: "Test",
    });

    expect(result.id).toBe(resource.id);
    expect(result.type).toBe(resource.type);
    expect(result.name).toBe("My Image");
    expect(result.metadata?.custom).toBe("value");
  });

  it("should preserve existing extensions", () => {
    const resource: Resource = {
      ...createBaseResource(),
      extensions: {
        "ext:custom@1.0": { foo: "bar" },
      },
    };

    const result = withC2PA(resource, {
      manifestLabel: "test",
      claimGenerator: "Test",
    });

    expect(result.extensions?.["ext:custom@1.0"]).toEqual({ foo: "bar" });
    expect(result.extensions?.[C2PA_NAMESPACE]).toBeDefined();
  });

  it("should validate C2PA data", () => {
    const resource = createBaseResource();

    // Invalid data should throw
    expect(() =>
      withC2PA(resource, {
        manifestLabel: "test",
        // Missing claimGenerator
      } as any)
    ).toThrow();
  });

  it("should accept full C2PA data", () => {
    const resource = createBaseResource();
    const c2paData = createC2PAData();

    const result = withC2PA(resource, c2paData);

    const ext = result.extensions?.[C2PA_NAMESPACE];
    expect(ext.title).toBe("Test Image");
    expect(ext.actions).toHaveLength(2);
    expect(ext.ingredients).toHaveLength(1);
    expect(ext.creativeWork?.author).toContain("Alice");
  });
});

/*─────────────────────────────────────────────────────────────*\
 | getC2PA Tests                                                |
\*─────────────────────────────────────────────────────────────*/

describe("getC2PA", () => {
  it("should return C2PA extension if present", () => {
    const resource = withC2PA(createBaseResource(), createC2PAData());

    const c2pa = getC2PA(resource);

    expect(c2pa).toBeDefined();
    expect(c2pa?.manifestLabel).toBe("urn:uuid:12345-67890");
    expect(c2pa?.title).toBe("Test Image");
  });

  it("should return undefined if no C2PA extension", () => {
    const resource = createBaseResource();

    const c2pa = getC2PA(resource);

    expect(c2pa).toBeUndefined();
  });

  it("should return undefined if extensions is undefined", () => {
    const resource: Resource = {
      id: "test",
      type: "image",
      contentRef: { ref: "x", scheme: "hash" },
    };

    const c2pa = getC2PA(resource);

    expect(c2pa).toBeUndefined();
  });
});

/*─────────────────────────────────────────────────────────────*\
 | hasC2PA Tests                                                |
\*─────────────────────────────────────────────────────────────*/

describe("hasC2PA", () => {
  it("should return true if C2PA extension present", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
    });

    expect(hasC2PA(resource)).toBe(true);
  });

  it("should return false if no C2PA extension", () => {
    const resource = createBaseResource();

    expect(hasC2PA(resource)).toBe(false);
  });

  it("should return false if no extensions at all", () => {
    const resource: Resource = {
      id: "test",
      type: "image",
      contentRef: { ref: "x", scheme: "hash" },
    };

    expect(hasC2PA(resource)).toBe(false);
  });
});

/*─────────────────────────────────────────────────────────────*\
 | getManifestLabel Tests                                       |
\*─────────────────────────────────────────────────────────────*/

describe("getManifestLabel", () => {
  it("should return manifest label", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "urn:uuid:my-manifest",
      claimGenerator: "Test",
    });

    expect(getManifestLabel(resource)).toBe("urn:uuid:my-manifest");
  });

  it("should return undefined if no C2PA", () => {
    const resource = createBaseResource();

    expect(getManifestLabel(resource)).toBeUndefined();
  });
});

/*─────────────────────────────────────────────────────────────*\
 | isC2PAValid Tests                                            |
\*─────────────────────────────────────────────────────────────*/

describe("isC2PAValid", () => {
  it("should return true if validation status is valid", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
      validationStatus: { isValid: true },
    });

    expect(isC2PAValid(resource)).toBe(true);
  });

  it("should return false if validation status is invalid", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
      validationStatus: { isValid: false, errors: ["Signature invalid"] },
    });

    expect(isC2PAValid(resource)).toBe(false);
  });

  it("should return false if no validation status", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
    });

    expect(isC2PAValid(resource)).toBe(false);
  });

  it("should return false if no C2PA", () => {
    const resource = createBaseResource();

    expect(isC2PAValid(resource)).toBe(false);
  });
});

/*─────────────────────────────────────────────────────────────*\
 | AI Disclosure Tests                                          |
\*─────────────────────────────────────────────────────────────*/

describe("isAIGenerated", () => {
  it("should return true if AI generated", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
      aiDisclosure: { isAIGenerated: true, aiTool: "DALL-E" },
    });

    expect(isAIGenerated(resource)).toBe(true);
  });

  it("should return false if not AI generated", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
      aiDisclosure: { isAIGenerated: false },
    });

    expect(isAIGenerated(resource)).toBe(false);
  });

  it("should return false if no AI disclosure", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
    });

    expect(isAIGenerated(resource)).toBe(false);
  });

  it("should return false if no C2PA", () => {
    const resource = createBaseResource();

    expect(isAIGenerated(resource)).toBe(false);
  });
});

describe("getAITool", () => {
  it("should return AI tool name", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
      aiDisclosure: { isAIGenerated: true, aiTool: "Midjourney" },
    });

    expect(getAITool(resource)).toBe("Midjourney");
  });

  it("should return undefined if no AI tool specified", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
      aiDisclosure: { isAIGenerated: true },
    });

    expect(getAITool(resource)).toBeUndefined();
  });

  it("should return undefined if no AI disclosure", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
    });

    expect(getAITool(resource)).toBeUndefined();
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Actions & Ingredients Tests                                  |
\*─────────────────────────────────────────────────────────────*/

describe("getC2PAActions", () => {
  it("should return actions array", () => {
    const resource = withC2PA(createBaseResource(), createC2PAData());

    const actions = getC2PAActions(resource);

    expect(actions).toHaveLength(2);
    expect(actions?.[0]?.action).toBe("c2pa.created");
    expect(actions?.[1]?.action).toBe("c2pa.edited");
  });

  it("should return empty array if no actions", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
    });

    expect(getC2PAActions(resource)).toEqual([]);
  });

  it("should return empty array if no C2PA", () => {
    const resource = createBaseResource();

    expect(getC2PAActions(resource)).toEqual([]);
  });
});

describe("getC2PAIngredients", () => {
  it("should return ingredients array", () => {
    const resource = withC2PA(createBaseResource(), createC2PAData());

    const ingredients = getC2PAIngredients(resource);

    expect(ingredients).toHaveLength(1);
    expect(ingredients?.[0]?.title).toBe("Background Image");
    expect(ingredients?.[0]?.isParent).toBe(true);
  });

  it("should return empty array if no ingredients", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
    });

    expect(getC2PAIngredients(resource)).toEqual([]);
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Signature Tests                                              |
\*─────────────────────────────────────────────────────────────*/

describe("getC2PASignature", () => {
  it("should return signature info", () => {
    const resource = withC2PA(createBaseResource(), createC2PAData());

    const sig = getC2PASignature(resource);

    expect(sig?.algorithm).toBe("es256");
    expect(sig?.issuer).toBe("CN=Test CA");
  });

  it("should return undefined if no signature", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
    });

    expect(getC2PASignature(resource)).toBeUndefined();
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Embedded/Remote Tests                                        |
\*─────────────────────────────────────────────────────────────*/

describe("isManifestEmbedded", () => {
  it("should return true if embedded", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
      isEmbedded: true,
    });

    expect(isManifestEmbedded(resource)).toBe(true);
  });

  it("should return false if remote", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
      isEmbedded: false,
      remoteUrl: "https://example.com/manifest",
    });

    expect(isManifestEmbedded(resource)).toBe(false);
  });

  it("should return false if not specified", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
    });

    expect(isManifestEmbedded(resource)).toBe(false);
  });
});

describe("getRemoteManifestUrl", () => {
  it("should return remote URL", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
      isEmbedded: false,
      remoteUrl: "https://cdn.example.com/manifests/123",
    });

    expect(getRemoteManifestUrl(resource)).toBe("https://cdn.example.com/manifests/123");
  });

  it("should return undefined if embedded", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
      isEmbedded: true,
    });

    expect(getRemoteManifestUrl(resource)).toBeUndefined();
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Creative Work Tests                                          |
\*─────────────────────────────────────────────────────────────*/

describe("getCreativeWork", () => {
  it("should return creative work info", () => {
    const resource = withC2PA(createBaseResource(), createC2PAData());

    const cw = getCreativeWork(resource);

    expect(cw?.author).toContain("Alice");
    expect(cw?.author).toContain("Bob");
    expect(cw?.copyright).toBe("© 2025 Alice & Bob");
    expect(cw?.dateCreated).toBe("2025-01-01");
  });

  it("should return undefined if no creative work", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
    });

    expect(getCreativeWork(resource)).toBeUndefined();
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Validation Errors/Warnings Tests                             |
\*─────────────────────────────────────────────────────────────*/

describe("getValidationErrors", () => {
  it("should return validation errors", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
      validationStatus: {
        isValid: false,
        errors: ["Signature invalid", "Certificate expired"],
      },
    });

    const errors = getValidationErrors(resource);

    expect(errors).toHaveLength(2);
    expect(errors).toContain("Signature invalid");
    expect(errors).toContain("Certificate expired");
  });

  it("should return empty array if no errors", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
      validationStatus: { isValid: true },
    });

    expect(getValidationErrors(resource)).toEqual([]);
  });

  it("should return empty array if no validation status", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
    });

    expect(getValidationErrors(resource)).toEqual([]);
  });
});

describe("getValidationWarnings", () => {
  it("should return validation warnings", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
      validationStatus: {
        isValid: true,
        warnings: ["Certificate expires soon", "Timestamp missing"],
      },
    });

    const warnings = getValidationWarnings(resource);

    expect(warnings).toHaveLength(2);
    expect(warnings).toContain("Certificate expires soon");
  });

  it("should return empty array if no warnings", () => {
    const resource = withC2PA(createBaseResource(), {
      manifestLabel: "test",
      claimGenerator: "Test",
      validationStatus: { isValid: true },
    });

    expect(getValidationWarnings(resource)).toEqual([]);
  });
});
