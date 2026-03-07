import type { ProvenanceBundle, GraphNode, GraphEdge, SessionProvenance } from "@provenancekit/sdk";

// ── Mock ProvenanceBundle ──────────────────────────────────────────────────
export const mockBundle: ProvenanceBundle = {
  entities: [
    {
      id: "user:alice",
      role: "human",
      name: "Alice Chen",
      createdAt: "2026-03-01T10:00:00Z",
    },
    {
      id: "app:poetry-service",
      role: "organization",
      name: "Poetry Service",
      createdAt: "2026-03-01T10:00:00Z",
    },
  ],
  actions: [
    {
      id: "action-001",
      type: "create",
      entityId: "user:alice",
      timestamp: "2026-03-07T14:22:00Z",
      extensions: {},
    },
    {
      id: "action-002",
      type: "create",
      entityId: "app:poetry-service",
      timestamp: "2026-03-07T14:23:00Z",
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
      address: { ref: "bafybeia...prompt", "@type": "ResourceAddress" },
      resourceType: "text",
      name: "prompt.txt",
      createdAt: "2026-03-07T14:22:00Z",
    },
    {
      address: { ref: "bafybei...poem", "@type": "ResourceAddress" },
      resourceType: "text",
      name: "poem.txt",
      createdAt: "2026-03-07T14:23:10Z",
    },
  ],
  attributions: [
    {
      entityId: "user:alice",
      weight: 7000,
    },
    {
      entityId: "app:poetry-service",
      weight: 3000,
    },
  ],
  rootCid: "bafybei...poem",
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
    data: { resourceType: "text", cid: "bafybeia...prompt" },
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
    data: { resourceType: "text", cid: "bafybei...poem" },
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
      entityId: "user:alice",
      timestamp: "2026-03-07T14:20:00Z",
      extensions: {},
    },
    {
      id: "act-002",
      type: "create",
      entityId: "app:chat-service",
      timestamp: "2026-03-07T14:20:05Z",
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
      entityId: "user:alice",
      timestamp: "2026-03-07T14:21:10Z",
      extensions: {},
    },
    {
      id: "act-004",
      type: "create",
      entityId: "app:chat-service",
      timestamp: "2026-03-07T14:21:18Z",
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
      address: { ref: "bafybeia...msg1", "@type": "ResourceAddress" },
      resourceType: "text",
      createdAt: "2026-03-07T14:20:00Z",
    },
    {
      address: { ref: "bafybei...reply1", "@type": "ResourceAddress" },
      resourceType: "text",
      createdAt: "2026-03-07T14:20:05Z",
    },
  ],
  entities: [
    { id: "user:alice", role: "human", name: "Alice" },
    { id: "app:chat-service", role: "organization", name: "Chat Service" },
  ],
  startedAt: "2026-03-07T14:20:00Z",
  lastActionAt: "2026-03-07T14:21:18Z",
};
