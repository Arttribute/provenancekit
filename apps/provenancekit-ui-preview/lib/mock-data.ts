import type { ProvenanceBundle, GraphNode, GraphEdge, SessionProvenance } from "@provenancekit/sdk";

// ── Mock ProvenanceBundle ──────────────────────────────────────────────────
export const mockBundle: ProvenanceBundle = {
  entities: [
    {
      id: "user:alice",
      role: "human",
      name: "Alice Chen",
    },
    {
      id: "app:poetry-service",
      role: "organization",
      name: "Poetry Service",
    },
  ],
  actions: [
    {
      id: "action-001",
      type: "create",
      performedBy: "user:alice",
      timestamp: "2026-03-07T14:22:00Z",
      outputs: [{ ref: "bafybeia...prompt" }],
    },
    {
      id: "action-002",
      type: "create",
      performedBy: "app:poetry-service",
      timestamp: "2026-03-07T14:23:00Z",
      inputs: [{ ref: "bafybeia...prompt" }],
      outputs: [{ ref: "bafybei...poem" }],
      extensions: {
        "ext:ai@1.0.0": {
          provider: "anthropic",
          model: "claude-sonnet-4-6",
          autonomyLevel: "assistive",
          tokensUsed: 1247,
        },
      },
    },
  ],
  resources: [
    {
      address: { ref: "bafybeia...prompt" },
      type: "text",
      locations: [],
      createdAt: "2026-03-07T14:22:00Z",
      createdBy: "user:alice",
      rootAction: "action-001",
    },
    {
      address: { ref: "bafybei...poem" },
      type: "text",
      locations: [],
      createdAt: "2026-03-07T14:23:10Z",
      createdBy: "app:poetry-service",
      rootAction: "action-002",
    },
  ],
  attributions: [
    {
      entityId: "user:alice",
      role: "creator",
      resourceRef: { ref: "bafybei...poem" },
      extensions: { weight: 7000 },
    },
    {
      entityId: "app:poetry-service",
      role: "contributor",
      resourceRef: { ref: "bafybei...poem" },
      extensions: { weight: 3000 },
    },
  ],
};

// ── Mock Graph (nodes + edges) ─────────────────────────────────────────────
export const mockNodes: GraphNode[] = [
  {
    id: "entity:alice",
    type: "entity",
    label: "Alice Chen",
    data: { role: "human", id: "user:alice" },
  },
  {
    id: "resource:prompt",
    type: "resource",
    label: "prompt.txt",
    data: { type: "text", cid: "bafybeia...prompt" },
  },
  {
    id: "action:create-poem",
    type: "action",
    label: "create",
    data: {
      type: "create",
      "ext:ai@1.0.0": { provider: "anthropic", model: "claude-sonnet-4-6", autonomyLevel: "assistive" },
    },
  },
  {
    id: "resource:poem",
    type: "resource",
    label: "poem.txt",
    data: { type: "text", cid: "bafybei...poem" },
  },
  {
    id: "entity:poetry-service",
    type: "entity",
    label: "Poetry Service",
    data: { role: "organization", id: "app:poetry-service" },
  },
];

export const mockEdges: GraphEdge[] = [
  { from: "entity:alice", to: "resource:prompt", type: "produces" },
  { from: "resource:prompt", to: "action:create-poem", type: "consumes" },
  { from: "entity:poetry-service", to: "action:create-poem", type: "performedBy" },
  { from: "action:create-poem", to: "resource:poem", type: "produces" },
];

// ── Mock Session ───────────────────────────────────────────────────────────
export const mockSession: SessionProvenance = {
  sessionId: "chat-session-demo-001",
  actions: [
    {
      id: "act-001",
      type: "create",
      performedBy: "user:alice",
      timestamp: "2026-03-07T14:20:00Z",
      outputs: [{ ref: "bafybeia...msg1" }],
    },
    {
      id: "act-002",
      type: "create",
      performedBy: "app:chat-service",
      timestamp: "2026-03-07T14:20:05Z",
      inputs: [{ ref: "bafybeia...msg1" }],
      outputs: [{ ref: "bafybei...reply1" }],
      extensions: {
        "ext:ai@1.0.0": {
          provider: "anthropic",
          model: "claude-sonnet-4-6",
          autonomyLevel: "assistive",
          tokensUsed: 342,
        },
      },
    },
    {
      id: "act-003",
      type: "create",
      performedBy: "user:alice",
      timestamp: "2026-03-07T14:21:10Z",
      outputs: [{ ref: "bafybeia...msg2" }],
    },
    {
      id: "act-004",
      type: "create",
      performedBy: "app:chat-service",
      timestamp: "2026-03-07T14:21:18Z",
      inputs: [{ ref: "bafybeia...msg2" }],
      outputs: [{ ref: "bafybei...reply2" }],
      extensions: {
        "ext:ai@1.0.0": {
          provider: "anthropic",
          model: "claude-sonnet-4-6",
          autonomyLevel: "assistive",
          tokensUsed: 891,
        },
      },
    },
  ],
  resources: [
    {
      address: { ref: "bafybeia...msg1" },
      type: "text",
      locations: [],
      createdAt: "2026-03-07T14:20:00Z",
      createdBy: "user:alice",
      rootAction: "act-001",
    },
    {
      address: { ref: "bafybei...reply1" },
      type: "text",
      locations: [],
      createdAt: "2026-03-07T14:20:05Z",
      createdBy: "app:chat-service",
      rootAction: "act-002",
    },
  ],
  entities: [
    { id: "user:alice", role: "human", name: "Alice" },
    { id: "app:chat-service", role: "organization", name: "Chat Service" },
  ],
  attributions: [
    {
      entityId: "user:alice",
      role: "creator",
      resourceRef: { ref: "bafybeia...msg1" },
    },
    {
      entityId: "app:chat-service",
      role: "creator",
      resourceRef: { ref: "bafybei...reply1" },
    },
  ],
  summary: {
    actions: 4,
    resources: 2,
    entities: 2,
    attributions: 2,
  },
};
