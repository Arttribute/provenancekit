// @provenancekit/ui
// Standard UI components for displaying provenance information

// ── Provider & Context ──────────────────────────────────────
export {
  ProvenanceKitProvider,
  useProvenanceKit,
  type ProvenanceKitProviderProps,
  type ProvenanceKitTheme,
} from "./context/provenance-kit-provider";

// ── Hooks ───────────────────────────────────────────────────
export { useProvenanceGraph, type UseProvenanceGraphResult } from "./hooks/use-provenance-graph";
export { useProvenanceBundle, type UseProvenanceBundleResult } from "./hooks/use-provenance-bundle";
export {
  useSessionProvenance,
  type UseSessionProvenanceResult,
} from "./hooks/use-session-provenance";
export { useDistribution, type UseDistributionResult } from "./hooks/use-distribution";

// ── Utilities ────────────────────────────────────────────────
export { cn } from "./lib/utils";
export {
  formatCid,
  formatDate,
  formatDateAbsolute,
  formatBps,
  formatRole,
  formatActionType,
  formatChainName,
  formatTxHash,
  formatBytes,
} from "./lib/format";
export {
  getAIToolSafe,
  getAIAgentSafe,
  getLicenseSafe,
  getContribSafe,
  getOnchainSafe,
  getVerificationSafe,
  getWitnessSafe,
  bundleHasAI,
  getPrimaryCreator,
} from "./lib/extensions";

// ── Primitive Components ─────────────────────────────────────
export { EntityAvatar } from "./components/primitives/entity-avatar";
export { RoleBadge } from "./components/primitives/role-badge";
export { VerificationIndicator } from "./components/primitives/verification-indicator";
export { LicenseChip } from "./components/primitives/license-chip";
export { Timestamp } from "./components/primitives/timestamp";
export { CidDisplay } from "./components/primitives/cid-display";
export { ContributionBar } from "./components/primitives/contribution-bar";

// ── Badge Components ─────────────────────────────────────────
export { ProvenanceBadge, type ProvenanceBadgeProps } from "./components/badge/provenance-badge";
export { ProvenancePopover } from "./components/badge/provenance-popover";

// ── Graph Components ─────────────────────────────────────────
export {
  ProvenanceGraph,
  type ProvenanceGraphProps,
} from "./components/graph/provenance-graph";

// ── Bundle View ──────────────────────────────────────────────
export { EntityCard } from "./components/bundle/entity-card";
export { ActionCard } from "./components/bundle/action-card";
export { ResourceCard } from "./components/bundle/resource-card";
export { AttributionList } from "./components/bundle/attribution-list";
export { ProvenanceBundleView } from "./components/bundle/provenance-bundle-view";

// ── Tracker ──────────────────────────────────────────────────
export { ProvenanceTracker, type ProvenanceTrackerProps } from "./components/tracker/provenance-tracker";

// ── Search ───────────────────────────────────────────────────
export { ProvenanceSearch, type ProvenanceSearchProps } from "./components/search/provenance-search";
export { FileUploadZone } from "./components/search/file-upload-zone";

// ── Extension Views ──────────────────────────────────────────
export { AIExtensionView } from "./components/extensions/ai-extension-view";
export { LicenseExtensionView } from "./components/extensions/license-extension-view";
export { OnchainExtensionView } from "./components/extensions/onchain-extension-view";
export { VerificationView } from "./components/extensions/verification-view";
export { ContribExtensionView } from "./components/extensions/contrib-extension-view";

// ── File Provenance ───────────────────────────────────────────
export {
  FileProvenanceTag,
  type FileProvenanceTagProps,
} from "./components/provenance/file-provenance-tag";
