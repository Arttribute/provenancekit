/**
 * Converters between C2PA and EAA types.
 *
 * Maps C2PA manifest structures to EAA provenance records
 * (Entity, Action, Attribution, Resource).
 *
 * @packageDocumentation
 */

import type { ContentReference } from "@arttribute/eaa-types";
import type {
  MediaAction as Action,
  MediaAttribution as Attribution,
  MediaEntity as Entity,
  MediaResource as Resource,
} from "../types.js";
import type {
  C2PAExtension,
  C2PAAction,
  C2PAActor,
  C2PAIngredient,
} from "../types.js";
import { withC2PA } from "../extension.js";

/*─────────────────────────────────────────────────────────────*\
 | C2PA Action Type Mapping                                     |
\*─────────────────────────────────────────────────────────────*/

/**
 * Map C2PA action type to EAA action type.
 */
function mapC2PAActionType(c2paAction: string): string {
  const mapping: Record<string, string> = {
    "c2pa.created": "create",
    "c2pa.placed": "transform",
    "c2pa.cropped": "transform",
    "c2pa.resized": "transform",
    "c2pa.edited": "transform",
    "c2pa.filtered": "transform",
    "c2pa.color_adjusted": "transform",
    "c2pa.orientation": "transform",
    "c2pa.converted": "transform",
    "c2pa.opened": "ext:c2pa:opened",
    "c2pa.unknown": "ext:c2pa:unknown",
    "c2pa.drawing": "transform",
    "c2pa.published": "ext:c2pa:published",
    "c2pa.transcoded": "transform",
    "c2pa.repackaged": "transform",
    "c2pa.removed": "transform",
  };
  return mapping[c2paAction] ?? `ext:c2pa:${c2paAction.replace("c2pa.", "")}`;
}

/*─────────────────────────────────────────────────────────────*\
 | Entity Conversion                                            |
\*─────────────────────────────────────────────────────────────*/

/**
 * Convert a C2PA actor to an EAA Entity.
 *
 * @param actor - C2PA actor
 * @param index - Index for generating unique IDs
 * @returns EAA Entity
 */
export function actorToEntity(actor: C2PAActor, index = 0): Entity {
  const role = actor.type === "ai" ? "ai" : actor.type === "organization" ? "organization" : "human";

  return {
    id: actor.identifier ?? `c2pa:actor:${index}`,
    name: actor.name,
    role,
    metadata: actor.credentials
      ? { credentials: actor.credentials }
      : undefined,
  };
}

/**
 * Convert software agent info to an EAA Entity.
 *
 * @param softwareAgent - Software agent info
 * @returns EAA Entity
 */
export function softwareAgentToEntity(
  softwareAgent: { name: string; version?: string }
): Entity {
  return {
    id: `software:${softwareAgent.name.toLowerCase().replace(/\s+/g, "-")}`,
    name: softwareAgent.name,
    role: "ai", // Software agents are treated as AI tools
    metadata: softwareAgent.version
      ? { version: softwareAgent.version }
      : undefined,
  };
}

/*─────────────────────────────────────────────────────────────*\
 | Action Conversion                                            |
\*─────────────────────────────────────────────────────────────*/

/**
 * Convert a C2PA action to an EAA Action.
 *
 * @param c2paAction - C2PA action
 * @param resourceRef - Reference to the resource
 * @param index - Index for generating unique IDs
 * @returns EAA Action
 */
export function c2paActionToEAAAction(
  c2paAction: C2PAAction,
  resourceRef: ContentReference,
  index = 0
): { action: Action; entities: Entity[] } {
  const entities: Entity[] = [];

  // Determine performer
  let performedBy = "c2pa:unknown";

  // Check for actors
  if (c2paAction.actors && c2paAction.actors.length > 0) {
    const primaryActor = c2paAction.actors[0];
    const entity = actorToEntity(primaryActor!, 0);
    entities.push(entity);
    performedBy = entity.id!;

    // Add remaining actors as entities
    for (let i = 1; i < c2paAction.actors.length; i++) {
      entities.push(actorToEntity(c2paAction.actors[i]!, i));
    }
  }

  // Check for software agent
  if (c2paAction.softwareAgent) {
    const softwareEntity = softwareAgentToEntity(c2paAction.softwareAgent);
    entities.push(softwareEntity);

    // If no human actor, software agent is the performer
    if (performedBy === "c2pa:unknown") {
      performedBy = softwareEntity.id!;
    }
  }

  const action: Action = {
    id: `c2pa:action:${index}`,
    type: mapC2PAActionType(c2paAction.action),
    performedBy,
    timestamp: c2paAction.when ?? new Date().toISOString(),
    inputs: [],
    outputs: [resourceRef],
    metadata: {
      c2paAction: c2paAction.action,
      digitalSourceType: c2paAction.digitalSourceType,
      reason: c2paAction.reason,
      parameters: c2paAction.parameters,
    },
  };

  // Add AI tool extension if software agent present
  if (c2paAction.softwareAgent) {
    action.extensions = {
      ...action.extensions,
      "ext:ai-tool@1.0.0": {
        toolName: c2paAction.softwareAgent.name,
        toolVersion: c2paAction.softwareAgent.version,
        usage: "generation",
      },
    };
  }

  return { action, entities };
}

/*─────────────────────────────────────────────────────────────*\
 | Attribution Conversion                                       |
\*─────────────────────────────────────────────────────────────*/

/**
 * Create attributions from C2PA manifest data.
 *
 * @param c2pa - C2PA extension data
 * @param resourceRef - Reference to the resource
 * @returns Array of EAA Attributions
 */
export function createAttributionsFromC2PA(
  c2pa: C2PAExtension,
  resourceRef: ContentReference
): Attribution[] {
  const attributions: Attribution[] = [];

  // Create attributions from creative work
  if (c2pa.creativeWork?.author) {
    for (const author of c2pa.creativeWork.author) {
      const attribution: Attribution = {
        entityId: `c2pa:author:${author.toLowerCase().replace(/\s+/g, "-")}`,
        role: "creator",
        resourceRef,
        note: `Author: ${author}`,
      };
      attributions.push(attribution);
    }
  }

  // Create attributions from actions
  if (c2pa.actions) {
    for (let i = 0; i < c2pa.actions.length; i++) {
      const action = c2pa.actions[i]!;

      // Attribution for software agent
      if (action.softwareAgent) {
        const attribution: Attribution = {
          entityId: `software:${action.softwareAgent.name.toLowerCase().replace(/\s+/g, "-")}`,
          role: "contributor",
          resourceRef,
          note: `${action.action} using ${action.softwareAgent.name}`,
          extensions: {
            "ext:contrib@1.0.0": {
              weight: 1000, // 10% default for tools
              basis: "points",
              source: "calculated",
              category: "tool",
            },
          },
        };
        attributions.push(attribution);
      }

      // Attributions for actors
      if (action.actors) {
        for (let j = 0; j < action.actors.length; j++) {
          const actor = action.actors[j]!;
          const role = action.action === "c2pa.created" ? "creator" : "contributor";

          const attribution: Attribution = {
            entityId: actor.identifier ?? `c2pa:actor:${i}-${j}`,
            role,
            resourceRef,
            note: `${action.action}${actor.name ? ` by ${actor.name}` : ""}`,
          };
          attributions.push(attribution);
        }
      }
    }
  }

  // AI disclosure attribution
  if (c2pa.aiDisclosure?.isAIGenerated) {
    const aiAttribution: Attribution = {
      entityId: c2pa.aiDisclosure.aiTool
        ? `ai:${c2pa.aiDisclosure.aiTool.toLowerCase().replace(/\s+/g, "-")}`
        : "ai:unknown",
      role: "contributor",
      resourceRef,
      note: `AI-generated${c2pa.aiDisclosure.aiTool ? ` using ${c2pa.aiDisclosure.aiTool}` : ""}`,
      extensions: {
        "ext:contrib@1.0.0": {
          weight: 5000, // 50% for AI generation
          basis: "points",
          source: "self-declared",
          category: "ai-generation",
        },
      },
    };
    attributions.push(aiAttribution);
  }

  return attributions;
}

/*─────────────────────────────────────────────────────────────*\
 | Resource Conversion                                          |
\*─────────────────────────────────────────────────────────────*/

/**
 * Create a content reference from C2PA data.
 *
 * @param c2pa - C2PA extension data
 * @param filePath - Path to the file
 * @returns Content reference
 */
export function createContentReference(
  c2pa: C2PAExtension,
  filePath?: string
): ContentReference {
  // Use instance ID as the reference if available
  if (c2pa.instanceId) {
    return {
      ref: c2pa.instanceId,
      scheme: "c2pa:instance",
    };
  }

  // Fall back to manifest label
  return {
    ref: c2pa.manifestLabel,
    scheme: "c2pa:manifest",
  };
}

/**
 * Create an EAA Resource from C2PA data.
 *
 * @param c2pa - C2PA extension data
 * @param options - Additional options
 * @returns EAA Resource with C2PA extension
 */
export function createResourceFromC2PA(
  c2pa: C2PAExtension,
  options: {
    id?: string;
    filePath?: string;
    hash?: string;
  } = {}
): Resource {
  const contentRef = createContentReference(c2pa, options.filePath);

  // Determine resource type from format
  let type: string = "other";
  if (c2pa.format) {
    if (c2pa.format.startsWith("image/")) type = "image";
    else if (c2pa.format.startsWith("video/")) type = "video";
    else if (c2pa.format.startsWith("audio/")) type = "audio";
    else if (c2pa.format === "application/pdf") type = "other";
  }

  const resource: Resource = {
    id: options.id ?? c2pa.instanceId ?? c2pa.manifestLabel,
    type,
    contentRef,
    name: c2pa.title,
    metadata: {
      format: c2pa.format,
      claimGenerator: c2pa.claimGenerator,
    },
  };

  // Add hash if provided
  if (options.hash) {
    resource.hash = options.hash;
  }

  // Add C2PA extension
  return withC2PA(resource, c2pa);
}

/*─────────────────────────────────────────────────────────────*\
 | Full Conversion                                              |
\*─────────────────────────────────────────────────────────────*/

/**
 * Convert full C2PA manifest to EAA provenance records.
 *
 * @param c2pa - C2PA extension data
 * @param options - Conversion options
 * @returns Complete EAA provenance records
 */
export function convertC2PAToEAA(
  c2pa: C2PAExtension,
  options: {
    resourceId?: string;
    filePath?: string;
    hash?: string;
  } = {}
): {
  resource: Resource;
  actions: Action[];
  attributions: Attribution[];
  entities: Entity[];
} {
  // Create resource - map resourceId to id for createResourceFromC2PA
  const resource = createResourceFromC2PA(c2pa, {
    id: options.resourceId,
    filePath: options.filePath,
    hash: options.hash,
  });
  const contentRef = resource.contentRef!;

  // Convert actions and collect entities
  const actions: Action[] = [];
  const entitiesMap = new Map<string, Entity>();

  if (c2pa.actions) {
    for (let i = 0; i < c2pa.actions.length; i++) {
      const { action, entities } = c2paActionToEAAAction(
        c2pa.actions[i]!,
        contentRef,
        i
      );
      actions.push(action);

      for (const entity of entities) {
        if (entity.id && !entitiesMap.has(entity.id)) {
          entitiesMap.set(entity.id, entity);
        }
      }
    }
  }

  // Create attributions
  const attributions = createAttributionsFromC2PA(c2pa, contentRef);

  // Add entities from attributions
  for (const attr of attributions) {
    if (!entitiesMap.has(attr.entityId)) {
      // Create basic entity for attribution
      entitiesMap.set(attr.entityId, {
        id: attr.entityId,
        role: attr.entityId.startsWith("ai:") || attr.entityId.startsWith("software:")
          ? "ai"
          : "human",
      });
    }
  }

  // Add entities from creative work (or update existing ones with name)
  if (c2pa.creativeWork?.author) {
    for (const author of c2pa.creativeWork.author) {
      const entityId = `c2pa:author:${author.toLowerCase().replace(/\s+/g, "-")}`;
      const existing = entitiesMap.get(entityId);
      // Always set/update to include the name from creative work
      entitiesMap.set(entityId, {
        ...existing,
        id: entityId,
        name: author,
        role: "human",
      });
    }
  }

  return {
    resource,
    actions,
    attributions,
    entities: Array.from(entitiesMap.values()),
  };
}

/*─────────────────────────────────────────────────────────────*\
 | Ingredient Conversion                                        |
\*─────────────────────────────────────────────────────────────*/

/**
 * Convert C2PA ingredient to EAA Resource.
 *
 * @param ingredient - C2PA ingredient
 * @returns EAA Resource representing the ingredient
 */
export function ingredientToResource(ingredient: C2PAIngredient): Resource {
  let type: string = "other";
  if (ingredient.format) {
    if (ingredient.format.startsWith("image/")) type = "image";
    else if (ingredient.format.startsWith("video/")) type = "video";
    else if (ingredient.format.startsWith("audio/")) type = "audio";
  }

  return {
    id: ingredient.instanceId ?? ingredient.documentId ?? `ingredient:${ingredient.title}`,
    type,
    contentRef: {
      ref: ingredient.hash ?? ingredient.documentId ?? ingredient.title,
      scheme: ingredient.hash ? "hash" : "c2pa:ingredient",
    },
    name: ingredient.title,
    hash: ingredient.hash,
    metadata: {
      format: ingredient.format,
      relationship: ingredient.relationship,
      isParent: ingredient.isParent,
    },
  };
}

/**
 * Get all ingredients as EAA Resources.
 *
 * @param c2pa - C2PA extension data
 * @returns Array of EAA Resources representing ingredients
 */
export function getIngredientsAsResources(c2pa: C2PAExtension): Resource[] {
  if (!c2pa.ingredients) return [];
  return c2pa.ingredients.map(ingredientToResource);
}
