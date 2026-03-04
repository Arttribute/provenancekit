/**
 * Tests for AI detection patterns and detector.
 */

import { describe, it, expect } from "vitest";
import {
  // Patterns
  AI_TOOLS,
  GENERIC_AI_PATTERNS,
  matchCommitMessage,
  matchFiles,
  getToolById,
  getToolByName,
  getToolsByProvider,

  // Detector
  detectFromMessage,
  detectFromFiles,
  detectAIAssistance,
  toAIAssistance,
  analyzeCommitHistory,
  getAIAssistanceStats,
  getRegisteredTools,
} from "../src/ai/index.js";

/*─────────────────────────────────────────────────────────────*\
 | Pattern Registry                                             |
\*─────────────────────────────────────────────────────────────*/

describe("AI_TOOLS registry", () => {
  it("includes major AI coding tools", () => {
    const toolIds = AI_TOOLS.map((t) => t.id);

    expect(toolIds).toContain("github-copilot");
    expect(toolIds).toContain("claude");
    expect(toolIds).toContain("chatgpt");
    expect(toolIds).toContain("cursor");
    expect(toolIds).toContain("aider");
  });

  it("each tool has required fields", () => {
    for (const tool of AI_TOOLS) {
      expect(tool.id).toBeDefined();
      expect(tool.name).toBeDefined();
      expect(tool.provider).toBeDefined();
    }
  });
});

describe("getToolById", () => {
  it("finds tool by exact ID", () => {
    const tool = getToolById("claude");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("Claude");
    expect(tool?.provider).toBe("Anthropic");
  });

  it("returns undefined for unknown ID", () => {
    expect(getToolById("unknown-tool")).toBeUndefined();
  });
});

describe("getToolByName", () => {
  it("finds tool by name (case-insensitive)", () => {
    expect(getToolByName("Claude")).toBeDefined();
    expect(getToolByName("claude")).toBeDefined();
    expect(getToolByName("CLAUDE")).toBeDefined();
  });
});

describe("getToolsByProvider", () => {
  it("finds tools by provider", () => {
    const anthropicTools = getToolsByProvider("Anthropic");
    expect(anthropicTools.length).toBeGreaterThan(0);
    expect(anthropicTools.some((t) => t.id === "claude")).toBe(true);
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Pattern Matching                                             |
\*─────────────────────────────────────────────────────────────*/

describe("matchCommitMessage", () => {
  it("detects Claude co-author", () => {
    const message = `feat: add new feature

Co-authored-by: Claude <noreply@anthropic.com>`;

    const matches = matchCommitMessage(message);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.tool?.id === "claude")).toBe(true);
    expect(matches.some((m) => m.category === "coAuthor")).toBe(true);
  });

  it("detects GitHub Copilot co-author", () => {
    const message = `fix: resolve bug

Co-authored-by: GitHub Copilot <copilot@github.com>`;

    const matches = matchCommitMessage(message);
    expect(matches.some((m) => m.tool?.id === "github-copilot")).toBe(true);
  });

  it("detects generic AI patterns", () => {
    const message = `feat: implement feature

[AI-assisted]`;

    const matches = matchCommitMessage(message);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.category === "generic")).toBe(true);
  });

  it("detects aider-style prefixes", () => {
    const message = "aider: fix bug in authentication";

    const matches = matchCommitMessage(message);
    expect(matches.some((m) => m.tool?.id === "aider")).toBe(true);
  });

  it("returns empty array for clean commits", () => {
    const message = "feat: manually written commit message";
    const matches = matchCommitMessage(message);
    expect(matches.length).toBe(0);
  });
});

describe("matchFiles", () => {
  it("detects Cursor config files", () => {
    const files = [".cursor/rules", "src/index.ts"];
    const matches = matchFiles(files);
    expect(matches.some((m) => m.tool?.id === "cursor")).toBe(true);
  });

  it("detects aider config files", () => {
    const files = [".aider", "src/main.py"];
    const matches = matchFiles(files);
    expect(matches.some((m) => m.tool?.id === "aider")).toBe(true);
  });

  it("returns empty for normal files", () => {
    const files = ["src/index.ts", "package.json", "README.md"];
    const matches = matchFiles(files);
    expect(matches.length).toBe(0);
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Detector Functions                                           |
\*─────────────────────────────────────────────────────────────*/

describe("detectFromMessage", () => {
  it("detects with high confidence from co-author line", () => {
    const result = detectFromMessage(`fix: bug fix

Co-authored-by: Claude <noreply@anthropic.com>`);

    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.tool).toBe("claude");
  });

  it("detects with medium confidence from generic patterns", () => {
    const result = detectFromMessage("feat: add feature [AI-assisted]");

    expect(result.detected).toBe(true);
    expect(result.confidence).toBeLessThan(0.9);
  });

  it("respects confidence threshold", () => {
    const lowThreshold = detectFromMessage("test commit", {
      confidenceThreshold: 0,
    });
    const highThreshold = detectFromMessage("test commit", {
      confidenceThreshold: 0.5,
    });

    expect(lowThreshold.detected).toBe(false);
    expect(highThreshold.detected).toBe(false);
  });

  it("supports custom patterns", () => {
    const result = detectFromMessage("MYAI: generated this code", {
      customPatterns: [/^MYAI:/],
    });

    expect(result.detected).toBe(true);
    expect(result.indicators.some((i) => i.includes("custom"))).toBe(true);
  });
});

describe("detectFromFiles", () => {
  it("detects AI tool config files", () => {
    const result = detectFromFiles([".cursor/config.json"]);

    expect(result.detected).toBe(true);
    expect(result.tool).toBe("cursor");
  });

  it("has lower confidence for file-only detection", () => {
    const result = detectFromFiles([".cursor/rules"]);

    expect(result.confidence).toBeLessThan(0.5);
  });
});

describe("detectAIAssistance", () => {
  it("combines message and file detection", () => {
    const commit = {
      message: `feat: add feature

Co-authored-by: Cursor <ai@cursor.com>`,
      files: [{ path: ".cursor/rules", status: "modified" as const, additions: 0, deletions: 0 }],
    };

    const result = detectAIAssistance(commit);

    expect(result.detected).toBe(true);
    expect(result.indicators.length).toBeGreaterThan(0);
  });

  it("prioritizes message detection over files", () => {
    const commit = {
      message: `fix: bug

Co-authored-by: Claude <noreply@anthropic.com>`,
      files: [{ path: ".cursor/rules", status: "modified" as const, additions: 0, deletions: 0 }],
    };

    const result = detectAIAssistance(commit);

    // Claude from message should be preferred over Cursor from files
    expect(result.tool).toBe("claude");
  });

  it("can skip file checking", () => {
    const commit = {
      message: "normal commit",
      files: [{ path: ".cursor/rules", status: "modified" as const, additions: 0, deletions: 0 }],
    };

    const result = detectAIAssistance(commit, { checkFiles: false });

    expect(result.detected).toBe(false);
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Conversion and Analysis                                      |
\*─────────────────────────────────────────────────────────────*/

describe("toAIAssistance", () => {
  it("converts detection result to extension format", () => {
    const detection = detectFromMessage(`feat: add

Co-authored-by: Claude <noreply@anthropic.com>`);

    const assistance = toAIAssistance(detection);

    expect(assistance).toBeDefined();
    expect(assistance?.tool).toBe("claude");
    expect(assistance?.confidence).toBeGreaterThan(0);
    expect(assistance?.indicators).toBeDefined();
  });

  it("returns undefined for non-detected", () => {
    const detection = detectFromMessage("normal commit");
    const assistance = toAIAssistance(detection);

    expect(assistance).toBeUndefined();
  });
});

describe("analyzeCommitHistory", () => {
  it("analyzes multiple commits", () => {
    const commits = [
      {
        sha: "abc123",
        message: "feat: add feature\n\nCo-authored-by: Claude <noreply@anthropic.com>",
        files: [],
      },
      {
        sha: "def456",
        message: "fix: manual fix",
        files: [],
      },
      {
        sha: "ghi789",
        message: "docs: update\n\n[AI-assisted]",
        files: [],
      },
    ];

    const results = analyzeCommitHistory(commits);

    expect(results.length).toBe(3);
    expect(results[0].result.detected).toBe(true);
    expect(results[1].result.detected).toBe(false);
    expect(results[2].result.detected).toBe(true);
  });
});

describe("getAIAssistanceStats", () => {
  it("calculates statistics correctly", () => {
    const commits = [
      { sha: "1", message: "Co-authored-by: Claude <x>", files: [] },
      { sha: "2", message: "Co-authored-by: Claude <x>", files: [] },
      { sha: "3", message: "normal commit", files: [] },
      { sha: "4", message: "Co-authored-by: Cursor <x>", files: [] },
    ];

    const stats = getAIAssistanceStats(commits);

    expect(stats.total).toBe(4);
    expect(stats.aiAssisted).toBe(3);
    expect(stats.percentage).toBe(75);
    expect(stats.byTool.get("claude")).toBe(2);
    expect(stats.byTool.get("cursor")).toBe(1);
  });

  it("handles empty commit list", () => {
    const stats = getAIAssistanceStats([]);

    expect(stats.total).toBe(0);
    expect(stats.aiAssisted).toBe(0);
    expect(stats.percentage).toBe(0);
  });
});

describe("getRegisteredTools", () => {
  it("returns all registered tools", () => {
    const tools = getRegisteredTools();

    expect(tools.length).toBeGreaterThan(0);
    expect(tools).toEqual(AI_TOOLS);
  });

  it("returns a copy (not the original array)", () => {
    const tools = getRegisteredTools();
    tools.push({ id: "test", name: "Test", provider: "Test" });

    expect(AI_TOOLS.some((t) => t.id === "test")).toBe(false);
  });
});
