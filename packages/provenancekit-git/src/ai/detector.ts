/**
 * AI assistance detector for git commits.
 *
 * Analyzes commits to detect AI co-authorship from various signals
 * including commit messages, file changes, and known AI tool patterns.
 *
 * @packageDocumentation
 */

import type { AIAssistance, CommitInfo } from "../types.js";
import {
  matchCommitMessage,
  matchFiles,
  AI_TOOLS,
  type AIToolInfo,
  type PatternMatch,
} from "./patterns.js";

/*─────────────────────────────────────────────────────────────*\
 | Detection Types                                              |
\*─────────────────────────────────────────────────────────────*/

/**
 * Detailed detection result.
 */
export interface DetectionResult {
  /** Whether AI assistance was detected */
  detected: boolean;

  /** Confidence level (0-1) */
  confidence: number;

  /** Detected tool (if identifiable) */
  tool?: string;

  /** Tool info (if identifiable) */
  toolInfo?: AIToolInfo;

  /** Model used (if detectable) */
  model?: string;

  /** All indicators that contributed to detection */
  indicators: string[];

  /** All pattern matches found */
  matches: PatternMatch[];
}

/**
 * Options for AI detection.
 */
export interface DetectionOptions {
  /** Minimum confidence threshold to report detection (default: 0.3) */
  confidenceThreshold?: number;

  /** Whether to check file patterns (default: true) */
  checkFiles?: boolean;

  /** Custom patterns to check (in addition to built-in) */
  customPatterns?: RegExp[];

  /** Custom tool definitions */
  customTools?: AIToolInfo[];
}

/*─────────────────────────────────────────────────────────────*\
 | Confidence Weights                                           |
\*─────────────────────────────────────────────────────────────*/

/**
 * Confidence weights for different detection signals.
 * These are calibrated based on signal reliability.
 */
const CONFIDENCE_WEIGHTS = {
  /** Co-author line explicitly naming an AI tool */
  coAuthor: 0.95,

  /** AI-related message pattern */
  message: 0.7,

  /** AI tool config file changed */
  file: 0.4,

  /** Generic AI pattern */
  generic: 0.5,
};

/*─────────────────────────────────────────────────────────────*\
 | Detector Functions                                           |
\*─────────────────────────────────────────────────────────────*/

/**
 * Detect AI assistance from a commit message.
 *
 * @param message - The commit message
 * @param options - Detection options
 * @returns Detection result
 *
 * @example
 * ```typescript
 * const result = detectFromMessage(`
 *   feat: add new feature
 *
 *   Co-authored-by: Claude <noreply@anthropic.com>
 * `);
 *
 * if (result.detected) {
 *   console.log(`AI tool: ${result.tool}`);
 *   console.log(`Confidence: ${result.confidence}`);
 * }
 * ```
 */
export function detectFromMessage(
  message: string,
  options: DetectionOptions = {}
): DetectionResult {
  const { confidenceThreshold = 0.3, customPatterns = [] } = options;

  const matches = matchCommitMessage(message);
  const indicators: string[] = [];
  let maxConfidence = 0;
  let detectedTool: AIToolInfo | undefined;
  let detectedModel: string | undefined;

  // Process matches
  for (const match of matches) {
    const weight = CONFIDENCE_WEIGHTS[match.category] ?? 0.5;
    maxConfidence = Math.max(maxConfidence, weight);

    if (match.tool && !detectedTool) {
      detectedTool = match.tool;
    }

    indicators.push(`${match.category}: "${match.match}"`);
  }

  // Check custom patterns
  for (const pattern of customPatterns) {
    const match = message.match(pattern);
    if (match) {
      maxConfidence = Math.max(maxConfidence, 0.6);
      indicators.push(`custom: "${match[0]}"`);
    }
  }

  // Try to detect model from message
  if (detectedTool?.models) {
    for (const model of detectedTool.models) {
      if (message.toLowerCase().includes(model.toLowerCase())) {
        detectedModel = model;
        break;
      }
    }
  }

  // Require both: positive confidence AND meeting threshold
  const detected = maxConfidence > 0 && maxConfidence >= confidenceThreshold;

  return {
    detected,
    confidence: maxConfidence,
    tool: detectedTool?.id,
    toolInfo: detectedTool,
    model: detectedModel,
    indicators,
    matches,
  };
}

/**
 * Detect AI assistance from file paths.
 *
 * @param files - Array of file paths changed
 * @param options - Detection options
 * @returns Detection result
 */
export function detectFromFiles(
  files: string[],
  options: DetectionOptions = {}
): DetectionResult {
  const { confidenceThreshold = 0.3 } = options;

  const matches = matchFiles(files);
  const indicators: string[] = [];
  let maxConfidence = 0;
  let detectedTool: AIToolInfo | undefined;

  for (const match of matches) {
    const weight = CONFIDENCE_WEIGHTS.file;
    maxConfidence = Math.max(maxConfidence, weight);

    if (match.tool && !detectedTool) {
      detectedTool = match.tool;
    }

    indicators.push(`file: "${match.match}"`);
  }

  // Require both: positive confidence AND meeting threshold
  const detected = maxConfidence > 0 && maxConfidence >= confidenceThreshold;

  return {
    detected,
    confidence: maxConfidence,
    tool: detectedTool?.id,
    toolInfo: detectedTool,
    indicators,
    matches,
  };
}

/**
 * Detect AI assistance from a complete commit.
 *
 * Combines message and file analysis for comprehensive detection.
 *
 * @param commit - Commit information
 * @param options - Detection options
 * @returns Detection result
 *
 * @example
 * ```typescript
 * const commit = await getCommitInfo("HEAD");
 * const result = detectAIAssistance(commit);
 *
 * if (result.detected) {
 *   console.log(`AI-assisted by: ${result.tool}`);
 * }
 * ```
 */
export function detectAIAssistance(
  commit: Pick<CommitInfo, "message" | "files">,
  options: DetectionOptions = {}
): DetectionResult {
  const { checkFiles = true, confidenceThreshold = 0.3 } = options;

  // Get message detection
  const messageResult = detectFromMessage(commit.message, options);

  // Optionally check files
  let fileResult: DetectionResult | undefined;
  if (checkFiles && commit.files.length > 0) {
    const filePaths = commit.files.map((f) => f.path);
    fileResult = detectFromFiles(filePaths, options);
  }

  // Combine results
  const allMatches = [...messageResult.matches, ...(fileResult?.matches ?? [])];
  const allIndicators = [
    ...messageResult.indicators,
    ...(fileResult?.indicators ?? []),
  ];

  // Use highest confidence
  const confidence = Math.max(
    messageResult.confidence,
    fileResult?.confidence ?? 0
  );

  // Prefer tool from message (more reliable)
  const tool = messageResult.tool ?? fileResult?.tool;
  const toolInfo = messageResult.toolInfo ?? fileResult?.toolInfo;
  const model = messageResult.model;

  // Require both: positive confidence AND meeting threshold
  const detected = confidence > 0 && confidence >= confidenceThreshold;

  return {
    detected,
    confidence,
    tool,
    toolInfo,
    model,
    indicators: allIndicators,
    matches: allMatches,
  };
}

/**
 * Convert detection result to AIAssistance extension format.
 *
 * @param result - Detection result
 * @returns AIAssistance or undefined if not detected
 */
export function toAIAssistance(result: DetectionResult): AIAssistance | undefined {
  if (!result.detected) return undefined;

  return {
    tool: result.tool ?? "unknown",
    confidence: result.confidence,
    indicators: result.indicators,
    model: result.model,
  };
}

/**
 * Analyze multiple commits for AI assistance patterns.
 *
 * @param commits - Array of commits to analyze
 * @param options - Detection options
 * @returns Array of detection results with commit SHA
 */
export function analyzeCommitHistory(
  commits: Array<Pick<CommitInfo, "sha" | "message" | "files">>,
  options: DetectionOptions = {}
): Array<{ sha: string; result: DetectionResult }> {
  return commits.map((commit) => ({
    sha: commit.sha,
    result: detectAIAssistance(commit, options),
  }));
}

/**
 * Get statistics about AI assistance in a commit history.
 *
 * @param commits - Array of commits to analyze
 * @param options - Detection options
 * @returns Statistics about AI assistance
 */
export function getAIAssistanceStats(
  commits: Array<Pick<CommitInfo, "sha" | "message" | "files">>,
  options: DetectionOptions = {}
): {
  total: number;
  aiAssisted: number;
  percentage: number;
  byTool: Map<string, number>;
} {
  const results = analyzeCommitHistory(commits, options);
  const byTool = new Map<string, number>();

  let aiAssisted = 0;
  for (const { result } of results) {
    if (result.detected) {
      aiAssisted++;
      const tool = result.tool ?? "unknown";
      byTool.set(tool, (byTool.get(tool) ?? 0) + 1);
    }
  }

  return {
    total: commits.length,
    aiAssisted,
    percentage: commits.length > 0 ? (aiAssisted / commits.length) * 100 : 0,
    byTool,
  };
}

/**
 * Get all registered AI tools.
 *
 * @returns Array of AI tool info
 */
export function getRegisteredTools(): AIToolInfo[] {
  return [...AI_TOOLS];
}
