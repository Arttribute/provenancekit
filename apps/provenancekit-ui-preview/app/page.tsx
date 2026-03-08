import Link from "next/link";

const previews = [
  { href: "/badge", label: "ProvenanceBadge", description: "'Pr' squircle tag with C2PA-style credentials popover — floating and inline variants" },
  { href: "/graph", label: "ProvenanceGraph", description: "Interactive provenance DAG — drag nodes, pan, zoom. Light and dark mode." },
  { href: "/tracker", label: "ProvenanceTracker", description: "Real-time session action feed with auto-polling" },
  { href: "/bundle", label: "ProvenanceBundleView", description: "Tabbed provenance record — Resources, Actions, Entities, Attribution" },
  { href: "/search", label: "ProvenanceSearch", description: "CID + file upload search with similarity results" },
  { href: "/primitives", label: "Primitives", description: "RoleBadge, EntityAvatar, ContributionBar, CidDisplay, LicenseChip" },
];

export default function IndexPage() {
  return (
    <div style={{ padding: "3rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--pk-foreground)" }}>
        @provenancekit/ui Preview
      </h1>
      <p style={{ color: "var(--pk-muted-foreground)", marginBottom: "2rem", fontSize: "0.9rem" }}>
        Interactive component previews. Append <code>?dark=1</code> to any URL for dark mode.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
        {previews.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            style={{
              display: "block",
              padding: "1.25rem",
              borderRadius: "0.75rem",
              border: "1px solid var(--pk-surface-border)",
              background: "var(--pk-surface-muted)",
              textDecoration: "none",
              transition: "border-color 0.15s",
            }}
          >
            <div style={{ fontWeight: 600, color: "var(--pk-foreground)", marginBottom: "0.25rem" }}>
              {p.label}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--pk-muted-foreground)" }}>
              {p.description}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
