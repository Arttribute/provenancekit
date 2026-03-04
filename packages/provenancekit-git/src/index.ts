/**
 * @provenancekit/git
 *
 * Git integration for ProvenanceKit - track commits, analyze blame,
 * detect AI assistance, and integrate with GitHub.
 *
 * @example
 * ```typescript
 * import {
 *   recordCommit,
 *   analyzeBlame,
 *   detectAIAssistance,
 *   withGitCommit,
 * } from "@provenancekit/git";
 *
 * // Record a commit as provenance
 * const result = await recordCommit({
 *   repoPath: ".",
 *   commitSha: "HEAD",
 *   detectAI: true,
 * });
 *
 * // Analyze blame for contribution weights
 * const blame = await analyzeBlame(".", {
 *   branch: "main",
 *   paths: ["src/**"],
 * });
 *
 * // Get distribution for payments
 * const distribution = blame.toDistribution(
 *   (email) => `mailto:${email}`,
 *   cidRef("bafy...")
 * );
 * ```
 *
 * @packageDocumentation
 */

/*─────────────────────────────────────────────────────────────*\
 | Type Exports                                                 |
\*─────────────────────────────────────────────────────────────*/

export type {
  // Core extension types
  AIAssistance,
  CommitSignature,
  GitExtension,

  // Blame types
  BlameLine,
  FileBlame,
  AuthorContribution,
  BlameAnalysis,
  BlameAnalysisOptions,

  // Commit types
  CommitInfo,
  CommitFile,
  RecordCommitResult,
  RecordCommitOptions,

  // Hook types
  GitHookType,
  GitHookConfig,
  GeneratedHook,

  // GitHub types
  GitHubRepo,
  GitHubPullRequest,
  GitHubReview,
  PRProvenanceResult,

  // Error types
  GitErrorCode,
} from "./types.js";

export { GIT_NAMESPACE, GitError } from "./types.js";

/*─────────────────────────────────────────────────────────────*\
 | Extension Exports                                            |
\*─────────────────────────────────────────────────────────────*/

export {
  // Extension helpers
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

  // Factory functions
  createCommitAction,
  normalizeRepositoryUrl,
  parseRepositoryId,
} from "./extension.js";

/*─────────────────────────────────────────────────────────────*\
 | AI Detection Exports                                         |
\*─────────────────────────────────────────────────────────────*/

export {
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

  // Types
  type AIToolInfo,
  type PatternMatch,
  type DetectionResult,
  type DetectionOptions,
} from "./ai/index.js";

/*─────────────────────────────────────────────────────────────*\
 | Tracker Exports                                              |
\*─────────────────────────────────────────────────────────────*/

export {
  // Blame analysis
  analyzeBlame,
  analyzeFileBlame,
  getTopContributors,
  formatBlameAnalysis,
  DEFAULT_IGNORE_PATTERNS,

  // Commit tracking
  getCommitInfo,
  getCommitHistory,
  recordCommit,
  recordCommits,

  // Git hooks
  generateHook,
  installHook,
  uninstallHook,
  initializeHooks,
  checkHooksInstalled,
} from "./tracker/index.js";

/*─────────────────────────────────────────────────────────────*\
 | GitHub Integration Exports                                   |
\*─────────────────────────────────────────────────────────────*/

export {
  // URL parsing
  parseGitHubUrl,
  buildGitHubUrl,

  // PR tracking
  getPullRequest,
  getPullRequestReviews,
  getPullRequestCommits,
  recordPullRequest,

  // Utilities
  checkAuthentication,
  githubEntityId,
  extractPRNumber,

  // Types
  type GitHubClient,
} from "./integrations/github.js";
