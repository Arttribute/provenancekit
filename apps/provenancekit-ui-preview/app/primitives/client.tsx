"use client";

import {
  RoleBadge,
  EntityAvatar,
  ContributionBar,
  CidDisplay,
  LicenseChip,
  VerificationIndicator,
} from "@provenancekit/ui";
import { PreviewShell } from "../../components/preview-shell";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--pk-muted-foreground)" }}
      >
        {title}
      </h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: "var(--pk-surface-border)",
        margin: "4px 0",
      }}
    />
  );
}

export function PrimitivesPreviewClient() {
  return (
    <PreviewShell className="p-8">
      <div className="space-y-8 max-w-xl">
        <Section title="RoleBadge">
          <RoleBadge role="human" />
          <RoleBadge role="ai" />
          <RoleBadge role="organization" />
          <RoleBadge role="creator" />
          <RoleBadge role="contributor" />
        </Section>

        <Divider />

        <Section title="EntityAvatar">
          {(["xs", "sm", "md", "lg"] as const).map((size) => (
            <div key={size} className="flex flex-col items-center gap-1.5">
              <EntityAvatar role="human" size={size} />
              <span
                className="text-xs"
                style={{ color: "var(--pk-muted-foreground)" }}
              >
                {size}
              </span>
            </div>
          ))}
          <div
            className="w-px h-8"
            style={{ background: "var(--pk-surface-border)" }}
          />
          <EntityAvatar role="ai" size="md" />
          <EntityAvatar role="organization" size="md" />
        </Section>

        <Divider />

        <Section title="ContributionBar">
          <div className="w-full space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span
                  className="text-sm"
                  style={{ color: "var(--pk-foreground)" }}
                >
                  Alice Chen
                </span>
              </div>
              <ContributionBar bps={7000} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span
                  className="text-sm"
                  style={{ color: "var(--pk-foreground)" }}
                >
                  Poetry Service (AI)
                </span>
              </div>
              <ContributionBar bps={2000} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span
                  className="text-sm"
                  style={{ color: "var(--pk-foreground)" }}
                >
                  Source Dataset
                </span>
              </div>
              <ContributionBar bps={1000} />
            </div>
          </div>
        </Section>

        <Divider />

        <Section title="CidDisplay">
          <CidDisplay cid="bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq" />
          {/* <CidDisplay cid="bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq" short /> */}
        </Section>

        <Divider />

        <Section title="LicenseChip">
          <LicenseChip spdxId="MIT" />
          <LicenseChip spdxId="CC-BY-4.0" />
          <LicenseChip spdxId="CC-BY-SA-4.0" />
          <LicenseChip spdxId="CC0-1.0" />
          <LicenseChip spdxId="Apache-2.0" />
        </Section>

        <Divider />

        <Section title="VerificationIndicator">
          <VerificationIndicator status="verified" />
          <VerificationIndicator status="partial" />
          <VerificationIndicator status="unverified" />
          <VerificationIndicator status="failed" />
        </Section>
      </div>
    </PreviewShell>
  );
}
