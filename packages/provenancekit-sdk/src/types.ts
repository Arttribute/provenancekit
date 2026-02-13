/* Re‑export the canonical types from eaa-types */
import type { Entity, Resource, Action, Attribution } from "@arttribute/eaa-types";
export type { Entity, Resource, Action, Attribution };

/*───────────────────────────────────────────────────────────*\
 | 1.  Duplicate‑handling helper                              |
\*───────────────────────────────────────────────────────────*/
export interface DuplicateDetails {
  cid: string;
  similarity: number; // 1  for exact, 0.95…0.99 for near‑dup
}

/*───────────────────────────────────────────────────────────*\
 | 2.  Search match                                           |
\*───────────────────────────────────────────────────────────*/
export interface Match {
  cid: string;
  type: string;
  score: number; // cosine similarity 0‑1
}

export interface UploadMatchResult {
  verdict: "auto" | "review" | "no-match";
  matches: Match[];
}

/*───────────────────────────────────────────────────────────*\
 | 3.  Provenance Graph (same shape as API)                   |
\*───────────────────────────────────────────────────────────*/
export type NodeType = "resource" | "action" | "entity";

export interface GraphNode {
  id: string; // "res:{CID}", "act:{UUID}", "ent:{ID}"
  type: NodeType;
  label: string; // short display label
  data: Record<string, any>; // the raw DB row sans embedding
}

export interface GraphEdge {
  from: string;
  to: string;
  type: "produces" | "consumes" | "tool" | "performedBy";
}

export interface ProvenanceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/*───────────────────────────────────────────────────────────*\
 | 4.  Session Provenance                                     |
 |                                                             |
 | Sessions are managed by the consuming application.          |
 | The provenance API links records to a session via           |
 | the sessionId extension on actions and resources.           |
\*───────────────────────────────────────────────────────────*/

export interface SessionProvenance {
  sessionId: string;
  actions: Action[];
  resources: Resource[];
  entities: Entity[];
  attributions: Attribution[];
  summary: {
    actions: number;
    resources: number;
    entities: number;
    attributions: number;
  };
}

/*───────────────────────────────────────────────────────────*\
 | 5.  Provenance Bundle                                      |
\*───────────────────────────────────────────────────────────*/

/**
 * Provenance bundle as returned by the API.
 *
 * This is a relaxed version of the canonical ProvenanceBundle from eaa-types
 * where `context` is optional (may not be set by all API versions).
 * For strict validation, use ProvenanceBundle from @arttribute/eaa-types.
 */
export interface ProvenanceBundle {
  context?: string;
  resources: Resource[];
  actions: Action[];
  entities: Entity[];
  attributions: Attribution[];
  extensions?: Record<string, unknown>;
}

/*───────────────────────────────────────────────────────────*\
 | 6.  Distribution / Payments                                |
\*───────────────────────────────────────────────────────────*/

export interface DistributionEntry {
  entityId: string;
  bps: number;
  percentage: string;
  payment?: {
    address?: string;
    chainId?: number;
  };
}

export interface Distribution {
  resourceRef: { ref: string; scheme: string };
  entries: DistributionEntry[];
  totalBps: number;
  metadata: {
    attributionsProcessed: number;
    attributionsFiltered: number;
    normalized: boolean;
    algorithmVersion: string;
  };
}

export interface DistributionPreviewItem {
  cid: string;
  entries: { entityId: string; bps: number; percentage: string }[];
  totalBps: number;
}

export interface DistributionPreviewResult {
  distributions: DistributionPreviewItem[];
  summary: {
    resourcesProcessed: number;
    uniqueContributors: number;
  };
}

/*───────────────────────────────────────────────────────────*\
 | 7.  Media / C2PA                                           |
\*───────────────────────────────────────────────────────────*/

export interface C2PAAction {
  action: string;
  when?: string;
  softwareAgent?: {
    name: string;
    version?: string;
  };
  digitalSourceType?: string;
}

export interface C2PAIngredient {
  title: string;
  format?: string;
  hash?: string;
  relationship?: "parentOf" | "componentOf" | "inputTo";
}

export interface C2PAManifest {
  manifestLabel: string;
  claimGenerator: string;
  claimGeneratorVersion?: string;
  title?: string;
  format?: string;
  instanceId?: string;
  actions?: C2PAAction[];
  ingredients?: C2PAIngredient[];
  signature?: {
    algorithm: string;
    issuer?: string;
    timestamp?: string;
  };
  validationStatus?: {
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
  };
  aiDisclosure?: {
    isAIGenerated: boolean;
    aiTool?: string;
    trainingDataUsed?: boolean;
  };
  creativeWork?: {
    author?: string[];
    dateCreated?: string;
    copyright?: string;
  };
}

export interface MediaReadResult {
  hasManifest: boolean;
  message?: string;
  c2pa?: C2PAManifest;
  resource?: Resource;
  actions?: Action[];
  entities?: Entity[];
  attributions?: Attribution[];
  isAIGenerated?: boolean;
  validationStatus?: {
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
  };
}

export interface MediaVerifyResult {
  verified: boolean;
  signature?: {
    algorithm?: string;
    issuer?: string;
    timestamp?: string;
  };
  issuer?: string;
  signedAt?: string;
  errors?: string[];
  warnings?: string[];
  error?: string;
}

export interface MediaImportResult {
  success: boolean;
  cid: string;
  imported: {
    entities: number;
    actions: number;
    resource: number;
    attributions: number;
  };
  c2pa?: {
    title?: string;
    isAIGenerated?: boolean;
    creator?: string[];
  };
}

export interface AICheckResult {
  hasC2PA: boolean;
  isAIGenerated: boolean | null;
  message?: string;
  aiTool?: string;
  disclosure?: {
    isAIGenerated?: boolean;
    aiTool?: string;
    trainingDataUsed?: boolean;
  };
}

export interface SupportedFormat {
  mimeType: string;
  extensions: string[];
  canRead: boolean;
  canWrite: boolean;
}

/*───────────────────────────────────────────────────────────*\
 | 8.  Text Search                                            |
\*───────────────────────────────────────────────────────────*/

export interface TextSearchResult {
  matches: Match[];
}
