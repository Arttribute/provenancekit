"use client";

import React from "react";
import { Database, MapPin, Hash, ExternalLink } from "lucide-react";
import { LicenseChip } from "../primitives/license-chip";
import { getLicenseSafe } from "../../lib/extensions";
import type { Resource } from "@provenancekit/eaa-types";

interface ResourceCardProps {
  resource: Resource;
}

export function ResourceCard({ resource }: ResourceCardProps) {
  const cid = resource.address?.ref;
  const license = getLicenseSafe(resource);
  const location = resource.locations?.[0];

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
