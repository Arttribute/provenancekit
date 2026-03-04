/**
 * Formatting utilities for ProvenanceKit UI components.
 * All functions are pure (no side effects) and null-safe.
 */

/** Truncate a CID to `prefix...suffix` format */
export function formatCid(cid: string | undefined | null, prefixLen = 6, suffixLen = 4): string {
  if (!cid) return "";
  if (cid.length <= prefixLen + suffixLen + 3) return cid;
  return `${cid.slice(0, prefixLen)}...${cid.slice(-suffixLen)}`;
}

/** Format an ISO 8601 date string to a human-readable relative string */
export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diff = now - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    if (months < 12) return `${months}mo ago`;
    return `${years}y ago`;
  } catch {
    return iso;
  }
}

/** Format an ISO 8601 date to absolute display string */
export function formatDateAbsolute(iso: string | undefined | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Format basis points (0–10000) as a human-readable percentage string.
 * @example formatBps(7500) → "75%"
 */
export function formatBps(bps: number | undefined | null): string {
  if (bps == null) return "0%";
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

/** Format an EAA entity role for display */
export function formatRole(role: string | undefined | null): string {
  if (!role) return "Unknown";
  // Strip ext: prefix and @version suffix from extension roles
  const clean = role.replace(/^ext:/, "").replace(/@[\d.]+$/, "");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/** Format an EAA action type for display */
export function formatActionType(type: string | undefined | null): string {
  if (!type) return "Unknown";
  const clean = type
    .replace(/^ext:/, "")
    .replace(/@[\d.]+$/, "")
    .replace(/[.:]/g, " ");
  return clean
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Format a chain ID to a human-readable chain name */
export function formatChainName(chainId: number | undefined | null): string {
  if (chainId == null) return "Unknown chain";
  const names: Record<number, string> = {
    1: "Ethereum",
    10: "Optimism",
    137: "Polygon",
    8453: "Base",
    42161: "Arbitrum",
    84532: "Base Sepolia",
    11155111: "Sepolia",
  };
  return names[chainId] ?? `Chain ${chainId}`;
}

/** Format a transaction hash for display (truncated) */
export function formatTxHash(hash: string | undefined | null): string {
  return formatCid(hash, 8, 6);
}

/** Format bytes to human-readable size */
export function formatBytes(bytes: number | undefined | null): string {
  if (bytes == null || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
