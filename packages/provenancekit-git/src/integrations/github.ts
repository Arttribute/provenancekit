/**
 * GitHub integration for ProvenanceKit.
 *
 * Provides tools for tracking GitHub pull requests, reviews,
 * and issues as provenance records.
 *
 * @packageDocumentation
 */

import type { Action, Attribution, Entity, ContentReference } from "@provenancekit/eaa-types";
import { withContrib } from "@provenancekit/extensions";
import type {
  GitHubRepo,
  GitHubPullRequest,
  GitHubReview,
  PRProvenanceResult,
} from "../types.js";
import { GitError } from "../types.js";

/*─────────────────────────────────────────────────────────────*\
 | Types                                                        |
\*─────────────────────────────────────────────────────────────*/

/**
 * GitHub API client interface.
 * Compatible with @octokit/rest.
 */
export interface GitHubClient {
  pulls: {
    get(params: {
      owner: string;
      repo: string;
      pull_number: number;
    }): Promise<{ data: GitHubPullRequestData }>;

    listCommits(params: {
      owner: string;
      repo: string;
      pull_number: number;
      per_page?: number;
    }): Promise<{ data: GitHubCommitData[] }>;

    listReviews(params: {
      owner: string;
      repo: string;
      pull_number: number;
    }): Promise<{ data: GitHubReviewData[] }>;
  };

  repos: {
    getCommit(params: {
      owner: string;
      repo: string;
      ref: string;
    }): Promise<{ data: GitHubCommitData }>;
  };
}

interface GitHubPullRequestData {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  merged: boolean;
  user: { login: string } | null;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  merged_by: { login: string } | null;
  base: { ref: string };
  head: { ref: string };
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
}

interface GitHubCommitData {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string } | null;
    committer: { name: string; email: string; date: string } | null;
  };
  author: { login: string } | null;
  stats?: { additions: number; deletions: number; total: number };
}

interface GitHubReviewData {
  id: number;
  user: { login: string } | null;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "PENDING" | "DISMISSED";
  body: string | null;
  submitted_at: string;
  commit_id: string;
}

/*─────────────────────────────────────────────────────────────*\
 | GitHub API Helpers                                           |
\*─────────────────────────────────────────────────────────────*/

/**
 * Parse a GitHub repository URL into owner/repo.
 *
 * @param url - GitHub URL (various formats supported)
 * @returns Parsed repository info
 *
 * @example
 * ```typescript
 * parseGitHubUrl("https://github.com/owner/repo")
 * // => { owner: "owner", repo: "repo" }
 *
 * parseGitHubUrl("git@github.com:owner/repo.git")
 * // => { owner: "owner", repo: "repo" }
 * ```
 */
export function parseGitHubUrl(url: string): GitHubRepo {
  // Remove trailing .git
  const cleaned = url.replace(/\.git$/, "");

  // SSH format: git@github.com:owner/repo
  const sshMatch = cleaned.match(/git@github\.com:([^/]+)\/(.+)/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // HTTPS format: https://github.com/owner/repo
  const httpsMatch = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // owner/repo format
  const simpleMatch = cleaned.match(/^([^/]+)\/([^/]+)$/);
  if (simpleMatch) {
    return { owner: simpleMatch[1], repo: simpleMatch[2] };
  }

  throw new GitError(`Invalid GitHub URL: ${url}`, "INVALID_OPTIONS", { url });
}

/**
 * Build a GitHub URL from owner/repo.
 *
 * @param repo - Repository info
 * @param path - Optional path within the repo
 * @returns GitHub URL
 */
export function buildGitHubUrl(repo: GitHubRepo, path = ""): string {
  const base = `https://github.com/${repo.owner}/${repo.repo}`;
  return path ? `${base}/${path}` : base;
}

/*─────────────────────────────────────────────────────────────*\
 | Pull Request Tracking                                        |
\*─────────────────────────────────────────────────────────────*/

/**
 * Get pull request information from GitHub.
 *
 * @param client - GitHub API client (Octokit)
 * @param repo - Repository owner/repo
 * @param prNumber - Pull request number
 * @returns Pull request data
 *
 * @example
 * ```typescript
 * import { Octokit } from "@octokit/rest";
 *
 * const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
 * const pr = await getPullRequest(octokit, { owner: "org", repo: "project" }, 123);
 *
 * console.log(`PR #${pr.number}: ${pr.title}`);
 * ```
 */
export async function getPullRequest(
  client: GitHubClient,
  repo: GitHubRepo,
  prNumber: number
): Promise<GitHubPullRequest> {
  try {
    const { data } = await client.pulls.get({
      owner: repo.owner,
      repo: repo.repo,
      pull_number: prNumber,
    });

    return {
      number: data.number,
      title: data.title,
      body: data.body,
      state: data.state,
      merged: data.merged,
      author: data.user?.login ?? "unknown",
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      mergedAt: data.merged_at ? new Date(data.merged_at) : null,
      mergedBy: data.merged_by?.login ?? null,
      baseBranch: data.base.ref,
      headBranch: data.head.ref,
      commits: data.commits,
      additions: data.additions,
      deletions: data.deletions,
      changedFiles: data.changed_files,
    };
  } catch (err) {
    throw new GitError(
      `Failed to fetch PR #${prNumber}`,
      "GITHUB_API_ERROR",
      { repo, prNumber, cause: err }
    );
  }
}

/**
 * Get reviews for a pull request.
 *
 * @param client - GitHub API client
 * @param repo - Repository owner/repo
 * @param prNumber - Pull request number
 * @returns Array of reviews
 */
export async function getPullRequestReviews(
  client: GitHubClient,
  repo: GitHubRepo,
  prNumber: number
): Promise<GitHubReview[]> {
  try {
    const { data } = await client.pulls.listReviews({
      owner: repo.owner,
      repo: repo.repo,
      pull_number: prNumber,
    });

    return data.map((review) => ({
      id: review.id,
      author: review.user?.login ?? "unknown",
      state: review.state,
      body: review.body,
      submittedAt: new Date(review.submitted_at),
      commitId: review.commit_id,
    }));
  } catch (err) {
    throw new GitError(
      `Failed to fetch reviews for PR #${prNumber}`,
      "GITHUB_API_ERROR",
      { repo, prNumber, cause: err }
    );
  }
}

/**
 * Get commits in a pull request.
 *
 * @param client - GitHub API client
 * @param repo - Repository owner/repo
 * @param prNumber - Pull request number
 * @returns Array of commit SHAs and authors
 */
export async function getPullRequestCommits(
  client: GitHubClient,
  repo: GitHubRepo,
  prNumber: number
): Promise<Array<{ sha: string; author: string; message: string }>> {
  try {
    const { data } = await client.pulls.listCommits({
      owner: repo.owner,
      repo: repo.repo,
      pull_number: prNumber,
      per_page: 100,
    });

    return data.map((commit) => ({
      sha: commit.sha,
      author: commit.author?.login ?? commit.commit.author?.email ?? "unknown",
      message: commit.commit.message,
    }));
  } catch (err) {
    throw new GitError(
      `Failed to fetch commits for PR #${prNumber}`,
      "GITHUB_API_ERROR",
      { repo, prNumber, cause: err }
    );
  }
}

/*─────────────────────────────────────────────────────────────*\
 | Provenance Recording                                         |
\*─────────────────────────────────────────────────────────────*/

/**
 * Record a pull request as provenance.
 *
 * Creates EAA records for a GitHub pull request, including
 * the PR author, reviewers, and commit authors.
 *
 * @param client - GitHub API client
 * @param repo - Repository owner/repo
 * @param prNumber - Pull request number
 * @param options - Recording options
 * @returns Provenance records
 *
 * @example
 * ```typescript
 * import { Octokit } from "@octokit/rest";
 *
 * const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
 * const result = await recordPullRequest(
 *   octokit,
 *   { owner: "org", repo: "project" },
 *   123
 * );
 *
 * console.log(`Action: ${result.action.id}`);
 * console.log(`Contributors: ${result.entities.length}`);
 * ```
 */
export async function recordPullRequest(
  client: GitHubClient,
  repo: GitHubRepo,
  prNumber: number,
  options: {
    includeCommitAuthors?: boolean;
    includeReviewers?: boolean;
    resourceRef?: ContentReference;
  } = {}
): Promise<PRProvenanceResult> {
  const {
    includeCommitAuthors = true,
    includeReviewers = true,
    resourceRef,
  } = options;

  // Fetch PR data
  const pullRequest = await getPullRequest(client, repo, prNumber);
  const reviews = includeReviewers
    ? await getPullRequestReviews(client, repo, prNumber)
    : [];
  const commits = includeCommitAuthors
    ? await getPullRequestCommits(client, repo, prNumber)
    : [];

  // Build entities
  const entitiesMap = new Map<string, Entity>();

  // PR author
  const authorEntity: Entity = {
    id: `github:${pullRequest.author}`,
    name: pullRequest.author,
    role: "human",
    metadata: {
      platform: "github",
      username: pullRequest.author,
    },
  };
  entitiesMap.set(pullRequest.author, authorEntity);

  // Reviewers
  for (const review of reviews) {
    if (!entitiesMap.has(review.author)) {
      entitiesMap.set(review.author, {
        id: `github:${review.author}`,
        name: review.author,
        role: "human",
        metadata: {
          platform: "github",
          username: review.author,
        },
      });
    }
  }

  // Commit authors
  for (const commit of commits) {
    if (!entitiesMap.has(commit.author)) {
      entitiesMap.set(commit.author, {
        id: `github:${commit.author}`,
        name: commit.author,
        role: "human",
        metadata: {
          platform: "github",
          username: commit.author,
        },
      });
    }
  }

  // Create action
  const actionId = `github:${repo.owner}/${repo.repo}/pull/${prNumber}`;
  const outputRef: ContentReference = resourceRef ?? {
    ref: `${repo.owner}/${repo.repo}/pull/${prNumber}`,
    scheme: "ext:github:pr",
  };

  const action: Action = {
    id: actionId,
    type: pullRequest.merged ? "transform" : "create",
    performedBy: authorEntity.id,
    timestamp: (pullRequest.mergedAt ?? pullRequest.createdAt).toISOString(),
    inputs: [],
    outputs: [outputRef],
    extensions: {
      "ext:github@1.0.0": {
        type: "pull_request",
        repository: `${repo.owner}/${repo.repo}`,
        number: prNumber,
        title: pullRequest.title,
        state: pullRequest.state,
        merged: pullRequest.merged,
        baseBranch: pullRequest.baseBranch,
        headBranch: pullRequest.headBranch,
        commits: pullRequest.commits,
        additions: pullRequest.additions,
        deletions: pullRequest.deletions,
        changedFiles: pullRequest.changedFiles,
      },
    },
  };

  // Calculate contribution weights
  const contributorCommits = new Map<string, number>();
  for (const commit of commits) {
    const current = contributorCommits.get(commit.author) ?? 0;
    contributorCommits.set(commit.author, current + 1);
  }

  const totalCommits = commits.length || 1;

  // Build attributions
  const attributions: Attribution[] = [];

  // Main author attribution
  const authorWeight = includeCommitAuthors
    ? ((contributorCommits.get(pullRequest.author) ?? 1) / totalCommits) * 10000
    : 10000;

  const authorAttribution: Attribution = withContrib(
    {
      entityId: authorEntity.id,
      role: "creator",
      actionId,
      resourceRef: outputRef,
      note: `PR author: ${pullRequest.title}`,
    },
    {
      weight: Math.round(authorWeight),
      basis: "points",
      source: "calculated",
      category: "code",
    }
  );
  attributions.push(authorAttribution);

  // Commit author attributions (if different from PR author)
  if (includeCommitAuthors) {
    for (const [author, commitCount] of contributorCommits) {
      if (author !== pullRequest.author) {
        const weight = (commitCount / totalCommits) * 10000;
        const attribution: Attribution = withContrib(
          {
            entityId: `github:${author}`,
            role: "contributor",
            actionId,
            resourceRef: outputRef,
            note: `${commitCount} commit(s)`,
          },
          {
            weight: Math.round(weight),
            basis: "points",
            source: "calculated",
            category: "code",
          }
        );
        attributions.push(attribution);
      }
    }
  }

  // Reviewer attributions
  if (includeReviewers) {
    for (const review of reviews) {
      // Skip pending reviews
      if (review.state === "PENDING") continue;

      const attribution: Attribution = {
        entityId: `github:${review.author}`,
        role: "ext:github:reviewer",
        actionId,
        resourceRef: outputRef,
        note: `Review: ${review.state}${review.body ? ` - ${review.body.slice(0, 100)}` : ""}`,
      };
      attributions.push(attribution);
    }
  }

  return {
    action,
    attributions,
    entities: Array.from(entitiesMap.values()),
    pullRequest,
    reviews,
  };
}

/**
 * Check if a GitHub client is properly authenticated.
 *
 * @param client - GitHub API client
 * @returns Authentication status
 */
export async function checkAuthentication(
  _client: GitHubClient
): Promise<{ authenticated: boolean; username?: string }> {
  try {
    // This would require the user endpoint, which we don't have in our minimal interface
    // For now, just return a basic check
    // TODO: Add actual authentication check when user endpoint is available
    return { authenticated: true };
  } catch {
    return { authenticated: false };
  }
}

/**
 * Create a GitHub entity ID from a username.
 *
 * @param username - GitHub username
 * @returns Entity ID
 */
export function githubEntityId(username: string): string {
  return `github:${username}`;
}

/**
 * Extract PR number from a GitHub PR URL.
 *
 * @param url - PR URL (e.g., https://github.com/owner/repo/pull/123)
 * @returns PR number or undefined
 */
export function extractPRNumber(url: string): number | undefined {
  const match = url.match(/\/pull\/(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}
