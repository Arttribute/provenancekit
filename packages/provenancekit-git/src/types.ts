/**
 * Core types for @provenancekit/git
 *
 * @packageDocumentation
 */

import { z } from "zod";
import type { Action, Attribution, Entity, ContentReference } from "@arttribute/eaa-types";
import type { Distribution } from "@provenancekit/extensions";

/*─────────────────────────────────────────────────────────────*\
 | Git Extension Schema                                         |
\*─────────────────────────────────────────────────────────────*/

/**
 * Namespace for git extension.
 * @example "ext:git@1.0.0"
 */
export const GIT_NAMESPACE = "ext:git@1.0.0" as const;

/**
 * AI assistance detection result.
 */
export const AIAssistance = z.object({
  /** Detected AI tool/provider */
  tool: z.string(),

  /** Confidence level 0-1 */
  confidence: z.number().min(0).max(1),

  /** Indicators that triggered detection */
  indicators: z.array(z.string()),

  /** Model identifier if detected */
  model: z.string().optional(),
});

export type AIAssistance = z.infer<typeof AIAssistance>;

/**
 * Commit signature verification.
 */
export const CommitSignature = z.object({
  /** Signature type */
  type: z.enum(["gpg", "ssh", "x509"]),

  /** Whether signature was verified */
  verified: z.boolean(),

  /** Signer identifier (email or key fingerprint) */
  signer: z.string().optional(),

  /** Key ID used for signing */
  keyId: z.string().optional(),
});

export type CommitSignature = z.infer<typeof CommitSignature>;

/**
 * Git extension schema for commit provenance.
 *
 * Attached to Action representing a git commit.
 *
 * @example
 * ```typescript
 * const action = withGitCommit(act, {
 *   repository: "github.com/org/repo",
 *   branch: "main",
 *   commit: "abc123",
 *   message: "feat: add new feature",
 *   filesChanged: 5,
 *   linesAdded: 100,
 *   linesRemoved: 20,
 * });
 * ```
 */
export const GitExtension = z.object({
  /** Repository identifier (e.g., "github.com/org/repo") */
  repository: z.string(),

  /** Branch name */
  branch: z.string(),

  /** Commit SHA */
  commit: z.string(),

  /** Commit message (first line or full) */
  message: z.string(),

  /** Parent commit SHA(s) */
  parents: z.array(z.string()).optional(),

  /** Number of files changed */
  filesChanged: z.number().int().min(0),

  /** Lines added */
  linesAdded: z.number().int().min(0),

  /** Lines removed */
  linesRemoved: z.number().int().min(0),

  /** AI assistance detected */
  aiAssisted: AIAssistance.optional(),

  /** Commit signature verification */
  signature: CommitSignature.optional(),

  /** Commit author info */
  author: z
    .object({
      name: z.string(),
      email: z.string(),
      timestamp: z.string().datetime(),
    })
    .optional(),

  /** Commit committer info (if different from author) */
  committer: z
    .object({
      name: z.string(),
      email: z.string(),
      timestamp: z.string().datetime(),
    })
    .optional(),

  /** Tags pointing to this commit */
  tags: z.array(z.string()).optional(),
});

export type GitExtension = z.infer<typeof GitExtension>;

/*─────────────────────────────────────────────────────────────*\
 | Blame Analysis Types                                         |
\*─────────────────────────────────────────────────────────────*/

/**
 * A single line's blame information.
 */
export interface BlameLine {
  /** Line number (1-indexed) */
  lineNumber: number;

  /** Commit SHA that last modified this line */
  commit: string;

  /** Author name */
  author: string;

  /** Author email */
  authorEmail: string;

  /** Timestamp of the commit */
  timestamp: Date;

  /** Line content */
  content: string;
}

/**
 * Blame information for a file.
 */
export interface FileBlame {
  /** File path relative to repository root */
  path: string;

  /** Total lines in file */
  totalLines: number;

  /** Lines by author */
  linesByAuthor: Map<string, number>;

  /** Detailed line information */
  lines: BlameLine[];
}

/**
 * Author contribution statistics.
 */
export interface AuthorContribution {
  /** Author identifier (email) */
  email: string;

  /** Author name (most recent) */
  name: string;

  /** Total lines authored across all files */
  linesAuthored: number;

  /** Number of files contributed to */
  filesContributed: number;

  /** Percentage of total codebase */
  percentage: number;

  /** Commits by this author */
  commits: number;
}

/**
 * Complete blame analysis result.
 */
export interface BlameAnalysis {
  /** Repository path */
  repoPath: string;

  /** Branch analyzed */
  branch: string;

  /** Commit SHA analyzed */
  commitSha: string;

  /** Analysis timestamp */
  analyzedAt: Date;

  /** Per-file blame information */
  files: Map<string, FileBlame>;

  /** Aggregated by author */
  byAuthor: Map<string, AuthorContribution>;

  /** Total lines analyzed */
  totalLines: number;

  /** Total files analyzed */
  totalFiles: number;

  /**
   * Convert to distribution format for payment calculations.
   * Maps author emails to entity IDs for distribution.
   *
   * @param authorToEntity - Map author email to entity ID
   * @param resourceRef - Resource reference for the distribution
   */
  toDistribution(
    authorToEntity: Map<string, string> | ((email: string) => string),
    resourceRef: ContentReference
  ): Distribution;
}

/**
 * Options for blame analysis.
 */
export interface BlameAnalysisOptions {
  /** Branch to analyze (default: current branch) */
  branch?: string;

  /** Filter to specific paths (globs supported) */
  paths?: string[];

  /** Only consider commits since this date */
  since?: Date;

  /** Only consider commits until this date */
  until?: Date;

  /** Ignore patterns for files (e.g., generated files) */
  ignorePatterns?: string[];

  /** Whether to include binary files */
  includeBinary?: boolean;

  /** Maximum files to analyze (for performance) */
  maxFiles?: number;

  /** Follow renames/copies */
  followRenames?: boolean;
}

/*─────────────────────────────────────────────────────────────*\
 | Commit Tracking Types                                        |
\*─────────────────────────────────────────────────────────────*/

/**
 * Raw commit information from git.
 */
export interface CommitInfo {
  /** Commit SHA */
  sha: string;

  /** Commit message */
  message: string;

  /** Author name */
  authorName: string;

  /** Author email */
  authorEmail: string;

  /** Author date */
  authorDate: Date;

  /** Committer name */
  committerName: string;

  /** Committer email */
  committerEmail: string;

  /** Committer date */
  committerDate: Date;

  /** Parent commit SHAs */
  parents: string[];

  /** Branch name */
  branch: string;

  /** Repository path */
  repoPath: string;

  /** File statistics */
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };

  /** GPG/SSH signature status */
  signature?: {
    type: "gpg" | "ssh" | "x509";
    verified: boolean;
    signer?: string;
    keyId?: string;
  };

  /** Files changed in this commit */
  files: CommitFile[];
}

/**
 * File changed in a commit.
 */
export interface CommitFile {
  /** File path */
  path: string;

  /** Change type */
  status: "added" | "modified" | "deleted" | "renamed" | "copied";

  /** Previous path (for renames) */
  previousPath?: string;

  /** Lines added */
  additions: number;

  /** Lines deleted */
  deletions: number;
}

/**
 * Result of recording a commit as provenance.
 */
export interface RecordCommitResult {
  /** The action representing the commit */
  action: Action;

  /** Attributions for the commit */
  attributions: Attribution[];

  /** Entity for the author */
  authorEntity: Entity;

  /** Entity for AI tool (if detected) */
  aiEntity?: Entity;

  /** Git extension data */
  gitExtension: GitExtension;
}

/**
 * Options for recording a commit.
 */
export interface RecordCommitOptions {
  /** Repository path (default: cwd) */
  repoPath?: string;

  /** Commit SHA to record (default: HEAD) */
  commitSha?: string;

  /** Whether to detect AI assistance */
  detectAI?: boolean;

  /** Custom entity ID for the author */
  authorEntityId?: string;

  /** Custom resource reference for the commit output */
  resourceRef?: ContentReference;

  /** Include file-level attributions */
  includeFileAttributions?: boolean;
}

/*─────────────────────────────────────────────────────────────*\
 | Git Hook Types                                               |
\*─────────────────────────────────────────────────────────────*/

/**
 * Git hook types supported.
 */
export type GitHookType =
  | "pre-commit"
  | "prepare-commit-msg"
  | "commit-msg"
  | "post-commit"
  | "pre-push";

/**
 * Configuration for git hook generation.
 */
export interface GitHookConfig {
  /** Hook type to generate */
  hookType: GitHookType;

  /** URL to send provenance data to */
  storageUrl?: string;

  /** Contract address for on-chain registration */
  contractAddress?: string;

  /** Chain ID for on-chain registration */
  chainId?: number;

  /** Enable AI detection */
  aiDetection?: boolean;

  /** Custom script to run after provenance recording */
  postScript?: string;

  /** Environment variables to set */
  envVars?: Record<string, string>;
}

/**
 * Result of hook generation.
 */
export interface GeneratedHook {
  /** Hook type */
  hookType: GitHookType;

  /** Script content */
  script: string;

  /** Installation path */
  installPath: string;
}

/*─────────────────────────────────────────────────────────────*\
 | GitHub Integration Types                                     |
\*─────────────────────────────────────────────────────────────*/

/**
 * GitHub repository reference.
 */
export interface GitHubRepo {
  owner: string;
  repo: string;
}

/**
 * GitHub pull request information.
 */
export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  merged: boolean;
  author: string;
  createdAt: Date;
  updatedAt: Date;
  mergedAt: Date | null;
  mergedBy: string | null;
  baseBranch: string;
  headBranch: string;
  commits: number;
  additions: number;
  deletions: number;
  changedFiles: number;
}

/**
 * GitHub review information.
 */
export interface GitHubReview {
  id: number;
  author: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "PENDING" | "DISMISSED";
  body: string | null;
  submittedAt: Date;
  commitId: string;
}

/**
 * Result of fetching PR provenance.
 */
export interface PRProvenanceResult {
  /** Action representing the PR merge */
  action: Action;

  /** Attributions for all contributors */
  attributions: Attribution[];

  /** Entities involved */
  entities: Entity[];

  /** Pull request data */
  pullRequest: GitHubPullRequest;

  /** Reviews */
  reviews: GitHubReview[];
}

/*─────────────────────────────────────────────────────────────*\
 | Error Types                                                  |
\*─────────────────────────────────────────────────────────────*/

/**
 * Error codes for git operations.
 */
export type GitErrorCode =
  | "NOT_A_REPOSITORY"
  | "COMMIT_NOT_FOUND"
  | "BRANCH_NOT_FOUND"
  | "FILE_NOT_FOUND"
  | "GIT_COMMAND_FAILED"
  | "PARSE_ERROR"
  | "GITHUB_API_ERROR"
  | "INVALID_OPTIONS";

/**
 * Error thrown by git operations.
 */
export class GitError extends Error {
  constructor(
    message: string,
    public readonly code: GitErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "GitError";
  }
}
