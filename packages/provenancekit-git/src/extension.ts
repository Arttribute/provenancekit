/**
 * Git extension (ext:git@1.0.0) for ProvenanceKit.
 *
 * Provides type-safe helpers for attaching git commit metadata
 * to EAA Action objects.
 *
 * @packageDocumentation
 */

import { z } from "zod";
import type { Action } from "@provenancekit/eaa-types";
import {
  GIT_NAMESPACE,
  GitExtension,
  AIAssistance,
  CommitSignature,
} from "./types.js";

export { GIT_NAMESPACE, GitExtension, AIAssistance, CommitSignature };

/*─────────────────────────────────────────────────────────────*\
 | Helper Functions                                             |
\*─────────────────────────────────────────────────────────────*/

/**
 * Add git commit extension to an action.
 *
 * @param action - The action to extend
 * @param git - Git commit data
 * @returns Action with git extension
 *
 * @example
 * ```typescript
 * const action = withGitCommit(act, {
 *   repository: "github.com/org/repo",
 *   branch: "main",
 *   commit: "abc123def456",
 *   message: "feat: add new feature",
 *   filesChanged: 5,
 *   linesAdded: 100,
 *   linesRemoved: 20,
 * });
 * ```
 */
export function withGitCommit(
  action: Action,
  git: z.input<typeof GitExtension>
): Action {
  const validated = GitExtension.parse(git);
  return {
    ...action,
    extensions: {
      ...action.extensions,
      [GIT_NAMESPACE]: validated,
    },
  };
}

/**
 * Get git commit extension from an action.
 *
 * @param action - The action to read from
 * @returns Git extension data or undefined if not present
 */
export function getGitCommit(action: Action): GitExtension | undefined {
  const data = action.extensions?.[GIT_NAMESPACE];
  if (!data) return undefined;
  return GitExtension.parse(data);
}

/**
 * Check if an action has git commit extension.
 *
 * @param action - The action to check
 * @returns True if git extension exists
 */
export function hasGitCommit(action: Action): boolean {
  return action.extensions?.[GIT_NAMESPACE] !== undefined;
}

/**
 * Get the commit SHA from an action's git extension.
 *
 * @param action - The action to read from
 * @returns Commit SHA or undefined
 */
export function getCommitSha(action: Action): string | undefined {
  return getGitCommit(action)?.commit;
}

/**
 * Get the repository identifier from an action's git extension.
 *
 * @param action - The action to read from
 * @returns Repository identifier or undefined
 */
export function getRepository(action: Action): string | undefined {
  return getGitCommit(action)?.repository;
}

/**
 * Check if an action's commit had AI assistance.
 *
 * @param action - The action to check
 * @returns True if AI assistance was detected
 */
export function hasAIAssistance(action: Action): boolean {
  return getGitCommit(action)?.aiAssisted !== undefined;
}

/**
 * Get AI assistance details from an action.
 *
 * @param action - The action to read from
 * @returns AI assistance data or undefined
 */
export function getAIAssistance(action: Action): AIAssistance | undefined {
  return getGitCommit(action)?.aiAssisted;
}

/**
 * Check if an action's commit was signed.
 *
 * @param action - The action to check
 * @returns True if commit was signed
 */
export function isSigned(action: Action): boolean {
  return getGitCommit(action)?.signature !== undefined;
}

/**
 * Check if an action's commit signature was verified.
 *
 * @param action - The action to check
 * @returns True if signature was verified
 */
export function isSignatureVerified(action: Action): boolean {
  return getGitCommit(action)?.signature?.verified === true;
}

/**
 * Get commit statistics (files changed, lines added/removed).
 *
 * @param action - The action to read from
 * @returns Commit statistics or undefined
 */
export function getCommitStats(
  action: Action
): { filesChanged: number; linesAdded: number; linesRemoved: number } | undefined {
  const git = getGitCommit(action);
  if (!git) return undefined;
  return {
    filesChanged: git.filesChanged,
    linesAdded: git.linesAdded,
    linesRemoved: git.linesRemoved,
  };
}

/**
 * Add AI assistance to an existing git commit extension.
 *
 * @param action - The action with git extension
 * @param aiAssisted - AI assistance data
 * @returns Action with updated git extension
 * @throws Error if action doesn't have git extension
 */
export function withAIAssistance(
  action: Action,
  aiAssisted: z.input<typeof AIAssistance>
): Action {
  const existing = getGitCommit(action);
  if (!existing) {
    throw new Error("Action does not have a git extension. Use withGitCommit first.");
  }

  const validated = AIAssistance.parse(aiAssisted);
  return withGitCommit(action, {
    ...existing,
    aiAssisted: validated,
  });
}

/**
 * Add signature verification to an existing git commit extension.
 *
 * @param action - The action with git extension
 * @param signature - Signature data
 * @returns Action with updated git extension
 * @throws Error if action doesn't have git extension
 */
export function withSignature(
  action: Action,
  signature: z.input<typeof CommitSignature>
): Action {
  const existing = getGitCommit(action);
  if (!existing) {
    throw new Error("Action does not have a git extension. Use withGitCommit first.");
  }

  const validated = CommitSignature.parse(signature);
  return withGitCommit(action, {
    ...existing,
    signature: validated,
  });
}

/*─────────────────────────────────────────────────────────────*\
 | Factory Functions                                            |
\*─────────────────────────────────────────────────────────────*/

/**
 * Create an action representing a git commit.
 *
 * @param params - Commit parameters
 * @returns A new Action with git extension
 *
 * @example
 * ```typescript
 * const action = createCommitAction({
 *   id: "action-123",
 *   performedBy: "did:key:alice",
 *   repository: "github.com/org/repo",
 *   branch: "main",
 *   commit: "abc123",
 *   message: "feat: add feature",
 *   filesChanged: 3,
 *   linesAdded: 50,
 *   linesRemoved: 10,
 * });
 * ```
 */
export function createCommitAction(params: {
  id: string;
  performedBy: string;
  timestamp?: string;
  repository: string;
  branch: string;
  commit: string;
  message: string;
  parents?: string[];
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  aiAssisted?: z.input<typeof AIAssistance>;
  signature?: z.input<typeof CommitSignature>;
  author?: { name: string; email: string; timestamp: string };
  committer?: { name: string; email: string; timestamp: string };
}): Action {
  const baseAction: Action = {
    id: params.id,
    type: "ext:git:commit",
    performedBy: params.performedBy,
    timestamp: params.timestamp ?? new Date().toISOString(),
    inputs: [],
    outputs: [],
  };

  return withGitCommit(baseAction, {
    repository: params.repository,
    branch: params.branch,
    commit: params.commit,
    message: params.message,
    parents: params.parents,
    filesChanged: params.filesChanged,
    linesAdded: params.linesAdded,
    linesRemoved: params.linesRemoved,
    aiAssisted: params.aiAssisted,
    signature: params.signature,
    author: params.author,
    committer: params.committer,
  });
}

/**
 * Parse a repository URL into a normalized identifier.
 *
 * Handles various git URL formats:
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - github.com/owner/repo
 *
 * @param url - Repository URL or path
 * @returns Normalized repository identifier (e.g., "github.com/owner/repo")
 */
export function normalizeRepositoryUrl(url: string): string {
  // Remove trailing .git
  let normalized = url.replace(/\.git$/, "");

  // Handle SSH URLs (git@github.com:owner/repo)
  const sshMatch = normalized.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`;
  }

  // Handle HTTPS URLs
  const httpsMatch = normalized.match(/^https?:\/\/(.+)$/);
  if (httpsMatch) {
    return httpsMatch[1];
  }

  // Already normalized or local path
  return normalized;
}

/**
 * Extract owner and repo from a repository identifier.
 *
 * @param repository - Repository identifier (e.g., "github.com/owner/repo")
 * @returns Owner and repo, or undefined if format is invalid
 */
export function parseRepositoryId(
  repository: string
): { host: string; owner: string; repo: string } | undefined {
  const parts = repository.split("/");
  if (parts.length < 3) return undefined;

  return {
    host: parts[0],
    owner: parts[1],
    repo: parts.slice(2).join("/"),
  };
}
