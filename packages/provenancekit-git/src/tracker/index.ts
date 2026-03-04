/**
 * Git tracking module for @provenancekit/git.
 *
 * Provides tools for tracking commits, analyzing blame,
 * and generating git hooks for automatic provenance recording.
 *
 * @packageDocumentation
 */

// Blame analysis
export {
  analyzeBlame,
  analyzeFileBlame,
  getTopContributors,
  formatBlameAnalysis,
  DEFAULT_IGNORE_PATTERNS,
} from "./blame.js";

// Commit tracking
export {
  getCommitInfo,
  getCommitHistory,
  recordCommit,
  recordCommits,
} from "./commit.js";

// Git hooks
export {
  generateHook,
  installHook,
  uninstallHook,
  initializeHooks,
  checkHooksInstalled,
} from "./hooks.js";
