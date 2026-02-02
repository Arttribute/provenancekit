/**
 * Commit tracking for provenance creation.
 *
 * Converts git commits into EAA provenance records (Actions, Attributions, Entities).
 *
 * @packageDocumentation
 */

import type { SimpleGit, DefaultLogFields, ListLogLine } from "simple-git";
import simpleGit from "simple-git";
import type { Attribution, Entity, ContentReference } from "@arttribute/eaa-types";
import { withContrib } from "@provenancekit/extensions";
import type {
  CommitInfo,
  CommitFile,
  RecordCommitResult,
  RecordCommitOptions,
  GitExtension,
} from "../types.js";
import { GitError } from "../types.js";
import { createCommitAction, normalizeRepositoryUrl } from "../extension.js";
import { detectAIAssistance, toAIAssistance } from "../ai/detector.js";

/*─────────────────────────────────────────────────────────────*\
 | Commit Info Retrieval                                        |
\*─────────────────────────────────────────────────────────────*/

/**
 * Get information about a specific commit.
 *
 * @param repoPath - Path to the repository
 * @param commitSha - Commit SHA (default: HEAD)
 * @returns Commit information
 *
 * @example
 * ```typescript
 * const commit = await getCommitInfo("/path/to/repo", "abc123");
 * console.log(`${commit.authorName}: ${commit.message}`);
 * ```
 */
export async function getCommitInfo(
  repoPath: string,
  commitSha = "HEAD"
): Promise<CommitInfo> {
  const git: SimpleGit = simpleGit(repoPath);

  // Verify this is a git repository
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new GitError(`Not a git repository: ${repoPath}`, "NOT_A_REPOSITORY", {
      repoPath,
    });
  }

  // Get commit details
  let logResult;
  try {
    logResult = await git.log({
      maxCount: 1,
      from: commitSha,
      to: commitSha,
      format: {
        hash: "%H",
        message: "%B",
        authorName: "%an",
        authorEmail: "%ae",
        authorDate: "%aI",
        committerName: "%cn",
        committerEmail: "%ce",
        committerDate: "%cI",
        parents: "%P",
      },
    });
  } catch {
    throw new GitError(`Commit not found: ${commitSha}`, "COMMIT_NOT_FOUND", {
      commitSha,
    });
  }

  const commit = logResult.latest as DefaultLogFields & ListLogLine & {
    hash: string;
    message: string;
    authorName: string;
    authorEmail: string;
    authorDate: string;
    committerName: string;
    committerEmail: string;
    committerDate: string;
    parents: string;
  };

  if (!commit) {
    throw new GitError(`Commit not found: ${commitSha}`, "COMMIT_NOT_FOUND", {
      commitSha,
    });
  }

  // Get current branch
  let branch: string;
  try {
    branch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
  } catch {
    branch = "detached";
  }

  // Get diff stats
  let stats = { filesChanged: 0, insertions: 0, deletions: 0 };
  let files: CommitFile[] = [];

  try {
    // Parse numstat output
    const numstatOutput = await git.raw([
      "diff-tree",
      "--no-commit-id",
      "--numstat",
      "-r",
      commit.hash,
    ]);

    const numstatLines = numstatOutput.trim().split("\n").filter(Boolean);
    const fileMap = new Map<
      string,
      { additions: number; deletions: number }
    >();

    for (const line of numstatLines) {
      const parts = line.split("\t");
      if (parts.length >= 3) {
        const additions = parts[0] === "-" ? 0 : parseInt(parts[0], 10);
        const deletions = parts[1] === "-" ? 0 : parseInt(parts[1], 10);
        const path = parts.slice(2).join("\t"); // Handle paths with tabs

        fileMap.set(path, { additions, deletions });
        stats.insertions += additions;
        stats.deletions += deletions;
      }
    }

    // Get name-status for change types
    const nameStatusOutput = await git.raw([
      "diff-tree",
      "--no-commit-id",
      "--name-status",
      "-r",
      commit.hash,
    ]);

    const statusLines = nameStatusOutput.trim().split("\n").filter(Boolean);

    for (const line of statusLines) {
      const parts = line.split("\t");
      if (parts.length >= 2) {
        const statusCode = parts[0].charAt(0);
        const path = parts[parts.length - 1];
        const previousPath = parts.length > 2 ? parts[1] : undefined;

        let status: CommitFile["status"];
        switch (statusCode) {
          case "A":
            status = "added";
            break;
          case "D":
            status = "deleted";
            break;
          case "M":
            status = "modified";
            break;
          case "R":
            status = "renamed";
            break;
          case "C":
            status = "copied";
            break;
          default:
            status = "modified";
        }

        const numstat = fileMap.get(path) ?? { additions: 0, deletions: 0 };

        files.push({
          path,
          status,
          previousPath: status === "renamed" || status === "copied" ? previousPath : undefined,
          additions: numstat.additions,
          deletions: numstat.deletions,
        });
      }
    }

    stats.filesChanged = files.length;
  } catch {
    // Ignore diff errors (might be initial commit)
  }

  // Get signature info
  let signature: CommitInfo["signature"];
  try {
    const sigOutput = await git.raw([
      "log",
      "-1",
      "--format=%G?%n%GK%n%GS",
      commit.hash,
    ]);
    const sigLines = sigOutput.trim().split("\n");
    const sigStatus = sigLines[0];

    if (sigStatus && sigStatus !== "N") {
      signature = {
        type: sigStatus === "E" || sigStatus === "X" || sigStatus === "Y" ? "gpg" : "ssh",
        verified: sigStatus === "G" || sigStatus === "U",
        keyId: sigLines[1] || undefined,
        signer: sigLines[2] || undefined,
      };
    }
  } catch {
    // Signature check failed, ignore
  }

  // Get remote URL for repository identifier
  let remoteUrl = "";
  try {
    remoteUrl = (await git.getRemotes(true))[0]?.refs?.fetch ?? "";
  } catch {
    // No remote configured
  }

  return {
    sha: commit.hash,
    message: commit.message.trim(),
    authorName: commit.authorName,
    authorEmail: commit.authorEmail,
    authorDate: new Date(commit.authorDate),
    committerName: commit.committerName,
    committerEmail: commit.committerEmail,
    committerDate: new Date(commit.committerDate),
    parents: commit.parents ? commit.parents.split(" ").filter(Boolean) : [],
    branch,
    repoPath: remoteUrl ? normalizeRepositoryUrl(remoteUrl) : repoPath,
    stats,
    signature,
    files,
  };
}

/**
 * Get commit history.
 *
 * @param repoPath - Path to the repository
 * @param options - Log options
 * @returns Array of commit info
 */
export async function getCommitHistory(
  repoPath: string,
  options: {
    maxCount?: number;
    since?: Date;
    until?: Date;
    author?: string;
    branch?: string;
  } = {}
): Promise<CommitInfo[]> {
  const { maxCount = 100, since, until, author, branch: _branch } = options;

  const git: SimpleGit = simpleGit(repoPath);

  const logOptions: Parameters<typeof git.log>[0] = {
    maxCount,
    format: {
      hash: "%H",
      message: "%B",
      authorName: "%an",
      authorEmail: "%ae",
      authorDate: "%aI",
      committerName: "%cn",
      committerEmail: "%ce",
      committerDate: "%cI",
      parents: "%P",
    },
  };

  if (since) {
    (logOptions as Record<string, unknown>)["--since"] = since.toISOString();
  }
  if (until) {
    (logOptions as Record<string, unknown>)["--until"] = until.toISOString();
  }
  if (author) {
    (logOptions as Record<string, unknown>)["--author"] = author;
  }

  const logResult = await git.log(logOptions);

  // Get full info for each commit
  const commits: CommitInfo[] = [];
  for (const entry of logResult.all) {
    try {
      const info = await getCommitInfo(repoPath, (entry as { hash: string }).hash);
      commits.push(info);
    } catch {
      // Skip commits that fail to load
    }
  }

  return commits;
}

/*─────────────────────────────────────────────────────────────*\
 | Provenance Recording                                         |
\*─────────────────────────────────────────────────────────────*/

/**
 * Record a git commit as provenance.
 *
 * Creates EAA records (Action, Attributions, Entities) from a git commit.
 *
 * @param options - Recording options
 * @returns Provenance records for the commit
 *
 * @example
 * ```typescript
 * const result = await recordCommit({
 *   repoPath: ".",
 *   commitSha: "HEAD",
 *   detectAI: true,
 * });
 *
 * console.log(`Action: ${result.action.id}`);
 * console.log(`Author: ${result.authorEntity.name}`);
 *
 * if (result.aiEntity) {
 *   console.log(`AI assisted by: ${result.gitExtension.aiAssisted?.tool}`);
 * }
 * ```
 */
export async function recordCommit(
  options: RecordCommitOptions = {}
): Promise<RecordCommitResult> {
  const {
    repoPath = process.cwd(),
    commitSha = "HEAD",
    detectAI = true,
    authorEntityId,
    resourceRef,
    includeFileAttributions = false,
  } = options;

  // Get commit information
  const commit = await getCommitInfo(repoPath, commitSha);

  // Compute author entity ID (used directly to avoid type inference issues with Entity.id)
  const computedAuthorEntityId = authorEntityId ?? `mailto:${commit.authorEmail}`;

  // Create entity for the author
  const authorEntity: Entity = {
    id: computedAuthorEntityId,
    name: commit.authorName,
    role: "human",
    metadata: {
      email: commit.authorEmail,
    },
  };

  // Detect AI assistance
  let aiAssistance: GitExtension["aiAssisted"];
  let aiEntity: Entity | undefined;
  let computedAIEntityId: string | undefined;

  if (detectAI) {
    const detection = detectAIAssistance(commit);
    aiAssistance = toAIAssistance(detection);

    if (aiAssistance) {
      computedAIEntityId = `ai:${aiAssistance.tool}`;
      aiEntity = {
        id: computedAIEntityId,
        name: detection.toolInfo?.name ?? aiAssistance.tool,
        role: "ai",
        metadata: {
          provider: detection.toolInfo?.provider,
          model: aiAssistance.model,
        },
      };
    }
  }

  // Create the action
  const actionId = `git:${commit.repoPath}:${commit.sha.slice(0, 12)}`;

  // Create resource reference (if not provided, use commit SHA as content ref)
  const outputRef: ContentReference = resourceRef ?? {
    ref: commit.sha,
    scheme: "ext:git:commit",
  };

  const action = createCommitAction({
    id: actionId,
    performedBy: computedAuthorEntityId,
    timestamp: commit.authorDate.toISOString(),
    repository: commit.repoPath,
    branch: commit.branch,
    commit: commit.sha,
    message: commit.message.split("\n")[0], // First line
    parents: commit.parents,
    filesChanged: commit.stats.filesChanged,
    linesAdded: commit.stats.insertions,
    linesRemoved: commit.stats.deletions,
    aiAssisted: aiAssistance,
    signature: commit.signature,
    author: {
      name: commit.authorName,
      email: commit.authorEmail,
      timestamp: commit.authorDate.toISOString(),
    },
    committer:
      commit.committerEmail !== commit.authorEmail
        ? {
            name: commit.committerName,
            email: commit.committerEmail,
            timestamp: commit.committerDate.toISOString(),
          }
        : undefined,
  });

  // Set outputs
  (action as { outputs: ContentReference[] }).outputs = [outputRef];

  // Create attributions
  const attributions: Attribution[] = [];

  // Main author attribution
  const authorAttribution: Attribution = {
    entityId: computedAuthorEntityId,
    role: "creator",
    actionId,
    resourceRef: outputRef,
    note: `Committed ${commit.stats.filesChanged} files (+${commit.stats.insertions}/-${commit.stats.deletions})`,
  };

  // Add contribution weight (100% for single author commits)
  const weightedAuthorAttribution = withContrib(authorAttribution, {
    weight: aiAssistance ? 8000 : 10000, // 80% if AI assisted, 100% otherwise
    basis: "points",
    source: "calculated",
    category: "code",
  });
  attributions.push(weightedAuthorAttribution);

  // Add AI attribution if detected
  if (aiEntity && aiAssistance && computedAIEntityId) {
    const aiAttribution: Attribution = {
      entityId: computedAIEntityId,
      role: "contributor",
      actionId,
      resourceRef: outputRef,
      note: `AI assistance detected (${aiAssistance.tool}, confidence: ${(aiAssistance.confidence * 100).toFixed(0)}%)`,
    };

    const weightedAIAttribution = withContrib(aiAttribution, {
      weight: 2000, // 20% for AI assistance
      basis: "points",
      source: "calculated",
      category: "ai-assistance",
    });
    attributions.push(weightedAIAttribution);
  }

  // Optionally add per-file attributions
  if (includeFileAttributions) {
    for (const file of commit.files) {
      const fileAttribution: Attribution = {
        entityId: computedAuthorEntityId,
        role: "contributor",
        actionId,
        note: `${file.status} ${file.path} (+${file.additions}/-${file.deletions})`,
      };
      attributions.push(fileAttribution);
    }
  }

  // Build git extension data
  const gitExtension: GitExtension = {
    repository: commit.repoPath,
    branch: commit.branch,
    commit: commit.sha,
    message: commit.message.split("\n")[0],
    parents: commit.parents,
    filesChanged: commit.stats.filesChanged,
    linesAdded: commit.stats.insertions,
    linesRemoved: commit.stats.deletions,
    aiAssisted: aiAssistance,
    signature: commit.signature,
    author: {
      name: commit.authorName,
      email: commit.authorEmail,
      timestamp: commit.authorDate.toISOString(),
    },
    committer:
      commit.committerEmail !== commit.authorEmail
        ? {
            name: commit.committerName,
            email: commit.committerEmail,
            timestamp: commit.committerDate.toISOString(),
          }
        : undefined,
  };

  return {
    action,
    attributions,
    authorEntity,
    aiEntity,
    gitExtension,
  };
}

/**
 * Record multiple commits as provenance.
 *
 * @param repoPath - Path to the repository
 * @param commitShas - Array of commit SHAs to record
 * @param options - Recording options
 * @returns Array of provenance results
 */
export async function recordCommits(
  repoPath: string,
  commitShas: string[],
  options: Omit<RecordCommitOptions, "repoPath" | "commitSha"> = {}
): Promise<RecordCommitResult[]> {
  const results: RecordCommitResult[] = [];

  for (const sha of commitShas) {
    try {
      const result = await recordCommit({
        ...options,
        repoPath,
        commitSha: sha,
      });
      results.push(result);
    } catch {
      // Skip commits that fail to record
    }
  }

  return results;
}

