import type { ProvenanceBundle, GraphNode, GraphEdge, SessionProvenance } from "@provenancekit/sdk";

/**
 * Scenario: "The Illustrated Article"
 *
 * Sarah Kim (writer) drafts an article. Illustrated Digest (publisher) runs it
 * through two AI tools — Flux Schnell for a header image and Claude Opus for
 * editorial polish — then their editorial team verifies and publishes it under
 * CC-BY-4.0. The final article carries provenance covering all four contributors.
 */

// ── Mock ProvenanceBundle ──────────────────────────────────────────────────
export const mockBundle: ProvenanceBundle = {
  entities: [
    {
      id: "entity:sarah-kim",
      role: "human",
      name: "Sarah Kim",
    },
    {
      id: "entity:illustrated-digest",
      role: "organization",
      name: "Illustrated Digest",
    },
    {
      id: "entity:claude-opus",
      role: "ai",
      name: "Claude Opus 4.6",
    },
    {
      id: "entity:flux-ai",
      role: "ai",
      name: "Flux Schnell",
    },
  ],
  actions: [
    {
      id: "action:write-draft",
      type: "create",
      performedBy: "entity:sarah-kim",
      timestamp: "2026-03-07T09:15:00Z",
      outputs: [{ ref: "bafybeic3a7draft001" }],
    },
    {
      id: "action:generate-image",
      type: "create",
      performedBy: "entity:illustrated-digest",
      timestamp: "2026-03-07T10:02:00Z",
      inputs: [{ ref: "bafybeic3a7draft001" }],
      outputs: [{ ref: "bafybeiimage002" }],
      extensions: {
        "ext:ai@1.0.0": {
          provider: "black-forest-labs",
          model: "flux-schnell",
          autonomyLevel: "autonomous",
          tokensUsed: 0,
        },
      },
    },
    {
      id: "action:polish-article",
      type: "transform",
      performedBy: "entity:illustrated-digest",
      timestamp: "2026-03-07T10:18:00Z",
      inputs: [{ ref: "bafybeic3a7draft001" }],
      outputs: [{ ref: "bafybeipolished003" }],
      extensions: {
        "ext:ai@1.0.0": {
          provider: "anthropic",
          model: "claude-opus-4-6",
          autonomyLevel: "assistive",
          tokensUsed: 3841,
        },
      },
    },
    {
      id: "action:editorial-review",
      type: "verify",
      performedBy: "entity:illustrated-digest",
      timestamp: "2026-03-07T11:45:00Z",
      inputs: [
        { ref: "bafybeipolished003" },
        { ref: "bafybeiimage002" },
      ],
      outputs: [{ ref: "bafybeifinal004" }],
      extensions: {
        "ext:verification@1.0.0": {
          status: "verified",
          policy: "editorial-review-v2",
          verifiedAt: "2026-03-07T11:45:00Z",
        },
      },
    },
  ],
  resources: [
    {
      address: { ref: "bafybeic3a7draft001" },
      type: "text/markdown",
      locations: [],
      createdAt: "2026-03-07T09:15:00Z",
      createdBy: "entity:sarah-kim",
      rootAction: "action:write-draft",
      extensions: {
        label: "article-draft.md",
      },
    },
    {
      address: { ref: "bafybeiimage002" },
      type: "image/png",
      locations: [],
      createdAt: "2026-03-07T10:02:00Z",
      createdBy: "entity:illustrated-digest",
      rootAction: "action:generate-image",
      extensions: {
        label: "header-image.png",
      },
    },
    {
      address: { ref: "bafybeipolished003" },
      type: "text/markdown",
      locations: [],
      createdAt: "2026-03-07T10:18:00Z",
      createdBy: "entity:illustrated-digest",
      rootAction: "action:polish-article",
      extensions: {
        label: "article-polished.md",
      },
    },
    {
      address: { ref: "bafybeifinal004" },
      type: "text/markdown",
      locations: [],
      createdAt: "2026-03-07T11:45:00Z",
      createdBy: "entity:illustrated-digest",
      rootAction: "action:editorial-review",
      extensions: {
        label: "illustrated-guide-final.md",
        "ext:license@1.0.0": {
          type: "CC-BY-4.0",
          url: "https://creativecommons.org/licenses/by/4.0/",
        },
        "ext:verification@1.0.0": {
          status: "verified",
          policy: "editorial-review-v2",
        },
      },
    },
  ],
  attributions: [
    {
      entityId: "entity:sarah-kim",
      role: "creator",
      resourceRef: { ref: "bafybeifinal004" },
      extensions: {
        "ext:contribution@1.0.0": {
          weight: 65,
          basis: "percentage",
          source: "manual",
          category: "original-content",
        },
      },
    },
    {
      entityId: "entity:illustrated-digest",
      role: "contributor",
      resourceRef: { ref: "bafybeifinal004" },
      extensions: {
        "ext:contribution@1.0.0": {
          weight: 20,
          basis: "percentage",
          source: "manual",
          category: "editorial",
        },
      },
    },
    {
      entityId: "entity:claude-opus",
      role: "contributor",
      resourceRef: { ref: "bafybeifinal004" },
      extensions: {
        "ext:contribution@1.0.0": {
          weight: 10,
          basis: "percentage",
          source: "computed",
          category: "ai-assistance",
        },
      },
    },
    {
      entityId: "entity:flux-ai",
      role: "contributor",
      resourceRef: { ref: "bafybeifinal004" },
      extensions: {
        "ext:contribution@1.0.0": {
          weight: 5,
          basis: "percentage",
          source: "computed",
          category: "image-generation",
        },
      },
    },
  ],
};

// ── Mock Graph (nodes + edges) ─────────────────────────────────────────────
export const mockNodes: GraphNode[] = [
  // Entities
  {
    id: "entity:sarah-kim",
    type: "entity",
    label: "Sarah Kim",
    data: { role: "human", id: "entity:sarah-kim" },
  },
  {
    id: "entity:illustrated-digest",
    type: "entity",
    label: "Illustrated Digest",
    data: { role: "organization", id: "entity:illustrated-digest" },
  },

  // Resources
  {
    id: "resource:draft",
    type: "resource",
    label: "article-draft.md",
    data: { type: "text/markdown", cid: "bafybeic3a7draft001" },
  },
  {
    id: "resource:header-image",
    type: "resource",
    label: "header-image.png",
    data: { type: "image/png", cid: "bafybeiimage002" },
  },
  {
    id: "resource:polished",
    type: "resource",
    label: "article-polished.md",
    data: { type: "text/markdown", cid: "bafybeipolished003" },
  },
  {
    id: "resource:final",
    type: "resource",
    label: "illustrated-guide-final.md",
    data: { type: "text/markdown", cid: "bafybeifinal004" },
  },

  // Actions
  {
    id: "action:write-draft",
    type: "action",
    label: "Write Draft",
    data: {
      type: "create",
      timestamp: "2026-03-07T09:15:00Z",
    },
  },
  {
    id: "action:generate-image",
    type: "action",
    label: "Generate Image",
    data: {
      type: "create",
      timestamp: "2026-03-07T10:02:00Z",
      "ext:ai@1.0.0": {
        provider: "black-forest-labs",
        model: "flux-schnell",
        autonomyLevel: "autonomous",
      },
    },
  },
  {
    id: "action:polish-article",
    type: "action",
    label: "Polish Article",
    data: {
      type: "transform",
      timestamp: "2026-03-07T10:18:00Z",
      "ext:ai@1.0.0": {
        provider: "anthropic",
        model: "claude-opus-4-6",
        autonomyLevel: "assistive",
      },
    },
  },
  {
    id: "action:editorial-review",
    type: "action",
    label: "Editorial Review",
    data: {
      type: "verify",
      timestamp: "2026-03-07T11:45:00Z",
    },
  },
];

export const mockEdges: GraphEdge[] = [
  // Write draft
  { from: "entity:sarah-kim", to: "action:write-draft", type: "performedBy" },
  { from: "action:write-draft", to: "resource:draft", type: "produces" },

  // Generate image
  { from: "resource:draft", to: "action:generate-image", type: "consumes" },
  { from: "entity:illustrated-digest", to: "action:generate-image", type: "performedBy" },
  { from: "action:generate-image", to: "resource:header-image", type: "produces" },

  // Polish article
  { from: "resource:draft", to: "action:polish-article", type: "consumes" },
  { from: "entity:illustrated-digest", to: "action:polish-article", type: "performedBy" },
  { from: "action:polish-article", to: "resource:polished", type: "produces" },

  // Editorial review → publish
  { from: "resource:polished", to: "action:editorial-review", type: "consumes" },
  { from: "resource:header-image", to: "action:editorial-review", type: "consumes" },
  { from: "entity:illustrated-digest", to: "action:editorial-review", type: "performedBy" },
  { from: "action:editorial-review", to: "resource:final", type: "produces" },
];

// ── Mock Session ───────────────────────────────────────────────────────────
// Scenario: A multi-step AI research workflow being tracked live.
// User asks a question → AI synthesises sources → AI drafts a summary →
// AI generates a supporting chart → User requests revisions → AI finalises.
export const mockSession: SessionProvenance = {
  sessionId: "research-session-2026-a1b2c3",
  actions: [
    {
      id: "act:upload-sources",
      type: "create",
      performedBy: "entity:sarah-kim",
      timestamp: "2026-03-07T14:00:00Z",
      outputs: [{ ref: "bafybeisources001" }],
    },
    {
      id: "act:synthesise",
      type: "transform",
      performedBy: "entity:research-assistant",
      timestamp: "2026-03-07T14:00:12Z",
      inputs: [{ ref: "bafybeisources001" }],
      outputs: [{ ref: "bafybeisynth002" }],
      extensions: {
        "ext:ai@1.0.0": {
          provider: "anthropic",
          model: "claude-opus-4-6",
          autonomyLevel: "autonomous",
          tokensUsed: 2104,
        },
      },
    },
    {
      id: "act:draft-summary",
      type: "create",
      performedBy: "entity:research-assistant",
      timestamp: "2026-03-07T14:01:05Z",
      inputs: [{ ref: "bafybeisynth002" }],
      outputs: [{ ref: "bafybeidraft003" }],
      extensions: {
        "ext:ai@1.0.0": {
          provider: "anthropic",
          model: "claude-opus-4-6",
          autonomyLevel: "assistive",
          tokensUsed: 4872,
        },
        "ext:verification@1.0.0": {
          status: "partial",
          policy: "automated-factcheck-v1",
        },
      },
    },
    {
      id: "act:generate-chart",
      type: "create",
      performedBy: "entity:research-assistant",
      timestamp: "2026-03-07T14:02:33Z",
      inputs: [{ ref: "bafybeisynth002" }],
      outputs: [{ ref: "bafybeichart004" }],
      extensions: {
        "ext:ai@1.0.0": {
          provider: "openai",
          model: "gpt-4o",
          autonomyLevel: "autonomous",
          tokensUsed: 812,
        },
      },
    },
    {
      id: "act:revise",
      type: "transform",
      performedBy: "entity:sarah-kim",
      timestamp: "2026-03-07T14:08:00Z",
      inputs: [{ ref: "bafybeidraft003" }],
      outputs: [{ ref: "bafybeirevised005" }],
    },
    {
      id: "act:finalise",
      type: "verify",
      performedBy: "entity:research-assistant",
      timestamp: "2026-03-07T14:09:17Z",
      inputs: [
        { ref: "bafybeirevised005" },
        { ref: "bafybeichart004" },
      ],
      outputs: [{ ref: "bafybeifinalreport006" }],
      extensions: {
        "ext:ai@1.0.0": {
          provider: "anthropic",
          model: "claude-opus-4-6",
          autonomyLevel: "assistive",
          tokensUsed: 1203,
        },
        "ext:verification@1.0.0": {
          status: "verified",
          policy: "human-in-the-loop-v1",
        },
      },
    },
  ],
  resources: [
    {
      address: { ref: "bafybeisources001" },
      type: "application/json",
      locations: [],
      createdAt: "2026-03-07T14:00:00Z",
      createdBy: "entity:sarah-kim",
      rootAction: "act:upload-sources",
    },
    {
      address: { ref: "bafybeisynth002" },
      type: "text/plain",
      locations: [],
      createdAt: "2026-03-07T14:00:12Z",
      createdBy: "entity:research-assistant",
      rootAction: "act:synthesise",
    },
    {
      address: { ref: "bafybeidraft003" },
      type: "text/markdown",
      locations: [],
      createdAt: "2026-03-07T14:01:05Z",
      createdBy: "entity:research-assistant",
      rootAction: "act:draft-summary",
    },
    {
      address: { ref: "bafybeichart004" },
      type: "image/svg+xml",
      locations: [],
      createdAt: "2026-03-07T14:02:33Z",
      createdBy: "entity:research-assistant",
      rootAction: "act:generate-chart",
    },
    {
      address: { ref: "bafybeirevised005" },
      type: "text/markdown",
      locations: [],
      createdAt: "2026-03-07T14:08:00Z",
      createdBy: "entity:sarah-kim",
      rootAction: "act:revise",
    },
    {
      address: { ref: "bafybeifinalreport006" },
      type: "text/markdown",
      locations: [],
      createdAt: "2026-03-07T14:09:17Z",
      createdBy: "entity:research-assistant",
      rootAction: "act:finalise",
    },
  ],
  entities: [
    { id: "entity:sarah-kim", role: "human", name: "Sarah Kim" },
    { id: "entity:research-assistant", role: "ai", name: "Research Assistant" },
  ],
  attributions: [
    {
      entityId: "entity:sarah-kim",
      role: "creator",
      resourceRef: { ref: "bafybeifinalreport006" },
    },
    {
      entityId: "entity:research-assistant",
      role: "contributor",
      resourceRef: { ref: "bafybeifinalreport006" },
    },
  ],
  summary: {
    actions: 6,
    resources: 6,
    entities: 2,
    attributions: 2,
  },
};
