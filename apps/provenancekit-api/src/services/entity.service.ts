/**
 * Entity Service
 *
 * Business logic for entity operations using @provenancekit/storage.
 * Supports AI agent extensions from @provenancekit/extensions.
 */

import { v4 as uuidv4 } from "uuid";
import type { Entity } from "@arttribute/eaa-types";
import {
  withAIAgent,
  createAIAgent,
  isAIAgent,
  getAIAgent,
  type AIAgentExtension,
} from "@provenancekit/extensions";
import { getContext } from "../context.js";

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
 * Create or update an entity.
 * Automatically adds AI agent extension if role is "ai" and aiAgent config is provided.
 */
export async function upsertEntity(input: CreateEntityInput): Promise<EntityResult> {
  const { dbStorage } = getContext();

  const id = input.id ?? uuidv4();

  // Build base entity
  let entity: Entity = {
    id,
    role: input.role as Entity["role"],
    name: input.name,
    publicKey: input.publicKey,
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
    entity.publicKey = input.publicKey;
    entity.metadata = {
      ...entity.metadata,
      ...input.metadata,
      ...(input.wallet ? { wallet: input.wallet } : {}),
    };
  }

  await dbStorage.upsertEntity(entity);

  return { id, entity };
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
  const { supabase } = getContext();

  let query = supabase.from("pk_entity").select("*");

  if (options?.role) {
    query = query.eq("role", options.role);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to list entities:", error);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    role: row.role as Entity["role"],
    name: (row.name as string) ?? undefined,
    publicKey: (row.public_key as string) ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    extensions: (row.extensions as Record<string, unknown>) ?? undefined,
  }));
}
