/**
 * ProvenanceRegistry Contract ABI
 *
 * Minimal ABI containing only the events needed for indexing.
 * This keeps the package lightweight.
 */

export const PROVENANCE_REGISTRY_ABI = [
  // ActionRecorded event
  {
    type: "event",
    name: "ActionRecorded",
    inputs: [
      { name: "actionId", type: "bytes32", indexed: true },
      { name: "actionType", type: "string", indexed: false },
      { name: "performer", type: "address", indexed: true },
      { name: "inputs", type: "string[]", indexed: false },
      { name: "outputs", type: "string[]", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },

  // ResourceRegistered event
  {
    type: "event",
    name: "ResourceRegistered",
    inputs: [
      { name: "contentRef", type: "string", indexed: true },
      { name: "resourceType", type: "string", indexed: false },
      { name: "creator", type: "address", indexed: true },
      { name: "rootAction", type: "bytes32", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },

  // EntityRegistered event
  {
    type: "event",
    name: "EntityRegistered",
    inputs: [
      { name: "entityAddress", type: "address", indexed: true },
      { name: "entityId", type: "string", indexed: false },
      { name: "entityRole", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },

  // AttributionRecorded event
  {
    type: "event",
    name: "AttributionRecorded",
    inputs: [
      { name: "contentRef", type: "string", indexed: true },
      { name: "entityAddress", type: "address", indexed: true },
      { name: "role", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },

  // ActionAttributionRecorded event
  {
    type: "event",
    name: "ActionAttributionRecorded",
    inputs: [
      { name: "actionId", type: "bytes32", indexed: true },
      { name: "entityAddress", type: "address", indexed: true },
      { name: "role", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

/**
 * Event signatures for filtering logs
 */
export const EVENT_SIGNATURES = {
  ActionRecorded:
    "ActionRecorded(bytes32,string,address,string[],string[],uint256)",
  ResourceRegistered:
    "ResourceRegistered(string,string,address,bytes32,uint256)",
  EntityRegistered: "EntityRegistered(address,string,string,uint256)",
  AttributionRecorded: "AttributionRecorded(string,address,string,uint256)",
  ActionAttributionRecorded:
    "ActionAttributionRecorded(bytes32,address,string,uint256)",
} as const;
