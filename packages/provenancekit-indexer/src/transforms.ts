/**
 * Event to EAA Type Transformations
 *
 * Converts blockchain events into EAA types for storage.
 * Handles the mapping between on-chain and off-chain representations.
 */

import type {
  Entity,
  Resource,
  Action,
  Attribution,
  ContentReference,
  EntityRole,
  ActionType,
  AttributionRole,
  ResourceType,
} from "@arttribute/eaa-types";
import { cidRef } from "@arttribute/eaa-types";

import type {
  ActionRecordedEvent,
  ResourceRegisteredEvent,
  EntityRegisteredEvent,
  AttributionRecordedEvent,
  ActionAttributionRecordedEvent,
} from "./types.js";

/*─────────────────────────────────────────────────────────────*\
 | Helper Functions                                             |
\*─────────────────────────────────────────────────────────────*/

/**
 * Convert Unix timestamp (seconds) to ISO 8601 string
 */
function timestampToISO(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toISOString();
}

/**
 * Parse a content reference string into a ContentReference object.
 *
 * Supports:
 * - IPFS CIDs (bafyabc..., Qm...)
 * - Arweave IDs (ar://...)
 * - HTTP URLs (https://...)
 * - Raw hashes (sha256:...)
 *
 * Defaults to CID scheme if no prefix detected.
 */
export function parseContentRef(ref: string): ContentReference {
  // Arweave
  if (ref.startsWith("ar://")) {
    return { ref: ref.slice(5), scheme: "ar" };
  }

  // HTTP/HTTPS URLs
  if (ref.startsWith("http://") || ref.startsWith("https://")) {
    return { ref, scheme: "http" };
  }

  // Hash with algorithm prefix
  if (ref.includes(":") && !ref.startsWith("ext:")) {
    const colonIndex = ref.indexOf(":");
    const algo = ref.slice(0, colonIndex).toLowerCase();
    if (["sha256", "sha512", "md5", "blake2b"].includes(algo)) {
      return { ref, scheme: "hash" };
    }
  }

  // Default: assume IPFS CID
  return cidRef(ref);
}

/**
 * Convert content reference strings to ContentReference array
 */
function parseContentRefs(refs: string[]): ContentReference[] {
  return refs.map(parseContentRef);
}

/**
 * Validate and normalize entity role
 */
function normalizeEntityRole(role: string): EntityRole {
  const normalized = role.toLowerCase();
  if (["human", "ai", "organization"].includes(normalized)) {
    return normalized as EntityRole;
  }
  // Return as extension if not core role
  return role.startsWith("ext:") ? role : `ext:custom:${role}`;
}

/**
 * Validate and normalize action type
 */
function normalizeActionType(type: string): ActionType {
  const normalized = type.toLowerCase();
  if (["create", "transform", "aggregate", "verify"].includes(normalized)) {
    return normalized as ActionType;
  }
  // Return as extension if not core type
  return type.startsWith("ext:") ? type : `ext:custom:${type}`;
}

/**
 * Validate and normalize attribution role
 */
function normalizeAttributionRole(role: string): AttributionRole {
  const normalized = role.toLowerCase();
  if (["creator", "contributor", "source"].includes(normalized)) {
    return normalized as AttributionRole;
  }
  // Return as extension if not core role
  return role.startsWith("ext:") ? role : `ext:custom:${role}`;
}

/**
 * Validate and normalize resource type
 */
function normalizeResourceType(type: string): ResourceType {
  const normalized = type.toLowerCase();
  if (
    ["text", "image", "audio", "video", "code", "dataset", "model", "other"].includes(
      normalized
    )
  ) {
    return normalized as ResourceType;
  }
  // Return as extension if not core type
  return type.startsWith("ext:") ? type : `ext:custom:${type}`;
}

/*─────────────────────────────────────────────────────────────*\
 | Event Transformers                                           |
\*─────────────────────────────────────────────────────────────*/

/**
 * Transform ActionRecorded event to EAA Action
 */
export function transformActionRecorded(
  event: ActionRecordedEvent,
  chainId: number
): Action {
  return {
    id: event.actionId,
    type: normalizeActionType(event.actionType),
    performedBy: event.performer,
    timestamp: timestampToISO(event.timestamp),
    inputs: parseContentRefs(event.inputs),
    outputs: parseContentRefs(event.outputs),
    proof: event.transactionHash,
    extensions: {
      "ext:onchain@1.0.0": {
        chainId,
        blockNumber: Number(event.blockNumber),
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
      },
    },
  };
}

/**
 * Transform ResourceRegistered event to EAA Resource
 */
export function transformResourceRegistered(
  event: ResourceRegisteredEvent,
  chainId: number
): Resource {
  return {
    address: parseContentRef(event.contentRef),
    type: normalizeResourceType(event.resourceType),
    locations: [], // Storage hints not available from on-chain data
    createdAt: timestampToISO(event.timestamp),
    createdBy: event.creator,
    rootAction: event.rootAction,
    extensions: {
      "ext:onchain@1.0.0": {
        chainId,
        blockNumber: Number(event.blockNumber),
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
      },
    },
  };
}

/**
 * Transform EntityRegistered event to EAA Entity
 */
export function transformEntityRegistered(
  event: EntityRegisteredEvent,
  chainId: number
): Entity {
  return {
    id: event.entityId || event.entityAddress,
    name: undefined,
    role: normalizeEntityRole(event.entityRole),
    publicKey: undefined,
    metadata: {
      walletAddress: event.entityAddress,
    },
    extensions: {
      "ext:onchain@1.0.0": {
        chainId,
        blockNumber: Number(event.blockNumber),
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        registeredAt: timestampToISO(event.timestamp),
      },
    },
  };
}

/**
 * Transform AttributionRecorded event to EAA Attribution
 */
export function transformAttributionRecorded(
  event: AttributionRecordedEvent,
  chainId: number
): Attribution {
  return {
    resourceRef: parseContentRef(event.contentRef),
    entityId: event.entityAddress,
    role: normalizeAttributionRole(event.role),
    extensions: {
      "ext:onchain@1.0.0": {
        chainId,
        blockNumber: Number(event.blockNumber),
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        recordedAt: timestampToISO(event.timestamp),
      },
    },
  };
}

/**
 * Transform ActionAttributionRecorded event to EAA Attribution
 */
export function transformActionAttributionRecorded(
  event: ActionAttributionRecordedEvent,
  chainId: number
): Attribution {
  return {
    actionId: event.actionId,
    entityId: event.entityAddress,
    role: normalizeAttributionRole(event.role),
    extensions: {
      "ext:onchain@1.0.0": {
        chainId,
        blockNumber: Number(event.blockNumber),
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        recordedAt: timestampToISO(event.timestamp),
      },
    },
  };
}

/*─────────────────────────────────────────────────────────────*\
 | Batch Transformation                                         |
\*─────────────────────────────────────────────────────────────*/

/**
 * Result of transforming a batch of events
 */
export interface TransformResult {
  entities: Entity[];
  resources: Resource[];
  actions: Action[];
  attributions: Attribution[];
}

/**
 * Transform multiple events into EAA types
 */
export function transformEvents(
  events: Array<{
    type: string;
    data:
      | ActionRecordedEvent
      | ResourceRegisteredEvent
      | EntityRegisteredEvent
      | AttributionRecordedEvent
      | ActionAttributionRecordedEvent;
  }>,
  chainId: number
): TransformResult {
  const result: TransformResult = {
    entities: [],
    resources: [],
    actions: [],
    attributions: [],
  };

  for (const event of events) {
    switch (event.type) {
      case "ActionRecorded":
        result.actions.push(
          transformActionRecorded(event.data as ActionRecordedEvent, chainId)
        );
        break;
      case "ResourceRegistered":
        result.resources.push(
          transformResourceRegistered(
            event.data as ResourceRegisteredEvent,
            chainId
          )
        );
        break;
      case "EntityRegistered":
        result.entities.push(
          transformEntityRegistered(
            event.data as EntityRegisteredEvent,
            chainId
          )
        );
        break;
      case "AttributionRecorded":
        result.attributions.push(
          transformAttributionRecorded(
            event.data as AttributionRecordedEvent,
            chainId
          )
        );
        break;
      case "ActionAttributionRecorded":
        result.attributions.push(
          transformActionAttributionRecorded(
            event.data as ActionAttributionRecordedEvent,
            chainId
          )
        );
        break;
    }
  }

  return result;
}
