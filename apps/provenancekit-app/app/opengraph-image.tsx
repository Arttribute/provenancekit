import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ProvenanceKit — Verifiable records of how it was made.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BASE_URL = "https://provenancekit.com";

export default async function Image() {
  // Fetch hero photo to embed directly (avoids Satori external fetch issues)
  let photoSrc: string | undefined;
  try {
    const res = await fetch(`${BASE_URL}/hero-photo.jpg`);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      photoSrc = `data:image/jpeg;base64,${b64}`;
    }
  } catch {
    // no photo — card renders without image
  }

  const infoRows = [
    { label: "Date", value: "March 8, 2026", mono: false, green: false },
    { label: "Produced by", value: "Alex Chen", mono: false, green: false },
    { label: "AI tools used", value: "Midjourney, DALL-E 3", mono: false, green: false },
    { label: "License", value: "CC BY 4.0", mono: false, green: false },
    { label: "Verified onchain", value: "0x8f2e…4a1c", mono: true, green: true },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          position: "relative",
          overflow: "hidden",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Blue grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(59,130,246,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.09) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

        {/* Soft blue glow — top right */}
        <div
          style={{
            position: "absolute",
            top: "-40px",
            right: "140px",
            width: "600px",
            height: "360px",
            borderRadius: "50%",
            background: "rgba(219,234,254,0.65)",
          }}
        />

        {/* Soft glow — left */}
        <div
          style={{
            position: "absolute",
            top: "60px",
            left: "-40px",
            width: "440px",
            height: "300px",
            borderRadius: "50%",
            background: "rgba(241,245,249,0.7)",
          }}
        />

        {/* Main layout */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            padding: "52px 72px 0 72px",
          }}
        >
          {/* ── Logo row ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#0f172a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  color: "white",
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "-0.5px",
                }}
              >
                Pr
              </span>
            </div>
            <span
              style={{
                color: "#64748b",
                fontSize: "17px",
                fontWeight: 500,
                letterSpacing: "-0.2px",
              }}
            >
              ProvenanceKit
            </span>
          </div>

          {/* ── Two-column body ── */}
          <div
            style={{
              display: "flex",
              flex: 1,
              marginTop: "44px",
              gap: "56px",
              alignItems: "flex-start",
            }}
          >
            {/* Left — headline */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                paddingTop: "4px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "#2563eb",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginBottom: "20px",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                Content provenance
              </span>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontSize: "82px",
                  fontWeight: 800,
                  lineHeight: 0.9,
                  letterSpacing: "-3px",
                }}
              >
                <span style={{ color: "#0f172a" }}>Verifiable</span>
                <span style={{ color: "#0f172a" }}>records of</span>
                <span style={{ color: "#0f172a" }}>how it was</span>
                <span style={{ color: "#2563eb" }}>made.</span>
              </div>
            </div>

            {/* Right — provenance card */}
            <div
              style={{
                display: "flex",
                width: "380px",
                flexShrink: 0,
                flexDirection: "column",
                borderRadius: "18px",
                overflow: "hidden",
                border: "1px solid rgba(226,232,240,0.9)",
                background: "white",
                boxShadow:
                  "0 20px 60px rgba(59,130,246,0.10), 0 4px 16px rgba(0,0,0,0.06)",
              }}
            >
              {/* Photo */}
              {photoSrc && (
                <div
                  style={{
                    position: "relative",
                    height: "196px",
                    display: "flex",
                    overflow: "hidden",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoSrc}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  {/* Squircle badge */}
                  <div
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      width: "34px",
                      height: "34px",
                      borderRadius: "28%",
                      background: "rgba(255,255,255,0.92)",
                      border: "1px solid rgba(255,255,255,0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        color: "#0f172a",
                        fontSize: "9px",
                        fontWeight: 800,
                      }}
                    >
                      Pr
                    </span>
                  </div>
                </div>
              )}

              {/* Card header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 18px",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "28%",
                    background: "#0f172a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      color: "white",
                      fontSize: "8px",
                      fontWeight: 800,
                    }}
                  >
                    Pr
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    ProvenanceKit
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#94a3b8",
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    sunflower.png
                  </span>
                </div>
              </div>

              {/* Info rows */}
              <div
                style={{
                  padding: "8px 18px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0px",
                }}
              >
                {infoRows.map(({ label, value, mono, green }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "5px 0",
                    }}
                  >
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                      {label}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: green ? "#16a34a" : "#334155",
                        fontFamily: mono
                          ? "ui-monospace, monospace"
                          : "inherit",
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#2563eb",
            display: "flex",
            alignItems: "stretch",
            height: "68px",
          }}
        >
          {[
            {
              label: "Open standard",
              sub: "EAA · Entity · Action · Attribution",
            },
            {
              label: "Onchain by default",
              sub: "Every record is independently verifiable",
            },
            {
              label: "Privacy by design",
              sub: "Selective disclosure built in",
            },
          ].map(({ label, sub }, i) => (
            <div
              key={label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "0 32px",
                borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.2)" : "none",
              }}
            >
              <span
                style={{
                  color: "white",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                {label}
              </span>
              <span
                style={{
                  color: "rgba(255,255,255,0.65)",
                  fontSize: "11px",
                  marginTop: "2px",
                }}
              >
                {sub}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
