/**
 * Tests for git extension helpers.
 */

import { describe, it, expect } from "vitest";
import type { Action } from "@arttribute/eaa-types";
import {
  GIT_NAMESPACE,
  withGitCommit,
  getGitCommit,
  hasGitCommit,
  getCommitSha,
  getRepository,
  hasAIAssistance,
  getAIAssistance,
  isSigned,
  isSignatureVerified,
  getCommitStats,
  withAIAssistance,
  withSignature,
  createCommitAction,
  normalizeRepositoryUrl,
  parseRepositoryId,
} from "../src/extension.js";

/*─────────────────────────────────────────────────────────────*\
 | Test Fixtures                                                |
\*─────────────────────────────────────────────────────────────*/

function createTestAction(overrides?: Partial<Action>): Action {
  return {
    id: "action-123",
    type: "create",
    performedBy: "did:key:alice",
    timestamp: "2024-01-01T00:00:00Z",
    inputs: [],
    outputs: [],
    ...overrides,
  };
}

/*─────────────────────────────────────────────────────────────*\
 | withGitCommit / getGitCommit / hasGitCommit                  |
\*─────────────────────────────────────────────────────────────*/

describe("withGitCommit", () => {
  it("adds git extension to action", () => {
    const action = createTestAction();
    const result = withGitCommit(action, {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123def456",
      message: "feat: add new feature",
      filesChanged: 5,
      linesAdded: 100,
      linesRemoved: 20,
    });

    expect(result.extensions?.[GIT_NAMESPACE]).toBeDefined();
    expect(result.extensions?.[GIT_NAMESPACE]).toMatchObject({
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123def456",
      message: "feat: add new feature",
      filesChanged: 5,
      linesAdded: 100,
      linesRemoved: 20,
    });
  });

  it("preserves existing extensions", () => {
    const action = createTestAction({
      extensions: { "ext:other@1.0.0": { foo: "bar" } },
    });
    const result = withGitCommit(action, {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123",
      message: "test",
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 0,
    });

    expect(result.extensions?.["ext:other@1.0.0"]).toEqual({ foo: "bar" });
    expect(result.extensions?.[GIT_NAMESPACE]).toBeDefined();
  });

  it("validates git extension data", () => {
    const action = createTestAction();

    expect(() =>
      withGitCommit(action, {
        repository: "github.com/org/repo",
        branch: "main",
        commit: "abc123",
        message: "test",
        filesChanged: -1, // Invalid
        linesAdded: 0,
        linesRemoved: 0,
      })
    ).toThrow();
  });
});

describe("getGitCommit", () => {
  it("returns git extension from action", () => {
    const action = withGitCommit(createTestAction(), {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123",
      message: "test",
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 0,
    });

    const git = getGitCommit(action);
    expect(git).toBeDefined();
    expect(git?.commit).toBe("abc123");
  });

  it("returns undefined for action without git extension", () => {
    const action = createTestAction();
    expect(getGitCommit(action)).toBeUndefined();
  });
});

describe("hasGitCommit", () => {
  it("returns true for action with git extension", () => {
    const action = withGitCommit(createTestAction(), {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123",
      message: "test",
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 0,
    });

    expect(hasGitCommit(action)).toBe(true);
  });

  it("returns false for action without git extension", () => {
    const action = createTestAction();
    expect(hasGitCommit(action)).toBe(false);
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Convenience Getters                                          |
\*─────────────────────────────────────────────────────────────*/

describe("getCommitSha", () => {
  it("returns commit SHA", () => {
    const action = withGitCommit(createTestAction(), {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123def456",
      message: "test",
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 0,
    });

    expect(getCommitSha(action)).toBe("abc123def456");
  });

  it("returns undefined for action without git extension", () => {
    expect(getCommitSha(createTestAction())).toBeUndefined();
  });
});

describe("getRepository", () => {
  it("returns repository identifier", () => {
    const action = withGitCommit(createTestAction(), {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123",
      message: "test",
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 0,
    });

    expect(getRepository(action)).toBe("github.com/org/repo");
  });
});

describe("getCommitStats", () => {
  it("returns commit statistics", () => {
    const action = withGitCommit(createTestAction(), {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123",
      message: "test",
      filesChanged: 5,
      linesAdded: 100,
      linesRemoved: 20,
    });

    const stats = getCommitStats(action);
    expect(stats).toEqual({
      filesChanged: 5,
      linesAdded: 100,
      linesRemoved: 20,
    });
  });
});

/*─────────────────────────────────────────────────────────────*\
 | AI Assistance                                                |
\*─────────────────────────────────────────────────────────────*/

describe("AI assistance helpers", () => {
  it("hasAIAssistance returns false without AI", () => {
    const action = withGitCommit(createTestAction(), {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123",
      message: "test",
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 0,
    });

    expect(hasAIAssistance(action)).toBe(false);
  });

  it("hasAIAssistance returns true with AI", () => {
    const action = withGitCommit(createTestAction(), {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123",
      message: "test",
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 0,
      aiAssisted: {
        tool: "claude",
        confidence: 0.9,
        indicators: ["Co-authored-by: Claude"],
      },
    });

    expect(hasAIAssistance(action)).toBe(true);
  });

  it("getAIAssistance returns AI data", () => {
    const action = withGitCommit(createTestAction(), {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123",
      message: "test",
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 0,
      aiAssisted: {
        tool: "claude",
        confidence: 0.9,
        indicators: ["Co-authored-by: Claude"],
        model: "claude-3-opus",
      },
    });

    const ai = getAIAssistance(action);
    expect(ai?.tool).toBe("claude");
    expect(ai?.confidence).toBe(0.9);
    expect(ai?.model).toBe("claude-3-opus");
  });

  it("withAIAssistance adds AI to existing git extension", () => {
    let action = withGitCommit(createTestAction(), {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123",
      message: "test",
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 0,
    });

    action = withAIAssistance(action, {
      tool: "cursor",
      confidence: 0.8,
      indicators: ["Cursor session detected"],
    });

    expect(hasAIAssistance(action)).toBe(true);
    expect(getAIAssistance(action)?.tool).toBe("cursor");
  });

  it("withAIAssistance throws without git extension", () => {
    const action = createTestAction();

    expect(() =>
      withAIAssistance(action, {
        tool: "cursor",
        confidence: 0.8,
        indicators: [],
      })
    ).toThrow();
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Signature                                                    |
\*─────────────────────────────────────────────────────────────*/

describe("Signature helpers", () => {
  it("isSigned returns false without signature", () => {
    const action = withGitCommit(createTestAction(), {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123",
      message: "test",
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 0,
    });

    expect(isSigned(action)).toBe(false);
  });

  it("isSigned returns true with signature", () => {
    const action = withGitCommit(createTestAction(), {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123",
      message: "test",
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 0,
      signature: {
        type: "gpg",
        verified: true,
        signer: "alice@example.com",
      },
    });

    expect(isSigned(action)).toBe(true);
  });

  it("isSignatureVerified returns verification status", () => {
    const verifiedAction = withGitCommit(createTestAction(), {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123",
      message: "test",
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 0,
      signature: { type: "gpg", verified: true },
    });

    const unverifiedAction = withGitCommit(createTestAction(), {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123",
      message: "test",
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 0,
      signature: { type: "gpg", verified: false },
    });

    expect(isSignatureVerified(verifiedAction)).toBe(true);
    expect(isSignatureVerified(unverifiedAction)).toBe(false);
  });

  it("withSignature adds signature to existing git extension", () => {
    let action = withGitCommit(createTestAction(), {
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123",
      message: "test",
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 0,
    });

    action = withSignature(action, {
      type: "ssh",
      verified: true,
      keyId: "SHA256:abc123",
    });

    expect(isSigned(action)).toBe(true);
    expect(isSignatureVerified(action)).toBe(true);
  });
});

/*─────────────────────────────────────────────────────────────*\
 | createCommitAction                                           |
\*─────────────────────────────────────────────────────────────*/

describe("createCommitAction", () => {
  it("creates a complete commit action", () => {
    const action = createCommitAction({
      id: "action-123",
      performedBy: "did:key:alice",
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123def456",
      message: "feat: add feature",
      filesChanged: 3,
      linesAdded: 50,
      linesRemoved: 10,
    });

    expect(action.id).toBe("action-123");
    expect(action.type).toBe("ext:git:commit");
    expect(action.performedBy).toBe("did:key:alice");
    expect(hasGitCommit(action)).toBe(true);
    expect(getCommitSha(action)).toBe("abc123def456");
  });

  it("includes optional fields", () => {
    const action = createCommitAction({
      id: "action-123",
      performedBy: "did:key:alice",
      timestamp: "2024-01-15T10:30:00Z",
      repository: "github.com/org/repo",
      branch: "main",
      commit: "abc123",
      message: "test",
      parents: ["parent1", "parent2"],
      filesChanged: 1,
      linesAdded: 1,
      linesRemoved: 0,
      aiAssisted: {
        tool: "claude",
        confidence: 0.9,
        indicators: [],
      },
    });

    expect(action.timestamp).toBe("2024-01-15T10:30:00Z");
    expect(getGitCommit(action)?.parents).toEqual(["parent1", "parent2"]);
    expect(hasAIAssistance(action)).toBe(true);
  });
});

/*─────────────────────────────────────────────────────────────*\
 | URL Parsing                                                  |
\*─────────────────────────────────────────────────────────────*/

describe("normalizeRepositoryUrl", () => {
  it("normalizes HTTPS URLs", () => {
    expect(normalizeRepositoryUrl("https://github.com/owner/repo.git")).toBe(
      "github.com/owner/repo"
    );
    expect(normalizeRepositoryUrl("https://github.com/owner/repo")).toBe(
      "github.com/owner/repo"
    );
  });

  it("normalizes SSH URLs", () => {
    expect(normalizeRepositoryUrl("git@github.com:owner/repo.git")).toBe(
      "github.com/owner/repo"
    );
    expect(normalizeRepositoryUrl("git@github.com:owner/repo")).toBe(
      "github.com/owner/repo"
    );
  });

  it("handles already normalized URLs", () => {
    expect(normalizeRepositoryUrl("github.com/owner/repo")).toBe(
      "github.com/owner/repo"
    );
  });
});

describe("parseRepositoryId", () => {
  it("parses valid repository identifiers", () => {
    const result = parseRepositoryId("github.com/owner/repo");
    expect(result).toEqual({
      host: "github.com",
      owner: "owner",
      repo: "repo",
    });
  });

  it("handles nested repo paths", () => {
    const result = parseRepositoryId("github.com/owner/nested/repo");
    expect(result).toEqual({
      host: "github.com",
      owner: "owner",
      repo: "nested/repo",
    });
  });

  it("returns undefined for invalid format", () => {
    expect(parseRepositoryId("owner/repo")).toBeUndefined();
    expect(parseRepositoryId("repo")).toBeUndefined();
  });
});
