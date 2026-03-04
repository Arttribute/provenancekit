/**
 * Tests for GitHub integration.
 *
 * Note: GitHub is one example of a git platform integration.
 * The same patterns can be used to build integrations for
 * GitLab, Gitea, BitBucket, or custom git platforms.
 */

import { describe, it, expect, vi } from "vitest";
import {
  parseGitHubUrl,
  buildGitHubUrl,
  githubEntityId,
  extractPRNumber,
} from "../src/integrations/github.js";

/*─────────────────────────────────────────────────────────────*\
 | URL Parsing                                                  |
\*─────────────────────────────────────────────────────────────*/

describe("parseGitHubUrl", () => {
  it("parses HTTPS URLs", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("parses HTTPS URLs with .git suffix", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo.git");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("parses SSH URLs", () => {
    const result = parseGitHubUrl("git@github.com:owner/repo.git");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("parses SSH URLs without .git", () => {
    const result = parseGitHubUrl("git@github.com:owner/repo");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("parses simple owner/repo format", () => {
    const result = parseGitHubUrl("owner/repo");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("throws for invalid URLs", () => {
    expect(() => parseGitHubUrl("invalid")).toThrow();
    expect(() => parseGitHubUrl("")).toThrow();
  });
});

describe("buildGitHubUrl", () => {
  it("builds base repo URL", () => {
    const url = buildGitHubUrl({ owner: "owner", repo: "repo" });
    expect(url).toBe("https://github.com/owner/repo");
  });

  it("builds URL with path", () => {
    const url = buildGitHubUrl({ owner: "owner", repo: "repo" }, "pull/123");
    expect(url).toBe("https://github.com/owner/repo/pull/123");
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Entity Helpers                                               |
\*─────────────────────────────────────────────────────────────*/

describe("githubEntityId", () => {
  it("creates entity ID from username", () => {
    expect(githubEntityId("alice")).toBe("github:alice");
    expect(githubEntityId("bob-smith")).toBe("github:bob-smith");
  });
});

describe("extractPRNumber", () => {
  it("extracts PR number from URL", () => {
    expect(extractPRNumber("https://github.com/owner/repo/pull/123")).toBe(123);
    expect(extractPRNumber("https://github.com/owner/repo/pull/456")).toBe(456);
  });

  it("returns undefined for non-PR URLs", () => {
    expect(extractPRNumber("https://github.com/owner/repo")).toBeUndefined();
    expect(extractPRNumber("https://github.com/owner/repo/issues/123")).toBeUndefined();
  });
});

/*─────────────────────────────────────────────────────────────*\
 | API Client Tests (Mocked)                                    |
\*─────────────────────────────────────────────────────────────*/

describe("GitHub API integration", () => {
  it("demonstrates platform-agnostic design", () => {
    // The GitHubClient interface can be implemented for any git platform
    // This test documents the expected interface shape

    const mockClient = {
      pulls: {
        get: vi.fn(),
        listCommits: vi.fn(),
        listReviews: vi.fn(),
      },
      repos: {
        getCommit: vi.fn(),
      },
    };

    // The interface is simple enough to implement for other platforms
    expect(mockClient.pulls.get).toBeDefined();
    expect(mockClient.pulls.listCommits).toBeDefined();
    expect(mockClient.pulls.listReviews).toBeDefined();
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Platform Abstraction Notes                                   |
\*─────────────────────────────────────────────────────────────*/

/**
 * The GitHub integration serves as a reference implementation.
 * Developers can create similar integrations for:
 *
 * - GitLab: Use @gitlab/client or similar
 * - Gitea: Use the Gitea API
 * - BitBucket: Use the Atlassian API
 * - Custom git platforms: Implement the same patterns
 *
 * Key abstractions to follow:
 * 1. parseGitPlatformUrl(url) -> { host, owner, repo }
 * 2. getPullRequest(client, repo, id) -> PullRequest
 * 3. recordPullRequest(client, repo, id) -> PRProvenanceResult
 *
 * The core provenance types (Action, Attribution, Entity)
 * remain the same across all platforms.
 */
describe("Platform abstraction documentation", () => {
  it("documents the extensibility model", () => {
    // This is a documentation test that serves as a guide
    // for developers implementing other platform integrations

    const platformPatterns = {
      urlParsing: "parseGitPlatformUrl(url) -> { host, owner, repo }",
      entityIds: "platform:username format (e.g., gitlab:alice)",
      apiClient: "Simple interface with pulls/repos methods",
      provenanceRecords: "Standard EAA types (Action, Attribution, Entity)",
    };

    expect(Object.keys(platformPatterns).length).toBe(4);
  });
});
