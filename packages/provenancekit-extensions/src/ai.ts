import { z } from "zod";
import type { Entity, Action } from "@provenancekit/eaa-types";

/**
 * Namespace for AI extension.
 * @example "ext:ai@1.0.0"
 */
export const AI_NAMESPACE = "ext:ai@1.0.0" as const;

/*─────────────────────────────────────────────────────────────*\
 | AI AS TOOL                                                    |
 |                                                               |
 | When a human (or agent) uses AI as an instrument to           |
 | accomplish a task. The human is the actor, AI is the tool.    |
 |                                                               |
 | Attached to: Action                                           |
 | Example: "Alice used Claude to write this code"               |
\*─────────────────────────────────────────────────────────────*/

/**
 * Describes AI used as a tool within an action.
 *
 * Use this when the primary actor (performedBy) is human/agent
 * and AI was used as an instrument to accomplish the task.
 *
 * @example
 * ```typescript
 * // Human used AI to generate content
 * const action = withAITool(act, {
 *   model: "claude-3-opus",
 *   provider: "anthropic",
 *   promptHash: "sha256:abc123...",
 * });
 * ```
 */
export const AIToolExtension = z.object({
  /** AI provider */
  provider: z.string(),

  /** Model identifier */
  model: z.string(),

  /** Model version */
  version: z.string().optional(),

  /** Hash of the prompt (privacy-preserving) */
  promptHash: z.string().optional(),

  /** The actual prompt (if disclosure is acceptable) */
  prompt: z.string().optional(),

  /** System prompt used */
  systemPrompt: z.string().optional(),

  /** Model parameters (temperature, etc.) */
  parameters: z.record(z.unknown()).optional(),

  /** Tokens consumed */
  tokensUsed: z.number().optional(),

  /** Generation time in milliseconds */
  generationTime: z.number().optional(),

  /** Seed for reproducibility */
  seed: z.number().optional(),
});

export type AIToolExtension = z.infer<typeof AIToolExtension>;

/*─────────────────────────────────────────────────────────────*\
 | AI AS ACTOR (AGENT)                                           |
 |                                                               |
 | When AI operates as an autonomous agent that can perform      |
 | actions independently. The AI agent IS the actor.             |
 |                                                               |
 | Attached to: Entity (with role: "ai")                         |
 | Example: "Agent-X autonomously created this resource"         |
\*─────────────────────────────────────────────────────────────*/

/**
 * Describes an AI agent as an autonomous actor.
 *
 * Use this on Entity (with role: "ai") when the AI is acting
 * as an independent agent, not just a tool being used.
 *
 * @example
 * ```typescript
 * // Autonomous agent with delegation
 * const agent = withAIAgent(entity, {
 *   model: { provider: "anthropic", model: "claude-3-opus" },
 *   framework: "langchain",
 *   delegatedBy: "did:key:alice",
 *   autonomyLevel: "supervised",
 * });
 * ```
 */
export const AIAgentExtension = z.object({
  /** Underlying model powering this agent */
  model: z
    .object({
      provider: z.string(),
      model: z.string(),
      version: z.string().optional(),
    })
    .optional(),

  /** Agent framework/orchestration system */
  framework: z.string().optional(),

  /** Entity ID who delegated authority to this agent */
  delegatedBy: z.string().optional(),

  /**
   * Level of autonomy:
   * - "full": Acts independently without human approval
   * - "supervised": Human monitors but doesn't approve each action
   * - "assisted": Human approves significant actions
   * - "tool": Effectively used as a tool (prefer AIToolExtension)
   */
  autonomyLevel: z.string().optional(),

  /** Capabilities/permissions granted to this agent */
  capabilities: z.array(z.string()).optional(),

  /** Session/task ID for grouping collaborative work */
  sessionId: z.string().optional(),

  /** Other agents this agent collaborates with (Entity IDs) */
  collaborators: z.array(z.string()).optional(),

  /** Role in multi-agent system (e.g., "coordinator", "specialist", "reviewer") */
  agentRole: z.string().optional(),

  /** Agent-specific configuration */
  config: z.record(z.unknown()).optional(),
});

export type AIAgentExtension = z.infer<typeof AIAgentExtension>;

/*─────────────────────────────────────────────────────────────*\
 | HELPER FUNCTIONS                                              |
\*─────────────────────────────────────────────────────────────*/

/**
 * Add AI tool extension to an action.
 * Use when AI is being used as a tool by another actor.
 */
export function withAITool(
  action: Action,
  tool: z.input<typeof AIToolExtension>
): Action {
  const validated = AIToolExtension.parse(tool);
  return {
    ...action,
    extensions: {
      ...action.extensions,
      [AI_NAMESPACE]: { ...getAIExtension(action), tool: validated },
    },
  };
}

/**
 * Add AI agent extension to an entity.
 * Use when the entity IS an autonomous AI agent.
 */
export function withAIAgent(
  entity: Entity,
  agent: z.input<typeof AIAgentExtension>
): Entity {
  const validated = AIAgentExtension.parse(agent);
  return {
    ...entity,
    extensions: {
      ...entity.extensions,
      [AI_NAMESPACE]: { ...getAIExtension(entity), agent: validated },
    },
  };
}

// Internal helper to get existing AI extension data
function getAIExtension(
  obj: Entity | Action
): Record<string, unknown> | undefined {
  return obj.extensions?.[AI_NAMESPACE] as Record<string, unknown> | undefined;
}

/**
 * Get AI tool extension from an action.
 */
export function getAITool(action: Action): AIToolExtension | undefined {
  const ext = getAIExtension(action);
  if (!ext?.tool) return undefined;
  return AIToolExtension.parse(ext.tool);
}

/**
 * Get AI agent extension from an entity.
 */
export function getAIAgent(entity: Entity): AIAgentExtension | undefined {
  const ext = getAIExtension(entity);
  if (!ext?.agent) return undefined;
  return AIAgentExtension.parse(ext.agent);
}

/**
 * Check if an action used AI as a tool.
 */
export function usedAITool(action: Action): boolean {
  const ext = getAIExtension(action);
  return ext?.tool !== undefined;
}

/**
 * Check if an entity is an AI agent.
 */
export function isAIAgent(entity: Entity): boolean {
  const ext = getAIExtension(entity);
  return ext?.agent !== undefined || entity.role === "ai";
}

/**
 * Get the model identifier from an action's AI tool usage.
 */
export function getToolModel(action: Action): string | undefined {
  const tool = getAITool(action);
  return tool?.model;
}

/**
 * Get the model identifier from an AI agent entity.
 */
export function getAgentModel(entity: Entity): string | undefined {
  const agent = getAIAgent(entity);
  return agent?.model?.model;
}

/**
 * Create an AI agent entity.
 *
 * @example
 * ```typescript
 * const agent = createAIAgent("agent:coordinator", {
 *   name: "Task Coordinator",
 *   model: { provider: "anthropic", model: "claude-3-opus" },
 *   framework: "autogen",
 *   delegatedBy: "did:key:alice",
 *   autonomyLevel: "supervised",
 *   agentRole: "coordinator",
 * });
 * ```
 */
export function createAIAgent(
  id: string,
  options: {
    name?: string;
    model?: { provider: string; model: string; version?: string };
    framework?: string;
    delegatedBy?: string;
    autonomyLevel?: string;
    capabilities?: string[];
    sessionId?: string;
    collaborators?: string[];
    agentRole?: string;
  }
): Entity {
  const entity: Entity = {
    id,
    name: options.name ?? id,
    role: "ai",
  };

  return withAIAgent(entity, {
    model: options.model,
    framework: options.framework,
    delegatedBy: options.delegatedBy,
    autonomyLevel: options.autonomyLevel,
    capabilities: options.capabilities,
    sessionId: options.sessionId,
    collaborators: options.collaborators,
    agentRole: options.agentRole,
  });
}

/**
 * Add collaborators to an AI agent.
 */
export function addCollaborators(
  entity: Entity,
  collaboratorIds: string[]
): Entity {
  const existing = getAIAgent(entity);
  const currentCollaborators = existing?.collaborators ?? [];
  const newCollaborators = [
    ...new Set([...currentCollaborators, ...collaboratorIds]),
  ];

  return withAIAgent(entity, {
    ...existing,
    collaborators: newCollaborators,
  });
}

/**
 * Set the session ID for collaborative work.
 */
export function setAgentSession(entity: Entity, sessionId: string): Entity {
  const existing = getAIAgent(entity);
  return withAIAgent(entity, {
    ...existing,
    sessionId,
  });
}

