import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ProvenanceKit — The complete record of how it was made.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: "#080d18",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(59,130,246,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.08) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

        {/* Blue glow left */}
        <div
          style={{
            position: "absolute",
            top: "-80px",
            left: "-80px",
            width: "520px",
            height: "520px",
            borderRadius: "50%",
            background: "rgba(37,99,235,0.18)",
            filter: "blur(120px)",
          }}
        />

        {/* Blue glow right */}
        <div
          style={{
            position: "absolute",
            bottom: "-60px",
            right: "120px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "rgba(99,102,241,0.12)",
            filter: "blur(100px)",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            padding: "64px 72px",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  color: "white",
                  fontSize: "14px",
                  fontWeight: "800",
                  letterSpacing: "-0.5px",
                }}
              >
                PK
              </span>
            </div>
            <span
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: "18px",
                fontWeight: "500",
                letterSpacing: "-0.2px",
              }}
            >
              ProvenanceKit
            </span>
          </div>

          {/* Headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div
              style={{
                fontSize: "72px",
                fontWeight: "800",
                lineHeight: "0.92",
                letterSpacing: "-2px",
                color: "rgba(255,255,255,0.22)",
              }}
            >
              The complete record
              <br />
              <span style={{ color: "white" }}>of how it was made.</span>
            </div>
            <div
              style={{
                fontSize: "22px",
                color: "rgba(255,255,255,0.45)",
                fontWeight: "400",
                lineHeight: "1.5",
                maxWidth: "620px",
              }}
            >
              Universal provenance for Human-AI created works.
              Every contributor, every tool, every transformation.
            </div>
          </div>

          {/* Bottom bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "32px",
            }}
          >
            {["Open standard", "Onchain by default", "Privacy by design"].map(
              (label) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#3b82f6",
                    }}
                  />
                  <span
                    style={{
                      color: "rgba(255,255,255,0.35)",
                      fontSize: "15px",
                      fontWeight: "500",
                    }}
                  >
                    {label}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
