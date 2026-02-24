/**
 * Entity Service
 *
 * Business logic for entity operations using @provenancekit/storage.
 * Supports AI agent extensions from @provenancekit/extensions.
 *
 * Entity identity is protected by first-registration-wins:
 * - publicKey is immutable after first set
 * - New entities with a publicKey require a registration signature
 *   (key-ownership proof) when proofPolicy is "enforce" or "warn"
 */

import { v4 as uuidv4 } from "uuid";
import type { Entity } from "@provenancekit/eaa-types";
import {
  withAIAgent,
  createAIAgent,
  isAIAgent,
  getAIAgent,
  withIdentityProof,
  type AIAgentExtension,
} from "@provenancekit/extensions";
import { verifyRegistration } from "@provenancekit/sdk";
import { getContext } from "../context.js";
import { config } from "../config.js";
import { ProvenanceKitError } from "../errors.js";

/*─────────────────────────────────────────────────────────────*\
 | Input Types                                                   |
\*─────────────────────────────────────────────────────────────*/

export interface CreateEntityInput {
  /** Optional ID (auto-generated if not provided) */
  id?: string;
  /** Entity role: human, ai, organization, or ext:* */
  role: string;
  /** Human-readable name */
  name?: string;
  /** Wallet address for payments */
  wallet?: string;
  /** Public key for verification */
  publicKey?: string;
  /** Registration signature proving ownership of publicKey */
  registrationSignature?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** AI agent configuration (if role is "ai") */
  aiAgent?: {
    model: {
      provider: string;
      model: string;
      version?: string;
    };
    delegatedBy?: string;
    autonomyLevel?: "autonomous" | "supervised" | "assistive";
    collaborators?: string[];
    sessionId?: string;
    capabilities?: string[];
  };
}

export interface EntityResult {
  id: string;
  entity: Entity;
}

/*─────────────────────────────────────────────────────────────*\
 | Entity Operations                                             |
\*─────────────────────────────────────────────────────────────*/

/**
 * Register a new entity or update an existing one.
 *
 * Identity protection rules:
 * - New entity with publicKey: requires registrationSignature (when proofPolicy != "off")
 * - Existing entity: publicKey cannot be changed (first-registration-wins)
 * - Mutable fields (name, metadata, extensions, role) can always be updated
 *
 * Automatically adds AI agent extension if role is "ai" and aiAgent config is provided.
 */
export async function registerOrUpdateEntity(
  input: CreateEntityInput
): Promise<EntityResult> {
  const { dbStorage } = getContext();

  const id = input.id ?? uuidv4();
  const existing = await dbStorage.getEntity(id);

  // Existing entity — reject publicKey changes
  if (existing?.publicKey && input.publicKey && existing.publicKey !== input.publicKey) {
    throw new ProvenanceKitError(
      "Forbidden",
      "Cannot change registered public key for existing entity",
      { recovery: "Use the original key pair, or register a new entity ID" }
    );
  }

  // New entity with publicKey — verify key ownership
  if (!existing && input.publicKey && config.proofPolicy !== "off") {
    if (!input.registrationSignature) {
      if (config.proofPolicy === "enforce") {
        throw new ProvenanceKitError(
          "Forbidden",
          "Registration signature required for entities with public keys",
          {
            recovery:
              "Sign the registration using signRegistration() from @provenancekit/sdk",
          }
        );
      }
      if (config.proofPolicy === "warn") {
        console.warn(
          `[proof-policy] Entity "${id}" registered with publicKey but no registration signature`
        );
      }
    } else {
      // Verify the registration signature
      const valid = await verifyRegistration(
        id,
        input.publicKey,
        input.registrationSignature
      );
      if (!valid) {
        throw new ProvenanceKitError(
          "Forbidden",
          "Invalid registration signature — key ownership proof failed",
          {
            recovery:
              "Ensure you signed the correct message: provenancekit:register:{entityId}:{publicKey}",
          }
        );
      }
    }
  }

  // Build entity
  let entity: Entity = {
    id,
    role: input.role as Entity["role"],
    name: input.name,
    publicKey: existing?.publicKey ?? input.publicKey,
    metadata: {
      ...input.metadata,
      ...(input.wallet ? { wallet: input.wallet } : {}),
    },
  };

  // If AI role with agent config, add AI agent extension
  if (input.role === "ai" && input.aiAgent) {
    entity = createAIAgent(id, {
      model: input.aiAgent.model,
      delegatedBy: input.aiAgent.delegatedBy,
      autonomyLevel: input.aiAgent.autonomyLevel,
      collaborators: input.aiAgent.collaborators,
      sessionId: input.aiAgent.sessionId,
      capabilities: input.aiAgent.capabilities,
    });
    // Preserve other fields
    entity.name = input.name;
    entity.publicKey = existing?.publicKey ?? input.publicKey;
    entity.metadata = {
      ...entity.metadata,
      ...input.metadata,
      ...(input.wallet ? { wallet: input.wallet } : {}),
    };
  }

  // Add identity proof extension if registration signature was verified
  if (!existing && input.publicKey && input.registrationSignature) {
    entity = withIdentityProof(entity, {
      method: "key-ownership",
      verifiedAt: new Date().toISOString(),
      registrationSignature: input.registrationSignature,
    });
  }

  await dbStorage.upsertEntity(entity);

  return { id, entity };
}

/**
 * Create or update an entity (backwards-compatible alias).
 * @deprecated Use registerOrUpdateEntity for new code.
 */
export async function upsertEntity(input: CreateEntityInput): Promise<EntityResult> {
  return registerOrUpdateEntity(input);
}

/**
 * Get an entity by ID.
 */
export async function getEntity(id: string): Promise<Entity | null> {
  const { dbStorage } = getContext();
  return dbStorage.getEntity(id);
}

/**
 * Check if an entity exists.
 */
export async function entityExists(id: string): Promise<boolean> {
  const { dbStorage } = getContext();
  return dbStorage.entityExists(id);
}

/**
 * Check if an entity is an AI agent.
 */
export async function checkIsAIAgent(id: string): Promise<boolean> {
  const entity = await getEntity(id);
  if (!entity) return false;
  return isAIAgent(entity);
}

/**
 * Get AI agent extension data for an entity.
 */
export async function getAIAgentData(
  id: string
): Promise<AIAgentExtension | null> {
  const entity = await getEntity(id);
  if (!entity) return null;
  return getAIAgent(entity) ?? null;
}

/**
 * Update an entity's AI agent extension.
 */
export async function updateAIAgentExtension(
  id: string,
  agentData: Partial<AIAgentExtension>
): Promise<Entity | null> {
  const { dbStorage } = getContext();

  const existing = await getEntity(id);
  if (!existing) return null;

  const currentAgent = getAIAgent(existing);
  if (!currentAgent) {
    // Add new AI agent extension
    const updated = withAIAgent(existing, agentData as AIAgentExtension);
    await dbStorage.upsertEntity(updated);
    return updated;
  }

  // Merge with existing
  const updated = withAIAgent(existing, {
    ...currentAgent,
    ...agentData,
  });
  await dbStorage.upsertEntity(updated);
  return updated;
}

/**
 * List entities with optional filtering.
 */
export async function listEntities(options?: {
  role?: string;
  limit?: number;
  offset?: number;
}): Promise<Entity[]> {
  const { dbStorage } = getContext();

  return dbStorage.listEntities({
    role: options?.role,
    limit: options?.limit,
    offset: options?.offset,
  });
}
