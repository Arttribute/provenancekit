/**
 * AI detection module for @provenancekit/git.
 *
 * Provides tools for detecting AI-assisted code contributions
 * from commit messages, file patterns, and other signals.
 *
 * @packageDocumentation
 */

// Patterns
export {
  AI_TOOLS,
  GENERIC_AI_PATTERNS,
  matchCommitMessage,
  matchFiles,
  getToolById,
  getToolByName,
  getToolsByProvider,
  type AIToolInfo,
  type PatternMatch,
} from "./patterns.js";

// Detector
export {
  detectFromMessage,
  detectFromFiles,
  detectAIAssistance,
  toAIAssistance,
  analyzeCommitHistory,
  getAIAssistanceStats,
  getRegisteredTools,
  type DetectionResult,
  type DetectionOptions,
} from "./detector.js";
