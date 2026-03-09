import type { Metadata } from "next";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingCTAButton } from "@/components/auth/landing-cta-button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const baseUrl = "https://provenancekit.com";

export const metadata: Metadata = {
  title:
    "ProvenanceKit — Open Source Content Provenance Toolkit for Human-AI Works",
  description:
    "Open-source toolkit for Human-AI content provenance. Record, verify, and communicate how content was created — onchain anchoring, C2PA support, and programmable attribution.",
  alternates: { canonical: baseUrl },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${baseUrl}/#website`,
      url: baseUrl,
      name: "ProvenanceKit",
      description:
        "Open source content provenance toolkit for Human-AI works. Onchain anchoring, C2PA, programmable attribution.",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate:
            "https://docs.provenancekit.com/search?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${baseUrl}/#software`,
      name: "ProvenanceKit",
      url: baseUrl,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Node.js",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description:
        "Open-source toolkit for recording and verifying how Human-AI content was created. Onchain anchoring, C2PA support, privacy extensions, and programmable attribution.",
      keywords:
        "content provenance, AI provenance, Human-AI, content attribution, onchain, C2PA, EAA",
      author: {
        "@type": "Organization",
        name: "ProvenanceKit",
        url: baseUrl,
      },
      sameAs: [
        "https://github.com/Arttribute/provenancekit",
        "https://docs.provenancekit.com",
      ],
    },
    {
      "@type": "Organization",
      "@id": `${baseUrl}/#organization`,
      name: "ProvenanceKit",
      url: baseUrl,
      logo: { "@type": "ImageObject", url: `${baseUrl}/og-image.png` },
      sameAs: [
        "https://github.com/Arttribute/provenancekit",
        "https://docs.provenancekit.com",
      ],
    },
  ],
};

export default async function RootPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ─── Scroll-aware nav (landing only) ───────────────────────── */}
      <LandingNav />

      {/* ─── Hero (white bg) ───────────────────────────────────────── */}
      <section className="relative pt-20 pb-0 overflow-hidden bg-white">
        {/* Grid — slightly more visible */}
        <div
          className="absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(59 130 246) 1px, transparent 1px), linear-gradient(90deg, rgb(59 130 246) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        {/* Soft glows */}
        <div className="absolute top-0 right-1/4 w-[700px] h-[420px] bg-blue-50/60 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-20 left-0 w-[500px] h-[350px] bg-slate-100/50 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 w-[600px] h-[200px] bg-indigo-50/35 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-[1fr_480px] gap-12 lg:gap-16 items-end">
            {/* Left: copy */}
            <div className="pt-12 pb-24 lg:pb-28">
              <p className="text-[11px] font-mono text-blue-600 tracking-[0.18em] uppercase mb-6">
                Content provenance
              </p>
              <h1 className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold leading-[0.92] tracking-tight mb-7 text-slate-900">
                Verifiable
                <br />
                records of <br /> how it was
                <br />
                <span className="text-blue-600">made.</span>
              </h1>
              <p className="text-base text-slate-500 max-w-[420px] leading-relaxed mb-10">
                A toolkit for creators and platforms to record and communicate
                how content was created, building transparency and trust with
                audiences.
              </p>
              <div className="flex flex-wrap gap-3">
                <LandingCTAButton />
                <Link
                  href="https://docs.provenancekit.com"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Read the docs
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Right: Provenance card over wildlife scene */}
            <div className="hidden lg:flex items-end justify-center pb-0">
              <ProvenanceCardHero />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Anchor bar ────────────────────────────────────────────── */}
      <section id="learn-more" className="bg-blue-600 border-b border-blue-700">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-5 grid grid-cols-3 divide-x divide-blue-500/50">
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
          ].map(({ label, sub }) => (
            <div key={label} className="px-6 first:pl-0 last:pr-0">
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-blue-200 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── The food label moment ──────────────────────────────────── */}
      <section className="relative py-28 lg:py-40 px-6 lg:px-12 bg-white overflow-hidden">
        {/* Grid — same language as hero */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(59 130 246) 1px, transparent 1px), linear-gradient(90deg, rgb(59 130 246) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        {/* Soft blue glow */}
        <div className="absolute top-0 left-1/3 w-[800px] h-[400px] bg-blue-50/70 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-indigo-50/40 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-[5fr_4fr] gap-12 lg:gap-16 items-center">
          <h2
            className="text-[clamp(2.4rem,5vw,5.5rem)] font-bold leading-[0.92] tracking-tight whitespace-nowrap"
            style={{ color: "#d1d5db" }}
          >
            Trust is built
            <br />
            on knowing
            <br />
            <span className="text-slate-900">
              where something
              <br />
              comes from.
            </span>
          </h2>
          <p className="text-lg text-slate-500 leading-relaxed">
            Digital content is created through many steps. Human input, software
            tools, and sometimes AI models shape the final result across drafts,
            edits, and remixes.
            <br />
            <br />
            Without a record of that process, it becomes difficult to see how
            something was made, who contributed, and where responsibility lies.
            <br />
            <br />
            ProvenanceKit records the chain of creation so content can be
            understood, verified, and trusted.
          </p>
        </div>
      </section>

      {/* ─── Full creation lineage ──────────────────────────────────── */}
      <section className="py-28 lg:py-36 px-6 lg:px-12 bg-white border-t border-blue-100/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <WorkflowDiagram />
          <div>
            <p className="text-[11px] font-mono text-blue-600 tracking-[0.18em] uppercase mb-6">
              Complete lineage
            </p>
            <h2 className="text-[clamp(1.7rem,3.8vw,2.9rem)] font-bold leading-[0.95] tracking-tight mb-6">
              Granular capture
              <br />
              of the full creation
              <br />
              process.
            </h2>
            <p className="text-slate-500 text-base leading-relaxed mb-8">
              ProvenanceKit captures the inputs and outputs at each step, the AI
              models and tools involved, and the people and organisations
              responsible. Granular enough for real attribution, not just a
              checkbox.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  dot: "bg-sky-400",
                  label: "Entities",
                  desc: "Authors, AI models, orgs",
                },
                {
                  dot: "bg-violet-500",
                  label: "Actions",
                  desc: "Generation, editing, remixing",
                },
                {
                  dot: "bg-yellow-400",
                  label: "Resources",
                  desc: "Every input and output",
                },
                {
                  dot: "bg-emerald-400",
                  label: "Attribution",
                  desc: "Contribution linked to output",
                },
              ].map(({ dot, label, desc }) => (
                <div key={label} className="flex items-start gap-2.5">
                  <span
                    className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${dot}`}
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {label}
                    </p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Onchain — two vibrant full-bleed blocks ────────────────── */}
      <section className="border-t border-blue-100/60 overflow-hidden">
        <div className="grid lg:grid-cols-2">
          {/* Block 1: Blue — onchain proof */}
          <div className="relative bg-gradient-to-br from-blue-600 to-blue-800 px-12 py-20 lg:px-16 lg:py-24 flex flex-col min-h-[460px]">
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
            <div className="relative flex flex-col flex-1">
              <p className="text-[11px] font-mono text-blue-300 tracking-[0.18em] uppercase mb-10">
                Onchain provenance
              </p>
              <h2
                className="text-[clamp(2rem,4vw,3.8rem)] font-bold leading-[0.92] tracking-tight mb-auto"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Every step,
                <br />
                anchored
                <br />
                <span className="text-white">onchain.</span>
              </h2>
              <p className="text-blue-100 text-base leading-relaxed mt-10 max-w-sm">
                Every creation step is independently anchored. Immutable,
                timestamped to the block, and verifiable by anyone. No server or
                central authority required.
              </p>
            </div>
          </div>

          {/* Block 2: Yellow — active rights and revenue */}
          <div className="relative bg-gradient-to-br from-yellow-200 to-yellow-300 px-12 py-20 lg:px-16 lg:py-24 flex flex-col min-h-[460px]">
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "linear-gradient(rgb(0 0 0) 1px, transparent 1px), linear-gradient(90deg, rgb(0 0 0) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
            <div className="relative flex flex-col flex-1">
              <p className="text-[11px] font-mono text-yellow-700 tracking-[0.18em] uppercase mb-10">
                Programmable rights
              </p>
              <h2
                className="text-[clamp(2rem,4vw,3.8rem)] font-bold leading-[0.92] tracking-tight"
                style={{ color: "rgba(0,0,0,0.18)" }}
              >
                Provenance is
                <br />
                not a static
                <br />
                <span className="text-slate-900">document.</span>
              </h2>
              <p className="text-yellow-950 text-base leading-relaxed mt-10 max-w-sm">
                It is an active layer of rights and rewards. Licensing enforces
                itself. Attribution routes automatically. Revenue reaches every
                contributor.
              </p>
              <div className="mt-auto pt-10">
                <LandingCTAButton />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Programmable ───────────────────────────────────────────── */}
      <section className="relative py-28 lg:py-40 px-6 lg:px-12 bg-white overflow-hidden border-t border-blue-100/50">
        {/* Grid — same language as hero */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(59 130 246) 1px, transparent 1px), linear-gradient(90deg, rgb(59 130 246) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-blue-50/60 rounded-full blur-[130px] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <p className="text-[11px] font-mono text-blue-600 tracking-[0.18em] uppercase mb-6">
              Programmable provenance
            </p>
            <h2 className="text-[clamp(2.2rem,5vw,4rem)] font-bold leading-[0.92] tracking-tight">
              Provenance that
              <br />
              does something.
            </h2>
            <p className="mt-6 text-base text-slate-500 leading-relaxed">
              Onchain records are programmable. Provenance becomes the layer
              that governs rights, attribution, and revenue.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                gradient: "from-blue-500 to-blue-700",
                number: "01",
                title: "Permissioning",
                headline: "Provenance becomes the credential.",
                desc: "Gate access based on verified contribution history. License enforcement flows from the same record that documents creation.",
              },
              {
                gradient: "from-violet-500 to-violet-700",
                number: "02",
                title: "Attribution",
                headline: "Credit follows contribution.",
                desc: "Every participant gets credit: authors, AI tools, dataset owners. Contribution weights are permanent and onchain.",
              },
              {
                gradient: "from-emerald-500 to-emerald-700",
                number: "03",
                title: "Revenue",
                headline: "Revenue follows contribution.",
                desc: "Earnings route to contributors proportional to their verified contribution. Tracked and distributed automatically.",
              },
            ].map(({ gradient, number, title, headline, desc }) => (
              <div
                key={title}
                className="rounded-2xl overflow-hidden border border-slate-200/60 flex flex-col group"
              >
                <div
                  className={`relative bg-gradient-to-br ${gradient} p-8 overflow-hidden`}
                >
                  <div
                    className="absolute inset-0 opacity-[0.1]"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)",
                      backgroundSize: "32px 32px",
                    }}
                  />
                  <div className="relative transition-transform duration-300 origin-bottom-left group-hover:scale-[1.06]">
                    <span className="text-[10px] font-mono text-white/40 tracking-[0.2em]">
                      {number}
                    </span>
                    <h3 className="text-2xl font-bold text-white mt-2 mb-2 leading-tight">
                      {title}
                    </h3>
                    <p className="text-sm text-white/80 font-medium leading-snug">
                      {headline}
                    </p>
                  </div>
                </div>
                <div className="p-7 flex flex-col flex-1 bg-white">
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Developer section ──────────────────────────────────────── */}
      <section className="py-28 lg:py-36 px-6 lg:px-12 bg-blue-50/40 border-t border-blue-100/60">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <p className="text-[11px] font-mono text-blue-600 tracking-[0.18em] uppercase mb-6">
              For developers
            </p>
            <h2 className="text-[clamp(1.8rem,4vw,3.2rem)] font-bold leading-[0.93] tracking-tight mb-6">
              Add provenance
              <br />
              to anything.
            </h2>
            <p className="text-slate-500 text-base leading-relaxed mb-8">
              A simple SDK for Node.js and TypeScript. <br />
              Record creation steps with onchain provenance.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="https://docs.provenancekit.com/quickstart"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-sm font-semibold text-white transition-colors"
              >
                Quickstart <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="https://docs.provenancekit.com"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                View docs
              </Link>
            </div>
          </div>
          <CodeBlock />
        </div>
      </section>

      {/* ─── Use cases ──────────────────────────────────────────────── */}
      <section className="py-28 px-6 lg:px-12 bg-white border-t border-blue-100/50">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-xl mb-14">
            <p className="text-[11px] font-mono text-blue-600 tracking-[0.18em] uppercase mb-6">
              Built for every workflow
            </p>
            <h2 className="text-[clamp(1.7rem,3.8vw,2.9rem)] font-bold leading-[0.95] tracking-tight">
              Everywhere humans
              <br />
              and AI create together.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: "AI platforms",
                desc: "A verifiable record of every generation step, embedded in your product.",
                accent: "border-t-blue-500",
              },
              {
                title: "Content platforms",
                desc: "Every piece of content carries a verifiable label. Remix chains tracked with full attribution.",
                accent: "border-t-violet-500",
              },
              {
                title: "Enterprise AI",
                desc: "Audit trails for AI-generated outputs. Verifiable, and built to support compliance.",
                accent: "border-t-emerald-500",
              },
              {
                title: "Creative tools",
                desc: "A tamper-proof credential creators own, proving their contribution to any Human-AI work.",
                accent: "border-t-amber-500",
              },
            ].map(({ title, desc, accent }) => (
              <div
                key={title}
                className={`p-7 rounded-2xl bg-white border border-slate-200 border-t-2 ${accent} hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`}
              >
                <h3 className="text-base font-bold mb-2.5 text-slate-900">
                  {title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ──────────────────────────────────────────────── */}
      <section className="py-32 px-6 lg:px-12 bg-[#080d18] text-white relative overflow-hidden border-t border-slate-800">
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(59 130 246) 1px, transparent 1px), linear-gradient(90deg, rgb(59 130 246) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[450px] bg-blue-600/12 rounded-full blur-[160px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-[clamp(2.2rem,5.5vw,5rem)] font-bold leading-[0.90] tracking-tight mb-6">
            Start recording
            <br />
            provenance today.
          </h2>
          <p className="text-slate-400 text-base mb-12 max-w-lg mx-auto leading-relaxed">
            Add verifiable provenance to your AI or content workflow.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <LandingCTAButton variant="outline-light" />
            <Link
              href="https://docs.provenancekit.com"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-white/15 text-sm text-slate-200 hover:bg-white/10 transition-colors"
            >
              Read the docs <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────── */}
      <footer className="bg-[#080d18] px-6 lg:px-12 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-slate-700">
            <span className="text-white font-bold text-[8px]">Pr</span>
          </div>
          <span>© 2026 ProvenanceKit</span>
        </div>
        <div className="flex gap-6">
          <a
            href="https://docs.provenancekit.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-300 transition-colors"
          >
            Docs
          </a>
          <a
            href="https://github.com/Arttribute/provenancekit"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-300 transition-colors"
          >
            GitHub
          </a>
          <a href="/privacy" className="hover:text-slate-300 transition-colors">
            Privacy
          </a>
        </div>
      </footer>
    </div>
  );
}

/* ─── Provenance Card Hero (wildlife scene) ─────────────────────── */

function ProvenanceCardHero() {
  return (
    <div className="relative w-full max-w-[460px]">
      {/* Fade bottom — just a gentle feather, not a full white fade */}
      <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-white/60 to-transparent z-10 pointer-events-none" />

      <div className="rounded-t-2xl overflow-hidden border border-slate-200/80 shadow-2xl shadow-blue-100/80">
        {/* Photo scene */}
        <div className="relative h-64 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-photo.jpg"
            alt="Sunflower against blue sky"
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Squircle badge */}
          <div className="absolute top-3 right-3 h-9 w-9 rounded-[28%] bg-white/90 border border-white/60 flex items-center justify-center shadow-md z-20">
            <span className="text-slate-900 text-[11px] font-bold tracking-tight">
              Pr
            </span>
          </div>
        </div>

        {/* Provenance info */}
        <div className="bg-white border-t border-slate-100">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100">
            <div className="h-8 w-8 rounded-[28%] bg-slate-900 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[10px] font-bold">Pr</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                ProvenanceKit
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                sunflower.png
              </p>
            </div>
          </div>

          <div className="px-5 py-2">
            {[
              { label: "Date", value: "March 8, 2026" },
              { label: "Produced by", value: "Alex Chen" },
              { label: "AI tools used", value: "Midjourney, DALL-E 3" },
              { label: "License", value: "CC BY 4.0" },
              { label: "Verified onchain", value: "0x8f2e…4a1c" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between py-1.5"
              >
                <span className="text-xs text-slate-400">{label}</span>
                <span
                  className={`text-xs font-medium ${
                    label === "Verified onchain"
                      ? "text-emerald-600 font-mono"
                      : "text-slate-700"
                  }`}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Workflow diagram ──────────────────────────────────────────── */

function WorkflowDiagram() {
  const steps = [
    {
      label: "Human prompt",
      sub: "Initial creative brief",
      dot: "bg-sky-400",
      glow: "shadow-sky-200",
      border: "border-sky-200",
    },
    {
      label: "GPT-4o generation",
      sub: "Action · ext:ai@1.0.0",
      dot: "bg-violet-500",
      glow: "shadow-violet-200",
      border: "border-violet-200",
    },
    {
      label: "Draft v1",
      sub: "Resource · content hash recorded",
      dot: "bg-yellow-400",
      glow: "shadow-yellow-200",
      border: "border-yellow-200",
    },
    {
      label: "Human edit and refinement",
      sub: "Action · contribution weighted",
      dot: "bg-violet-500",
      glow: "shadow-violet-200",
      border: "border-violet-200",
    },
    {
      label: "DALL-E 3 illustration",
      sub: "Action · ext:ai@1.0.0",
      dot: "bg-violet-500",
      glow: "shadow-violet-200",
      border: "border-violet-200",
    },
    {
      label: "Final output",
      sub: "Resource · anchored onchain",
      dot: "bg-emerald-400",
      glow: "shadow-emerald-200",
      border: "border-emerald-200",
    },
  ];

  return (
    <div className="relative bg-white border border-slate-200 rounded-2xl p-8 shadow-xl shadow-slate-200/60 overflow-hidden">
      {/* Soft ambient glows */}
      <div className="absolute top-4 left-4 w-32 h-32 bg-sky-100/50 rounded-full blur-[60px] pointer-events-none" />
      <div className="absolute bottom-8 right-4 w-40 h-40 bg-violet-100/30 rounded-full blur-[70px] pointer-events-none" />
      <div className="absolute bottom-4 left-1/2 w-28 h-28 bg-emerald-100/30 rounded-full blur-[50px] pointer-events-none" />
      <p className="relative text-[10px] font-mono text-slate-400 tracking-widest uppercase mb-6">
        Creation workflow
      </p>
      <div className="relative flex flex-col">
        {steps.map((step, i) => (
          <div key={step.label}>
            <div className="flex items-center gap-4">
              <div
                className={`flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center border ${step.border}`}
              >
                <div className={`h-2.5 w-2.5 rounded-full ${step.dot}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {step.label}
                </p>
                <p className="text-xs text-slate-400 font-mono">{step.sub}</p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="ml-[15px] w-px h-4 bg-slate-200 my-0.5" />
            )}
          </div>
        ))}
      </div>
      <div className="relative mt-6 pt-5 border-t border-slate-100 flex items-center gap-3">
        <div className="h-6 w-6 rounded-md bg-slate-900 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[8px] font-bold">Pr</span>
        </div>
        <p className="text-xs text-slate-500">
          Full chain anchored onchain{" "}
          <span className="text-slate-800 font-mono font-semibold">
            bundleId: 0x8f2e…4a1c
          </span>
        </p>
      </div>
    </div>
  );
}

/* ─── Code block ────────────────────────────────────────────────── */

function CodeBlock() {
  return (
    <div className="rounded-2xl overflow-hidden border border-blue-100 shadow-sm shadow-blue-50">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-blue-100 bg-blue-50/50">
        <span className="h-3 w-3 rounded-full bg-red-400/70" />
        <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
        <span className="h-3 w-3 rounded-full bg-green-400/70" />
        <span className="ml-3 text-xs text-slate-400 font-mono">
          record-provenance.ts
        </span>
      </div>
      <pre className="p-5 text-xs leading-relaxed overflow-x-auto font-mono bg-slate-950">
        <code>
          <span className="text-slate-500">{"// Initialize the SDK\n"}</span>
          <span className="text-blue-400">{"import"}</span>
          <span className="text-slate-200">{" { ProvenanceKit } "}</span>
          <span className="text-blue-400">{"from"}</span>
          <span className="text-emerald-400">
            {' "@provenancekit/sdk"\n\n'}
          </span>
          <span className="text-blue-400">{"const"}</span>
          <span className="text-slate-200">{" pk = "}</span>
          <span className="text-yellow-300">{"new"}</span>
          <span className="text-slate-200">
            {" ProvenanceKit({ storage, chain })\n\n"}
          </span>
          <span className="text-slate-500">
            {"// Record a Human-AI creation step\n"}
          </span>
          <span className="text-blue-400">{"const"}</span>
          <span className="text-slate-200">{" { bundleId } = "}</span>
          <span className="text-blue-400">{"await"}</span>
          <span className="text-slate-200">{" pk.record({\n"}</span>
          <span className="text-slate-200">{"  action: {\n"}</span>
          <span className="text-slate-200">{"    type: "}</span>
          <span className="text-emerald-400">{"'generation'"}</span>
          <span className="text-slate-200">{",\n"}</span>
          <span className="text-slate-200">{"    tool: "}</span>
          <span className="text-emerald-400">{"'gpt-4o'"}</span>
          <span className="text-slate-200">{",\n"}</span>
          <span className="text-slate-200">
            {"    extensions: [aiExtension({ model: "}
          </span>
          <span className="text-emerald-400">{"'gpt-4o'"}</span>
          <span className="text-slate-200">{" })]\n"}</span>
          <span className="text-slate-200">{"  },\n"}</span>
          <span className="text-slate-200">
            {"  inputs:  [promptResource],\n"}
          </span>
          <span className="text-slate-200">
            {"  outputs: [generatedResource],\n"}
          </span>
          <span className="text-slate-200">
            {"  agents:  [{ id: userId, role: "}
          </span>
          <span className="text-emerald-400">{"'author'"}</span>
          <span className="text-slate-200">{" }]\n"}</span>
          <span className="text-slate-200">{"});\n\n"}</span>
          <span className="text-slate-500">{"// Anchor to chain\n"}</span>
          <span className="text-blue-400">{"await"}</span>
          <span className="text-slate-200">{" pk.anchor(bundleId);"}</span>
        </code>
      </pre>
    </div>
  );
}
