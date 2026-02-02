/**
 * Tests for converter module.
 */

import { describe, it, expect } from "vitest";
import type { C2PAExtension, C2PAActor, C2PAAction, C2PAIngredient } from "../types.js";
import {
  actorToEntity,
  softwareAgentToEntity,
  c2paActionToEAAAction,
  createAttributionsFromC2PA,
  createContentReference,
  createResourceFromC2PA,
  convertC2PAToEAA,
  ingredientToResource,
  getIngredientsAsResources,
} from "./index.js";

/*─────────────────────────────────────────────────────────────*\
 | Test Fixtures                                                |
\*─────────────────────────────────────────────────────────────*/

function createMinimalC2PA(): C2PAExtension {
  return {
    manifestLabel: "urn:uuid:test-123",
    claimGenerator: "TestApp/1.0",
  };
}

function createFullC2PA(): C2PAExtension {
  return {
    manifestLabel: "urn:uuid:full-test-456",
    claimGenerator: "ProvenanceKit",
    claimGeneratorVersion: "1.0.0",
    title: "Sunset Photo",
    format: "image/jpeg",
    instanceId: "inst:photo-789",
    actions: [
      {
        action: "c2pa.created",
        when: "2025-01-01T10:00:00Z",
        softwareAgent: { name: "Camera App", version: "3.0" },
        digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture",
        actors: [
          {
            type: "human",
            name: "Alice Photographer",
            identifier: "mailto:alice@example.com",
          },
        ],
      },
      {
        action: "c2pa.edited",
        when: "2025-01-01T12:00:00Z",
        softwareAgent: { name: "Photo Editor", version: "5.0" },
        actors: [
          {
            type: "human",
            name: "Bob Editor",
          },
        ],
      },
    ],
    ingredients: [
      {
        title: "Original RAW",
        format: "image/raw",
        hash: "sha256:abc123",
        isParent: true,
        relationship: "parentOf",
      },
      {
        title: "Overlay PNG",
        format: "image/png",
        relationship: "componentOf",
      },
    ],
    signature: {
      algorithm: "es256",
      issuer: "CN=Test CA",
      timestamp: "2025-01-01T12:00:00Z",
    },
    validationStatus: {
      isValid: true,
    },
    isEmbedded: true,
    aiDisclosure: {
      isAIGenerated: false,
    },
    creativeWork: {
      author: ["Alice Photographer", "Bob Editor"],
      copyright: "© 2025 Alice & Bob",
    },
  };
}

/*─────────────────────────────────────────────────────────────*\
 | actorToEntity Tests                                          |
\*─────────────────────────────────────────────────────────────*/

describe("actorToEntity", () => {
  it("should convert human actor", () => {
    const actor: C2PAActor = {
      type: "human",
      name: "John Doe",
      identifier: "mailto:john@example.com",
    };

    const entity = actorToEntity(actor);

    expect(entity.id).toBe("mailto:john@example.com");
    expect(entity.name).toBe("John Doe");
    expect(entity.role).toBe("human");
  });

  it("should convert AI actor", () => {
    const actor: C2PAActor = {
      type: "ai",
      name: "DALL-E",
      identifier: "ai:dall-e",
    };

    const entity = actorToEntity(actor);

    expect(entity.id).toBe("ai:dall-e");
    expect(entity.name).toBe("DALL-E");
    expect(entity.role).toBe("ai");
  });

  it("should convert organization actor", () => {
    const actor: C2PAActor = {
      type: "organization",
      name: "Acme Corp",
      identifier: "org:acme",
    };

    const entity = actorToEntity(actor);

    expect(entity.role).toBe("organization");
  });

  it("should generate ID from index if no identifier", () => {
    const actor: C2PAActor = {
      type: "human",
      name: "Anonymous",
    };

    const entity = actorToEntity(actor, 5);

    expect(entity.id).toBe("c2pa:actor:5");
  });

  it("should include credentials in metadata", () => {
    const actor: C2PAActor = {
      type: "human",
      name: "Jane",
      credentials: [{ type: "certificate", url: "https://example.com/cert" }],
    };

    const entity = actorToEntity(actor);

    expect(entity.metadata?.credentials).toBeDefined();
    expect(entity.metadata?.credentials).toHaveLength(1);
  });

  it("should handle minimal actor", () => {
    const actor: C2PAActor = {};

    const entity = actorToEntity(actor, 0);

    expect(entity.id).toBe("c2pa:actor:0");
    expect(entity.role).toBe("human"); // Default
    expect(entity.name).toBeUndefined();
  });
});

/*─────────────────────────────────────────────────────────────*\
 | softwareAgentToEntity Tests                                  |
\*─────────────────────────────────────────────────────────────*/

describe("softwareAgentToEntity", () => {
  it("should convert software agent to entity", () => {
    const agent = { name: "Photoshop", version: "25.0" };

    const entity = softwareAgentToEntity(agent);

    expect(entity.id).toBe("software:photoshop");
    expect(entity.name).toBe("Photoshop");
    expect(entity.role).toBe("ai");
    expect(entity.metadata?.version).toBe("25.0");
  });

  it("should handle agent without version", () => {
    const agent = { name: "Camera App" };

    const entity = softwareAgentToEntity(agent);

    expect(entity.id).toBe("software:camera-app");
    expect(entity.metadata).toBeUndefined();
  });

  it("should normalize name for ID", () => {
    const agent = { name: "Adobe Lightroom Classic" };

    const entity = softwareAgentToEntity(agent);

    expect(entity.id).toBe("software:adobe-lightroom-classic");
  });
});

/*─────────────────────────────────────────────────────────────*\
 | c2paActionToEAAAction Tests                                  |
\*─────────────────────────────────────────────────────────────*/

describe("c2paActionToEAAAction", () => {
  const contentRef = { ref: "test-ref", scheme: "hash" as const };

  it("should convert created action", () => {
    const c2paAction: C2PAAction = {
      action: "c2pa.created",
      when: "2025-01-01T00:00:00Z",
    };

    const { action, entities } = c2paActionToEAAAction(c2paAction, contentRef);

    expect(action.type).toBe("create");
    expect(action.timestamp).toBe("2025-01-01T00:00:00Z");
    expect(action.outputs).toContainEqual(contentRef);
  });

  it("should convert edit actions to transform", () => {
    const editActions = ["c2pa.edited", "c2pa.cropped", "c2pa.resized", "c2pa.filtered"];

    for (const actionType of editActions) {
      const c2paAction: C2PAAction = {
        action: actionType as any,
      };

      const { action } = c2paActionToEAAAction(c2paAction, contentRef);
      expect(action.type).toBe("transform");
    }
  });

  it("should extract entities from actors", () => {
    const c2paAction: C2PAAction = {
      action: "c2pa.created",
      actors: [
        { type: "human", name: "Alice", identifier: "mailto:alice@test.com" },
        { type: "human", name: "Bob" },
      ],
    };

    const { action, entities } = c2paActionToEAAAction(c2paAction, contentRef);

    expect(entities).toHaveLength(2);
    expect(action.performedBy).toBe("mailto:alice@test.com");
    expect(entities[0]?.name).toBe("Alice");
    expect(entities[1]?.name).toBe("Bob");
  });

  it("should extract entity from software agent", () => {
    const c2paAction: C2PAAction = {
      action: "c2pa.created",
      softwareAgent: { name: "DALL-E", version: "3" },
    };

    const { action, entities } = c2paActionToEAAAction(c2paAction, contentRef);

    expect(entities).toHaveLength(1);
    expect(entities[0]?.id).toBe("software:dall-e");
    expect(action.performedBy).toBe("software:dall-e");
  });

  it("should prefer human actor as performer over software agent", () => {
    const c2paAction: C2PAAction = {
      action: "c2pa.edited",
      actors: [{ type: "human", name: "Alice", identifier: "alice@test.com" }],
      softwareAgent: { name: "Photo Editor" },
    };

    const { action, entities } = c2paActionToEAAAction(c2paAction, contentRef);

    expect(action.performedBy).toBe("alice@test.com");
    expect(entities).toHaveLength(2); // Both actor and software agent
  });

  it("should include metadata", () => {
    const c2paAction: C2PAAction = {
      action: "c2pa.cropped",
      digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture",
      reason: "Improve composition",
      parameters: { x: 0, y: 0, width: 1000, height: 1000 },
    };

    const { action } = c2paActionToEAAAction(c2paAction, contentRef);

    expect(action.metadata?.c2paAction).toBe("c2pa.cropped");
    expect(action.metadata?.digitalSourceType).toBeDefined();
    expect(action.metadata?.reason).toBe("Improve composition");
    expect(action.metadata?.parameters).toBeDefined();
  });

  it("should add AI tool extension when software agent present", () => {
    const c2paAction: C2PAAction = {
      action: "c2pa.created",
      softwareAgent: { name: "Midjourney", version: "5" },
    };

    const { action } = c2paActionToEAAAction(c2paAction, contentRef);

    // Check that AI tool extension was added
    expect(action.extensions?.["ext:ai-tool@1.0.0"]).toBeDefined();
  });

  it("should use index for action ID", () => {
    const c2paAction: C2PAAction = { action: "c2pa.created" };

    const { action: action0 } = c2paActionToEAAAction(c2paAction, contentRef, 0);
    const { action: action5 } = c2paActionToEAAAction(c2paAction, contentRef, 5);

    expect(action0.id).toBe("c2pa:action:0");
    expect(action5.id).toBe("c2pa:action:5");
  });
});

/*─────────────────────────────────────────────────────────────*\
 | createAttributionsFromC2PA Tests                             |
\*─────────────────────────────────────────────────────────────*/

describe("createAttributionsFromC2PA", () => {
  const contentRef = { ref: "test-ref", scheme: "hash" as const };

  it("should create attributions from creative work authors", () => {
    const c2pa = createFullC2PA();

    const attributions = createAttributionsFromC2PA(c2pa, contentRef);

    const authorAttributions = attributions.filter((a) => a.role === "creator");
    expect(authorAttributions.length).toBeGreaterThan(0);
    expect(authorAttributions.some((a) => a.note?.includes("Alice"))).toBe(true);
  });

  it("should create attributions from actions with software agents", () => {
    const c2pa = createFullC2PA();

    const attributions = createAttributionsFromC2PA(c2pa, contentRef);

    const toolAttributions = attributions.filter(
      (a) => a.entityId.startsWith("software:")
    );
    expect(toolAttributions.length).toBeGreaterThan(0);
  });

  it("should create attributions from action actors", () => {
    const c2pa = createFullC2PA();

    const attributions = createAttributionsFromC2PA(c2pa, contentRef);

    const actorAttributions = attributions.filter(
      (a) => a.entityId.startsWith("mailto:") || a.entityId.startsWith("c2pa:actor:")
    );
    expect(actorAttributions.length).toBeGreaterThan(0);
  });

  it("should create AI attribution when AI generated", () => {
    const c2pa: C2PAExtension = {
      ...createMinimalC2PA(),
      aiDisclosure: {
        isAIGenerated: true,
        aiTool: "Stable Diffusion",
      },
    };

    const attributions = createAttributionsFromC2PA(c2pa, contentRef);

    const aiAttributions = attributions.filter((a) => a.entityId.startsWith("ai:"));
    expect(aiAttributions).toHaveLength(1);
    expect(aiAttributions[0]?.note).toContain("AI-generated");
    expect(aiAttributions[0]?.note).toContain("Stable Diffusion");
  });

  it("should return empty array for minimal C2PA", () => {
    const c2pa = createMinimalC2PA();

    const attributions = createAttributionsFromC2PA(c2pa, contentRef);

    expect(attributions).toEqual([]);
  });

  it("should add contribution weights to tool attributions", () => {
    const c2pa: C2PAExtension = {
      ...createMinimalC2PA(),
      actions: [
        {
          action: "c2pa.created",
          softwareAgent: { name: "Camera App" },
        },
      ],
    };

    const attributions = createAttributionsFromC2PA(c2pa, contentRef);

    const toolAttribution = attributions.find((a) => a.entityId.startsWith("software:"));
    expect(toolAttribution?.extensions?.["ext:contrib@1.0.0"]).toBeDefined();
  });
});

/*─────────────────────────────────────────────────────────────*\
 | createContentReference Tests                                 |
\*─────────────────────────────────────────────────────────────*/

describe("createContentReference", () => {
  it("should use instance ID if available", () => {
    const c2pa = createFullC2PA();

    const ref = createContentReference(c2pa);

    expect(ref.ref).toBe("inst:photo-789");
    expect(ref.scheme).toBe("c2pa:instance");
  });

  it("should fall back to manifest label", () => {
    const c2pa = createMinimalC2PA();

    const ref = createContentReference(c2pa);

    expect(ref.ref).toBe("urn:uuid:test-123");
    expect(ref.scheme).toBe("c2pa:manifest");
  });
});

/*─────────────────────────────────────────────────────────────*\
 | createResourceFromC2PA Tests                                 |
\*─────────────────────────────────────────────────────────────*/

describe("createResourceFromC2PA", () => {
  it("should create resource with correct type for image", () => {
    const c2pa = createFullC2PA();

    const resource = createResourceFromC2PA(c2pa);

    expect(resource.type).toBe("image");
    expect(resource.name).toBe("Sunset Photo");
  });

  it("should create resource with correct type for video", () => {
    const c2pa: C2PAExtension = {
      ...createMinimalC2PA(),
      format: "video/mp4",
      title: "My Video",
    };

    const resource = createResourceFromC2PA(c2pa);

    expect(resource.type).toBe("video");
  });

  it("should create resource with correct type for audio", () => {
    const c2pa: C2PAExtension = {
      ...createMinimalC2PA(),
      format: "audio/mpeg",
    };

    const resource = createResourceFromC2PA(c2pa);

    expect(resource.type).toBe("audio");
  });

  it("should default to other for unknown format", () => {
    const c2pa: C2PAExtension = {
      ...createMinimalC2PA(),
      format: "application/pdf",
    };

    const resource = createResourceFromC2PA(c2pa);

    expect(resource.type).toBe("other");
  });

  it("should include C2PA extension", () => {
    const c2pa = createFullC2PA();

    const resource = createResourceFromC2PA(c2pa);

    expect(resource.extensions?.["ext:c2pa@1.0.0"]).toBeDefined();
    expect(resource.extensions?.["ext:c2pa@1.0.0"].manifestLabel).toBe(
      "urn:uuid:full-test-456"
    );
  });

  it("should use custom ID if provided", () => {
    const c2pa = createFullC2PA();

    const resource = createResourceFromC2PA(c2pa, { id: "custom-id-123" });

    expect(resource.id).toBe("custom-id-123");
  });

  it("should include hash if provided", () => {
    const c2pa = createFullC2PA();

    const resource = createResourceFromC2PA(c2pa, { hash: "sha256:xyz789" });

    expect(resource.hash).toBe("sha256:xyz789");
  });

  it("should include metadata", () => {
    const c2pa = createFullC2PA();

    const resource = createResourceFromC2PA(c2pa);

    expect(resource.metadata?.format).toBe("image/jpeg");
    expect(resource.metadata?.claimGenerator).toBe("ProvenanceKit");
  });
});

/*─────────────────────────────────────────────────────────────*\
 | convertC2PAToEAA Tests                                       |
\*─────────────────────────────────────────────────────────────*/

describe("convertC2PAToEAA", () => {
  it("should convert full C2PA to EAA records", () => {
    const c2pa = createFullC2PA();

    const result = convertC2PAToEAA(c2pa);

    expect(result.resource).toBeDefined();
    expect(result.actions).toHaveLength(2);
    expect(result.attributions.length).toBeGreaterThan(0);
    expect(result.entities.length).toBeGreaterThan(0);
  });

  it("should collect unique entities", () => {
    const c2pa = createFullC2PA();

    const result = convertC2PAToEAA(c2pa);

    const entityIds = result.entities.map((e) => e.id);
    const uniqueIds = new Set(entityIds);
    expect(entityIds.length).toBe(uniqueIds.size);
  });

  it("should create entities from creative work authors", () => {
    const c2pa = createFullC2PA();

    const result = convertC2PAToEAA(c2pa);

    const authorEntity = result.entities.find(
      (e) => e.id === "c2pa:author:alice-photographer"
    );
    expect(authorEntity).toBeDefined();
    expect(authorEntity?.name).toBe("Alice Photographer");
    expect(authorEntity?.role).toBe("human");
  });

  it("should handle minimal C2PA", () => {
    const c2pa = createMinimalC2PA();

    const result = convertC2PAToEAA(c2pa);

    expect(result.resource).toBeDefined();
    expect(result.actions).toEqual([]);
    expect(result.attributions).toEqual([]);
    expect(result.entities).toEqual([]);
  });

  it("should pass options to resource creation", () => {
    const c2pa = createFullC2PA();

    const result = convertC2PAToEAA(c2pa, {
      resourceId: "custom-resource",
      hash: "sha256:test",
    });

    expect(result.resource.id).toBe("custom-resource");
    expect(result.resource.hash).toBe("sha256:test");
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Ingredient Conversion Tests                                  |
\*─────────────────────────────────────────────────────────────*/

describe("ingredientToResource", () => {
  it("should convert ingredient to resource", () => {
    const ingredient: C2PAIngredient = {
      title: "Source Image",
      format: "image/png",
      hash: "sha256:abc123",
      documentId: "doc:source",
      instanceId: "inst:source-1",
      isParent: true,
      relationship: "parentOf",
    };

    const resource = ingredientToResource(ingredient);

    expect(resource.id).toBe("inst:source-1");
    expect(resource.type).toBe("image");
    expect(resource.name).toBe("Source Image");
    expect(resource.hash).toBe("sha256:abc123");
    expect(resource.contentRef.ref).toBe("sha256:abc123");
    expect(resource.contentRef.scheme).toBe("hash");
    expect(resource.metadata?.isParent).toBe(true);
    expect(resource.metadata?.relationship).toBe("parentOf");
  });

  it("should use document ID if no instance ID", () => {
    const ingredient: C2PAIngredient = {
      title: "Component",
      documentId: "doc:component",
    };

    const resource = ingredientToResource(ingredient);

    expect(resource.id).toBe("doc:component");
  });

  it("should fall back to title-based ID", () => {
    const ingredient: C2PAIngredient = {
      title: "Background Layer",
    };

    const resource = ingredientToResource(ingredient);

    expect(resource.id).toBe("ingredient:Background Layer");
  });

  it("should detect video format", () => {
    const ingredient: C2PAIngredient = {
      title: "Video Clip",
      format: "video/mp4",
    };

    const resource = ingredientToResource(ingredient);

    expect(resource.type).toBe("video");
  });

  it("should detect audio format", () => {
    const ingredient: C2PAIngredient = {
      title: "Sound Effect",
      format: "audio/mpeg",
    };

    const resource = ingredientToResource(ingredient);

    expect(resource.type).toBe("audio");
  });
});

describe("getIngredientsAsResources", () => {
  it("should convert all ingredients", () => {
    const c2pa = createFullC2PA();

    const resources = getIngredientsAsResources(c2pa);

    expect(resources).toHaveLength(2);
    expect(resources[0]?.name).toBe("Original RAW");
    expect(resources[1]?.name).toBe("Overlay PNG");
  });

  it("should return empty array if no ingredients", () => {
    const c2pa = createMinimalC2PA();

    const resources = getIngredientsAsResources(c2pa);

    expect(resources).toEqual([]);
  });
});
