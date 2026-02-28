/**
 * Type-safe, null-safe wrappers around @provenancekit/extensions helpers.
 * All functions return `null` instead of throwing when extension is not present.
 */

import {
  getAITool,
  getAIAgent,
  getLicense,
  getContrib,
  getOnchain,
  getVerification,
  getWitness,
  type AIToolExtension,
  type AIAgentExtension,
  type LicenseExtension,
  type ContribExtension,
  type OnchainExtension,
  type VerificationExtension,
  type WitnessExtension,
} from "@provenancekit/extensions";

import type { Action, Entity, Resource, Attribution } from "@provenancekit/eaa-types";

type AnyEaaType = Action | Entity | Resource | Attribution;

export function getAIToolSafe(action: Action | null | undefined): AIToolExtension | null {
  if (!action) return null;
  try {
    return getAITool(action) ?? null;
  } catch {
    return null;
  }
}

export function getAIAgentSafe(entity: Entity | null | undefined): AIAgentExtension | null {
  if (!entity) return null;
  try {
    return getAIAgent(entity) ?? null;
  } catch {
    return null;
  }
}

export function getLicenseSafe(
  target: Resource | Attribution | null | undefined
): LicenseExtension | null {
  if (!target) return null;
  try {
    return getLicense(target as any) ?? null;
  } catch {
    return null;
  }
}

export function getContribSafe(
  attribution: Attribution | null | undefined
): ContribExtension | null {
  if (!attribution) return null;
  try {
    return getContrib(attribution) ?? null;
  } catch {
    return null;
  }
}

export function getOnchainSafe(target: AnyEaaType | null | undefined): OnchainExtension | null {
  if (!target) return null;
  try {
    return getOnchain(target as any) ?? null;
  } catch {
    return null;
  }
}

export function getVerificationSafe(
  action: Action | null | undefined
): VerificationExtension | null {
  if (!action) return null;
  try {
    return getVerification(action) ?? null;
  } catch {
    return null;
  }
}

export function getWitnessSafe(action: Action | null | undefined): WitnessExtension | null {
  if (!action) return null;
  try {
    return getWitness(action) ?? null;
  } catch {
    return null;
  }
}

/** Check if any action in a bundle used an AI tool */
export function bundleHasAI(actions: Action[]): boolean {
  return actions.some((a) => getAIToolSafe(a) !== null);
}

/** Get the primary creator attribution (role === "creator", or first) */
export function getPrimaryCreator(
  attributions: Attribution[],
  entities: Entity[]
): Entity | null {
  const creatorAttr = attributions.find((a) => a.role === "creator") ?? attributions[0];
  if (!creatorAttr) return null;
  return entities.find((e) => e.id === creatorAttr.entityId) ?? null;
}

export type {
  AIToolExtension,
  AIAgentExtension,
  LicenseExtension,
  ContribExtension,
  OnchainExtension,
  VerificationExtension,
  WitnessExtension,
};
