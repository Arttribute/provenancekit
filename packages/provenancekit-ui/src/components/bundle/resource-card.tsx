"use client";

import React from "react";
import { Database, MapPin, Hash, ExternalLink, ShieldCheck, AlertTriangle, Brain } from "lucide-react";
import { LicenseChip } from "../primitives/license-chip";
import { getAuthorizationSafe, getGovernanceSafe, getLicenseSafe } from "../../lib/extensions";
import type { Resource } from "@provenancekit/eaa-types";

interface ResourceCardProps {
  resource: Resource;
}

export function ResourceCard({ resource }: ResourceCardProps) {
  const cid = resource.address?.ref;
  const license = getLicenseSafe(resource);
  const authorization = getAuthorizationSafe(resource);
  const governance = getGovernanceSafe(resource);
  const location = resource.locations?.[0];
  const needsReview = governance?.reviewStatus === "review-required" || authorization?.status === "pending" || authorization?.status === "unauthorized";

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(59,130,246,0.2)",
        borderRadius: 12,
        overflow: "hidden",
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(59,130,246,0.1)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
    >
      {/* Blue accent top bar */}
      <div style={{ height: 3, background: "#3b82f6" }} />

      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {/* Icon */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: "rgba(59,130,246,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Database size={16} color="#3b82f6" strokeWidth={2} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Type + size */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              {resource.type && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#3b82f6",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {resource.type}
                </span>
              )}
              {(resource as any).size && (
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  {(resource as any).size < 1024 * 1024
                    ? `${((resource as any).size / 1024).toFixed(1)} KB`
                    : `${((resource as any).size / 1024 / 1024).toFixed(1)} MB`}
                </span>
              )}
              {license && <LicenseChip license={license} />}
            </div>

            {(authorization || governance || license?.aiTraining) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {authorization?.status && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      color: authorization.status === "authorized" ? "#047857" : "#b45309",
                      background: authorization.status === "authorized" ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.12)",
                      border: `1px solid ${authorization.status === "authorized" ? "rgba(16,185,129,0.22)" : "rgba(245,158,11,0.28)"}`,
                      borderRadius: 6,
                      padding: "2px 7px",
                    }}
                    title={authorization.scope}
                  >
                    {authorization.status === "authorized" ? <ShieldCheck size={10} /> : <AlertTriangle size={10} />}
                    {authorization.status}
                  </span>
                )}
                {license?.aiTraining && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      color: license.aiTraining === "reserved" ? "#b91c1c" : "#475569",
                      background: license.aiTraining === "reserved" ? "rgba(239,68,68,0.08)" : "#f8fafc",
                      border: `1px solid ${license.aiTraining === "reserved" ? "rgba(239,68,68,0.22)" : "#e2e8f0"}`,
                      borderRadius: 6,
                      padding: "2px 7px",
                    }}
                  >
                    <Brain size={10} />
                    AI training {license.aiTraining}
                  </span>
                )}
                {governance?.reviewStatus && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      color: needsReview ? "#b45309" : "#047857",
                      background: needsReview ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.08)",
                      border: `1px solid ${needsReview ? "rgba(245,158,11,0.28)" : "rgba(16,185,129,0.22)"}`,
                      borderRadius: 6,
                      padding: "2px 7px",
                    }}
                    title={governance.note}
                  >
                    {needsReview ? <AlertTriangle size={10} /> : <ShieldCheck size={10} />}
                    {governance.reviewStatus.replace(/-/g, " ")}
                  </span>
                )}
              </div>
            )}

            {/* CID */}
            {cid && (
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: "#64748b",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "3px 8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  maxWidth: "100%",
                  marginBottom: 6,
                }}
              >
                <Hash size={9} color="#94a3b8" />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {cid.length > 40 ? `${cid.slice(0, 20)}…${cid.slice(-10)}` : cid}
                </span>
              </div>
            )}

            {/* Location */}
            {location && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                <MapPin size={11} color="#94a3b8" />
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  {location.provider}
                  {location.uri && (
                    <a
                      href={location.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#3b82f6", marginLeft: 4, display: "inline-flex", alignItems: "center", gap: 2 }}
                    >
                      <ExternalLink size={9} />
                    </a>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
