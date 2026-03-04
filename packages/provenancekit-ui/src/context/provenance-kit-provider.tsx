"use client";

import React, { createContext, useContext, useMemo } from "react";
import { ProvenanceKit } from "@provenancekit/sdk";

export interface ProvenanceKitTheme {
  nodeResourceColor?: string;
  nodeActionColor?: string;
  nodeEntityColor?: string;
  roleHumanColor?: string;
  roleAiColor?: string;
  roleOrgColor?: string;
  verifiedColor?: string;
  partialColor?: string;
  failedColor?: string;
  badgeBg?: string;
  badgeFg?: string;
  radius?: string;
}

interface ProvenanceKitContextValue {
  pk: ProvenanceKit | null;
}

const ProvenanceKitContext = createContext<ProvenanceKitContextValue>({ pk: null });

export interface ProvenanceKitProviderProps {
  children: React.ReactNode;
  /** Pre-configured SDK instance (takes priority over apiUrl/apiKey) */
  pk?: ProvenanceKit;
  /** API URL for auto-creating SDK instance */
  apiUrl?: string;
  /** API key for auto-creating SDK instance */
  apiKey?: string;
  /** CSS custom property overrides applied as inline styles */
  theme?: ProvenanceKitTheme;
}

function themeToCssVars(theme: ProvenanceKitTheme): React.CSSProperties {
  const map: Record<string, string | undefined> = {
    "--pk-node-resource": theme.nodeResourceColor,
    "--pk-node-action": theme.nodeActionColor,
    "--pk-node-entity": theme.nodeEntityColor,
    "--pk-role-human": theme.roleHumanColor,
    "--pk-role-ai": theme.roleAiColor,
    "--pk-role-org": theme.roleOrgColor,
    "--pk-verified": theme.verifiedColor,
    "--pk-partial": theme.partialColor,
    "--pk-failed": theme.failedColor,
    "--pk-badge-bg": theme.badgeBg,
    "--pk-badge-fg": theme.badgeFg,
    "--pk-radius": theme.radius,
  };
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(map)) {
    if (value != null) result[key] = value;
  }
  return result as React.CSSProperties;
}

export function ProvenanceKitProvider({
  children,
  pk: pkProp,
  apiUrl,
  apiKey,
  theme,
}: ProvenanceKitProviderProps) {
  const pk = useMemo<ProvenanceKit | null>(() => {
    if (pkProp) return pkProp;
    if (apiUrl) {
      return new ProvenanceKit({ baseUrl: apiUrl, apiKey });
    }
    return null;
  }, [pkProp, apiUrl, apiKey]);

  const style = theme ? themeToCssVars(theme) : undefined;

  return (
    <ProvenanceKitContext.Provider value={{ pk }}>
      {style ? <div style={style}>{children}</div> : children}
    </ProvenanceKitContext.Provider>
  );
}

export function useProvenanceKit(): ProvenanceKitContextValue {
  return useContext(ProvenanceKitContext);
}
