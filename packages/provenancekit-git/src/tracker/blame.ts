/**
 * Git blame analysis for contribution tracking.
 *
 * Analyzes git blame data to determine per-author line ownership
 * and calculate contribution weights for payment distribution.
 *
 * @packageDocumentation
 */

import type { SimpleGit } from "simple-git";
import simpleGit from "simple-git";
import type { ContentReference } from "@provenancekit/eaa-types";
import type { Distribution, DistributionEntry } from "@provenancekit/extensions";
import type {
  BlameAnalysis,
  BlameAnalysisOptions,
  FileBlame,
  BlameLine,
  AuthorContribution,
} from "../types.js";
import { GitError } from "../types.js";

/*─────────────────────────────────────────────────────────────*\
 | Default Ignore Patterns                                      |
\*─────────────────────────────────────────────────────────────*/

/**
 * Default patterns to ignore during blame analysis.
 * These typically represent generated or non-human-authored content.
 */
export const DEFAULT_IGNORE_PATTERNS = [
  // Generated files
  "**/dist/**",
  "**/build/**",
  "**/node_modules/**",
  "**/.next/**",
  "**/coverage/**",
  "**/__generated__/**",

  // Lock files
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/Cargo.lock",
  "**/Gemfile.lock",
  "**/poetry.lock",
  "**/composer.lock",

  // IDE/Editor
  "**/.idea/**",
  "**/.vscode/**",
  "**/.vs/**",

  // Binary/media files (can't blame these anyway)
  "**/*.png",
  "**/*.jpg",
  "**/*.jpeg",
  "**/*.gif",
  "**/*.ico",
  "**/*.woff",
  "**/*.woff2",
  "**/*.ttf",
  "**/*.eot",
  "**/*.pdf",
  "**/*.zip",
  "**/*.tar",
  "**/*.gz",
];

/*─────────────────────────────────────────────────────────────*\
 | Blame Parsing                                                |
\*─────────────────────────────────────────────────────────────*/

/**
 * Parse git blame porcelain output.
 *
 * @param output - Raw blame output from git blame --porcelain
 * @returns Array of blame lines
 */
function parseBlameOutput(output: string): BlameLine[] {
  const lines: BlameLine[] = [];
  const outputLines = output.split("\n");

  let currentCommit = "";
  let currentAuthor = "";
  let currentEmail = "";
  let currentTimestamp = new Date();
  let lineNumber = 0;

  for (let i = 0; i < outputLines.length; i++) {
    const line = outputLines[i];

    // Commit line: SHA original_line final_line [num_lines]
    const commitMatch = line.match(/^([a-f0-9]{40})\s+(\d+)\s+(\d+)/);
    if (commitMatch) {
      currentCommit = commitMatch[1];
      lineNumber = parseInt(commitMatch[3], 10);
      continue;
    }

    // Author
    if (line.startsWith("author ")) {
      currentAuthor = line.slice(7);
      continue;
    }

    // Author email
    if (line.startsWith("author-mail ")) {
      currentEmail = line.slice(12).replace(/[<>]/g, "");
      continue;
    }

    // Author time
    if (line.startsWith("author-time ")) {
      currentTimestamp = new Date(parseInt(line.slice(12), 10) * 1000);
      continue;
    }

    // Actual content line (starts with tab)
    if (line.startsWith("\t")) {
      lines.push({
        lineNumber,
        commit: currentCommit,
        author: currentAuthor,
        authorEmail: currentEmail,
        timestamp: currentTimestamp,
        content: line.slice(1), // Remove leading tab
      });
    }
  }

  return lines;
}

/**
 * Build file blame from parsed lines.
 *
 * @param path - File path
 * @param lines - Parsed blame lines
 * @returns FileBlame object
 */
function buildFileBlame(path: string, lines: BlameLine[]): FileBlame {
  const linesByAuthor = new Map<string, number>();

  for (const line of lines) {
    const current = linesByAuthor.get(line.authorEmail) ?? 0;
    linesByAuthor.set(line.authorEmail, current + 1);
  }

  return {
    path,
    totalLines: lines.length,
    linesByAuthor,
    lines,
  };
}

/*─────────────────────────────────────────────────────────────*\
 | Main Analysis Function                                       |
\*─────────────────────────────────────────────────────────────*/

/**
 * Analyze git blame for a repository.
 *
 * Examines file-by-file ownership to determine contribution percentages.
 *
 * @param repoPath - Path to the git repository
 * @param options - Analysis options
 * @returns Blame analysis result
 *
 * @example
 * ```typescript
 * const analysis = await analyzeBlame("/path/to/repo", {
 *   branch: "main",
 *   paths: ["src/"],
 *   ignorePatterns: ["*.test.ts"],
 * });
 *
 * console.log("Total lines:", analysis.totalLines);
 * for (const [email, contrib] of analysis.byAuthor) {
 *   console.log(contrib.name + ": " + contrib.percentage.toFixed(1) + "%");
 * }
 * ```
 */
export async function analyzeBlame(
  repoPath: string,
  options: BlameAnalysisOptions = {}
): Promise<BlameAnalysis> {
  const {
    branch,
    paths = ["."],
    since: _since,
    until: _until,
    ignorePatterns = DEFAULT_IGNORE_PATTERNS,
    includeBinary: _includeBinary = false,
    maxFiles = 1000,
    followRenames = true,
  } = options;

  const git: SimpleGit = simpleGit(repoPath);

  // Verify this is a git repository
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new GitError(`Not a git repository: ${repoPath}`, "NOT_A_REPOSITORY", {
      repoPath,
    });
  }

  // Get current branch and commit
  const currentBranch = branch ?? (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
  const commitSha = (await git.revparse(["HEAD"])).trim();

  // Get list of files to analyze
  let fileList: string[];
  try {
    const lsFilesOutput = await git.raw([
      "ls-files",
      ...paths,
    ]);
    fileList = lsFilesOutput.trim().split("\n").filter(Boolean);
  } catch {
    fileList = [];
  }

  // Simple glob pattern matcher
  const matchesPattern = (file: string, pattern: string): boolean => {
    const regex = new RegExp(
      "^" +
        pattern
          .replace(/\./g, "\\.")
          .replace(/\*\*/g, ".*")
          .replace(/\*/g, "[^/]*")
          .replace(/\?/g, ".") +
        "$"
    );
    return regex.test(file);
  };

  // Filter out ignored patterns
  const filteredFiles = fileList.filter((file) => {
    for (const pattern of ignorePatterns) {
      if (matchesPattern(file, pattern)) {
        return false;
      }
    }
    return true;
  });

  // Limit files for performance
  const filesToAnalyze = filteredFiles.slice(0, maxFiles);

  // Analyze each file
  const files = new Map<string, FileBlame>();
  const authorStats = new Map<
    string,
    { name: string; lines: number; files: Set<string>; commits: Set<string> }
  >();

  for (const file of filesToAnalyze) {
    try {
      // Build blame command
      const blameArgs = ["blame", "--porcelain"];

      if (followRenames) {
        blameArgs.push("-M", "-C", "-C");
      }

      // Note: since/until filtering would require finding commits
      // from those dates and filtering by them - left for future implementation

      blameArgs.push(file);

      const blameOutput = await git.raw(blameArgs);

      if (!blameOutput.trim()) continue;

      const blameLines = parseBlameOutput(blameOutput);
      if (blameLines.length === 0) continue;

      const fileBlame = buildFileBlame(file, blameLines);
      files.set(file, fileBlame);

      // Aggregate author stats
      for (const line of blameLines) {
        const email = line.authorEmail;
        const existing = authorStats.get(email);

        if (existing) {
          existing.lines++;
          existing.files.add(file);
          existing.commits.add(line.commit);
          // Keep most recent name
          existing.name = line.author;
        } else {
          authorStats.set(email, {
            name: line.author,
            lines: 1,
            files: new Set([file]),
            commits: new Set([line.commit]),
          });
        }
      }
    } catch (err) {
      // Skip files that can't be blamed (binary, etc.)
      continue;
    }
  }

  // Calculate totals
  let totalLines = 0;
  for (const [, fileBlame] of files) {
    totalLines += fileBlame.totalLines;
  }

  // Build author contributions
  const byAuthor = new Map<string, AuthorContribution>();

  for (const [email, stats] of authorStats) {
    byAuthor.set(email, {
      email,
      name: stats.name,
      linesAuthored: stats.lines,
      filesContributed: stats.files.size,
      percentage: totalLines > 0 ? (stats.lines / totalLines) * 100 : 0,
      commits: stats.commits.size,
    });
  }

  // Create the analysis result
  const result: BlameAnalysis = {
    repoPath,
    branch: currentBranch,
    commitSha,
    analyzedAt: new Date(),
    files,
    byAuthor,
    totalLines,
    totalFiles: files.size,

    toDistribution(
      authorToEntity: Map<string, string> | ((email: string) => string),
      resourceRef: ContentReference
    ): Distribution {
      const entries: DistributionEntry[] = [];
      const BPS_TOTAL = 10000;

      // Calculate raw weights
      const weights: Array<{ entityId: string; weight: number }> = [];
      let totalWeight = 0;

      for (const [email, contrib] of this.byAuthor) {
        const entityId =
          typeof authorToEntity === "function"
            ? authorToEntity(email)
            : authorToEntity.get(email) ?? email;

        weights.push({
          entityId,
          weight: contrib.linesAuthored,
        });
        totalWeight += contrib.linesAuthored;
      }

      if (totalWeight === 0) {
        return {
          resourceRef,
          entries: [],
          totalBps: 0,
          metadata: {
            attributionsProcessed: 0,
            attributionsFiltered: 0,
            normalized: false,
            roundingAdjustments: new Map(),
            calculatedAt: new Date().toISOString(),
            algorithmVersion: "blame-analysis-v1",
          },
        };
      }

      // Apply largest remainder method for fair rounding
      const withQuotas = weights.map((w) => {
        const exactQuota = (w.weight / totalWeight) * BPS_TOTAL;
        return {
          entityId: w.entityId,
          exactQuota,
          floor: Math.floor(exactQuota),
          remainder: exactQuota - Math.floor(exactQuota),
        };
      });

      const floorSum = withQuotas.reduce((sum, w) => sum + w.floor, 0);
      let remaining = BPS_TOTAL - floorSum;

      // Sort by remainder descending
      const sorted = [...withQuotas].sort((a, b) => {
        if (b.remainder !== a.remainder) return b.remainder - a.remainder;
        return a.entityId.localeCompare(b.entityId);
      });

      // Distribute remaining bps to highest remainders
      const adjustments = new Map<string, number>();
      for (const entry of sorted) {
        if (remaining <= 0) break;
        const orig = withQuotas.find((w) => w.entityId === entry.entityId)!;
        orig.floor += 1;
        adjustments.set(entry.entityId, 1);
        remaining--;
      }

      // Build entries
      for (const w of withQuotas) {
        if (w.floor > 0) {
          entries.push({
            entityId: w.entityId,
            bps: w.floor,
          });
        }
      }

      // Sort by bps descending
      entries.sort((a, b) => {
        if (b.bps !== a.bps) return b.bps - a.bps;
        return a.entityId.localeCompare(b.entityId);
      });

      return {
        resourceRef,
        entries,
        totalBps: entries.reduce((sum, e) => sum + e.bps, 0),
        metadata: {
          attributionsProcessed: this.byAuthor.size,
          attributionsFiltered: 0,
          normalized: true,
          originalTotal: totalWeight,
          roundingAdjustments: adjustments,
          calculatedAt: new Date().toISOString(),
          algorithmVersion: "blame-analysis-v1",
        },
      };
    },
  };

  return result;
}

/**
 * Analyze blame for a specific file.
 *
 * @param repoPath - Repository path
 * @param filePath - Path to the file (relative to repo root)
 * @param options - Analysis options
 * @returns File blame information
 */
export async function analyzeFileBlame(
  repoPath: string,
  filePath: string,
  options: { followRenames?: boolean } = {}
): Promise<FileBlame> {
  const { followRenames = true } = options;

  const git: SimpleGit = simpleGit(repoPath);

  const blameArgs = ["blame", "--porcelain"];
  if (followRenames) {
    blameArgs.push("-M", "-C", "-C");
  }
  blameArgs.push(filePath);

  try {
    const blameOutput = await git.raw(blameArgs);
    const blameLines = parseBlameOutput(blameOutput);
    return buildFileBlame(filePath, blameLines);
  } catch (err) {
    const error = new Error(
      `Failed to blame file: ${filePath}`
    ) as unknown as GitError;
    (error as unknown as { code: string }).code = "GIT_COMMAND_FAILED";
    (error as unknown as { details: object }).details = { filePath, cause: err };
    throw error;
  }
}

/**
 * Get top contributors from a blame analysis.
 *
 * @param analysis - Blame analysis result
 * @param limit - Maximum number of contributors to return
 * @returns Top contributors sorted by lines authored
 */
export function getTopContributors(
  analysis: BlameAnalysis,
  limit = 10
): AuthorContribution[] {
  return Array.from(analysis.byAuthor.values())
    .sort((a, b) => b.linesAuthored - a.linesAuthored)
    .slice(0, limit);
}

/**
 * Format blame analysis as a human-readable summary.
 *
 * @param analysis - Blame analysis result
 * @returns Formatted summary string
 */
export function formatBlameAnalysis(analysis: BlameAnalysis): string {
  const lines: string[] = [
    `Blame Analysis for ${analysis.repoPath}`,
    `Branch: ${analysis.branch} (${analysis.commitSha.slice(0, 7)})`,
    `Analyzed at: ${analysis.analyzedAt.toISOString()}`,
    ``,
    `Summary:`,
    `  Total files: ${analysis.totalFiles}`,
    `  Total lines: ${analysis.totalLines}`,
    `  Contributors: ${analysis.byAuthor.size}`,
    ``,
    `Top Contributors:`,
  ];

  const topContributors = getTopContributors(analysis, 10);
  for (const contrib of topContributors) {
    lines.push(
      `  ${contrib.name} <${contrib.email}>: ${contrib.linesAuthored} lines (${contrib.percentage.toFixed(1)}%)`
    );
  }

  return lines.join("\n");
}
