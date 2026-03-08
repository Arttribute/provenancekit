import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingCTAButton } from "@/components/auth/landing-cta-button";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

export default async function RootPage() {
  const user = await getServerUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
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
              <h1 className="text-[clamp(2.2rem,5.5vw,4.5rem)] font-bold leading-[0.92] tracking-tight mb-7 text-slate-900">
                The complete
                <br />
                record of how it was
                <br />
                <span className="text-blue-600">made.</span>
              </h1>
              <p className="text-base text-slate-500 max-w-[420px] leading-relaxed mb-10">
                ProvenanceKit records the full lineage of Human-AI created
                works. Every contributor, every tool, every transformation.
                Verifiable, onchain.
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
      <section className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-5 grid grid-cols-3 divide-x divide-slate-800">
          {[
            {
              label: "Open standard",
              sub: "EAA — Entity · Action · Attribution",
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
              <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── The food label moment ──────────────────────────────────── */}
      <section className="py-28 lg:py-40 px-6 lg:px-12 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-[clamp(2.2rem,5.5vw,5rem)] font-bold leading-[0.92] tracking-tight"
            style={{ color: "#d1d5db" }}
          >
            Food comes
            <br />
            with a label.
            <br />
            <span className="text-slate-900">
              Digital content
              <br />
              should too.
            </span>
          </h2>
          <div className="mt-12 max-w-2xl">
            <p className="text-base text-slate-500 leading-relaxed">
              Digital content passes through multiple AI tools, human edits, and
              iterations across sessions and platforms. Without a record,
              attribution is guesswork, licensing is unenforceable, and
              responsibility cannot be assigned. Emerging rules around AI
              disclosure and content transparency are making provenance a
              requirement. ProvenanceKit is the infrastructure for Human-AI
              works.
            </p>
          </div>
        </div>
      </section>

      {/* ─── It all starts with the record ─────────────────────────── */}
      <section className="py-28 lg:py-36 px-6 lg:px-12 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <p className="text-[11px] font-mono text-blue-600 tracking-[0.18em] uppercase mb-6">
              The core artifact
            </p>
            <h2 className="text-[clamp(1.8rem,4vw,3.2rem)] font-bold leading-[0.93] tracking-tight mb-6">
              It all starts
              <br />
              with the record.
            </h2>
            <p className="text-slate-500 text-base leading-relaxed mb-8">
              The ProvenanceKit record is a provenance label for any Human-AI
              created work. It documents who made it, which tools were used,
              when each step happened, and under what terms. Portable,
              embeddable, and independently verifiable.
            </p>
            <ul className="space-y-3">
              {[
                "Who: human authors, organisations, AI models",
                "How: every step, tool, and transformation",
                "When: block-level onchain timestamp",
                "Terms: license and permission data",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-slate-700"
                >
                  <Check className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center">
            <ProvenanceRecordCard />
          </div>
        </div>
      </section>

      {/* ─── Full creation lineage ──────────────────────────────────── */}
      <section className="py-28 lg:py-36 px-6 lg:px-12 bg-white border-t border-slate-100">
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
                  dot: "bg-blue-500",
                  label: "Entities",
                  desc: "Authors, AI models, orgs",
                },
                {
                  dot: "bg-violet-500",
                  label: "Actions",
                  desc: "Generation, editing, remixing",
                },
                {
                  dot: "bg-amber-500",
                  label: "Resources",
                  desc: "Every input and output",
                },
                {
                  dot: "bg-emerald-500",
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

      {/* ─── Onchain ────────────────────────────────────────────────── */}
      <section className="py-28 lg:py-40 px-6 lg:px-12 bg-[#080d18] text-white border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div>
              <p className="text-[11px] font-mono text-blue-400 tracking-[0.18em] uppercase mb-8">
                Onchain provenance
              </p>
              <h2
                className="text-[clamp(2.2rem,5vw,4.5rem)] font-bold leading-[0.92] tracking-tight mb-8"
                style={{ color: "#334155" }}
              >
                Not just
                <br />
                a record.
                <br />
                <span className="text-white">Proof.</span>
              </h2>
              <p className="text-slate-300 text-base leading-relaxed">
                Every creation step is anchored onchain. Immutable,
                independently timestamped, and verifiable by anyone without
                trusting a server or a central authority.
              </p>
            </div>
            <OnchainVisual />
          </div>
        </div>
      </section>

      {/* ─── Editorial break ────────────────────────────────────────── */}
      <section className="py-28 lg:py-40 px-6 lg:px-12 bg-slate-50 border-t border-slate-100">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-[clamp(2.2rem,5.5vw,5rem)] font-bold leading-[0.92] tracking-tight"
            style={{ color: "#d1d5db" }}
          >
            Provenance is not a<br />
            static document.
            <br />
            <span className="text-slate-900">
              It is an active layer
              <br />
              of rights and rewards.
            </span>
          </h2>
          <div className="mt-12">
            <LandingCTAButton />
          </div>
        </div>
      </section>

      {/* ─── Programmable ───────────────────────────────────────────── */}
      <section className="py-28 lg:py-40 px-6 lg:px-12 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <h2 className="text-[clamp(2.2rem,5vw,4rem)] font-bold leading-[0.92] tracking-tight">
              Provenance that
              <br />
              does something.
            </h2>
            <p className="mt-6 text-base text-slate-500 leading-relaxed">
              Onchain records are programmable. Provenance becomes the engine
              for rights, attribution, and revenue automatically.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                gradient: "from-blue-600 to-blue-700",
                number: "01",
                title: "Permissioning",
                headline: "Provenance becomes the credential.",
                desc: "Gate access to content, APIs, and derivative works based on verified contribution history. Rights enforcement flows from the same record that documents creation.",
                items: [
                  "AI training opt-in and opt-out",
                  "License-aware derivative gating",
                  "Contribution-based access control",
                ],
              },
              {
                gradient: "from-violet-600 to-violet-700",
                number: "02",
                title: "Attribution",
                headline: "Credit follows contribution.",
                desc: "Assign credit to every participant in a creation chain: human authors, AI tool providers, dataset owners. Contribution weights are verifiable and permanent.",
                items: [
                  "Multi-step workflow attribution",
                  "AI model and tool credit tracking",
                  "Human contribution weighting",
                ],
              },
              {
                gradient: "from-emerald-600 to-emerald-700",
                number: "03",
                title: "Revenue Distribution",
                headline: "Royalties without administrators.",
                desc: "Route revenue to contributors in proportion to their verified contribution, calculated and distributed onchain via programmable splits. No intermediary.",
                items: [
                  "Onchain splits via 0xSplits",
                  "Remix royalty chain enforcement",
                  "Automatic distribution",
                ],
              },
            ].map(({ gradient, number, title, headline, desc, items }) => (
              <div
                key={title}
                className="rounded-2xl overflow-hidden border border-slate-200 hover:border-slate-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col"
              >
                <div className={`bg-gradient-to-br ${gradient} p-7 pb-6`}>
                  <span className="text-[10px] font-mono text-white/50 tracking-[0.2em]">
                    {number}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-2 mb-1.5">
                    {title}
                  </h3>
                  <p className="text-sm text-white/75 font-medium leading-snug">
                    {headline}
                  </p>
                </div>
                <div className="p-7 flex flex-col flex-1 bg-white">
                  <p className="text-sm text-slate-500 leading-relaxed mb-7">
                    {desc}
                  </p>
                  <ul className="space-y-2.5 mt-auto">
                    {items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2.5 text-sm text-slate-600"
                      >
                        <Check className="h-4 w-4 text-slate-300 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Developer section ──────────────────────────────────────── */}
      <section className="py-28 lg:py-36 px-6 lg:px-12 bg-white border-t border-slate-100">
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
              One SDK. Any Node.js or TypeScript backend. Pluggable storage,
              privacy extensions, and chain adapters. Deploy on your terms.
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
      <section className="py-28 px-6 lg:px-12 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-xl mb-14">
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
              },
              {
                title: "Content platforms",
                desc: "Remix chains and derivative works tracked. Licensing enforced automatically.",
              },
              {
                title: "Enterprise AI",
                desc: "Audit trails for AI-generated outputs that satisfy EU AI Act and copyright requirements.",
              },
              {
                title: "Creative tools",
                desc: "A tamper-proof credential creators own, proving their contribution to any Human-AI work.",
              },
            ].map(({ title, desc }) => (
              <div
                key={title}
                className="p-7 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all"
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
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[450px] bg-blue-600/8 rounded-full blur-[180px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-[clamp(2.2rem,5.5vw,5rem)] font-bold leading-[0.90] tracking-tight mb-6">
            Start recording
            <br />
            provenance today.
          </h2>
          <p className="text-slate-400 text-base mb-12 max-w-lg mx-auto leading-relaxed">
            Open source and production-ready. Create your first project in
            minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <LandingCTAButton />
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
      <footer className="border-t border-slate-800 bg-[#080d18] px-6 lg:px-12 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-slate-700">
            <span className="text-white font-bold text-[8px]">PK</span>
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
            href="https://github.com/provenancekit"
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

/* ─── Standalone provenance record card ─────────────────────────── */

function ProvenanceRecordCard() {
  return (
    <div className="w-full max-w-[360px] rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
      <div className="bg-slate-900 px-6 py-5 flex items-center gap-3">
        <div className="h-9 w-9 rounded-[28%] bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[11px] font-bold">Pr</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white">ProvenanceKit</p>
          <p className="text-xs text-slate-400 font-mono">essay-draft-v3.md</p>
        </div>
      </div>

      <div className="bg-white px-6 py-3">
        {[
          { label: "Date", value: "March 8, 2026" },
          { label: "Produced by", value: "Jordan Kim" },
          { label: "App or tool used", value: "ProvenanceKit Studio" },
          { label: "AI models", value: "Claude 3.5, GPT-4o" },
          { label: "License", value: "CC BY-SA 4.0" },
          { label: "Signed with", value: "EVM · 0x3d91…c07f" },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between py-2">
            <span className="text-xs text-slate-400">{label}</span>
            <span
              className={`text-xs font-medium ${
                label === "Signed with"
                  ? "text-emerald-600 font-mono"
                  : "text-slate-800"
              }`}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 border-t border-slate-100 px-6 py-3.5 flex items-center justify-between">
        <span className="text-xs text-slate-400">Verified · Tamper-proof</span>
        <span className="text-xs font-mono text-blue-600">View on chain</span>
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
      dot: "bg-blue-500",
    },
    {
      label: "GPT-4o generation",
      sub: "Action · ext:ai@1.0.0",
      dot: "bg-violet-500",
    },
    {
      label: "Draft v1",
      sub: "Resource · content hash recorded",
      dot: "bg-amber-500",
    },
    {
      label: "Human edit and refinement",
      sub: "Action · contribution weighted",
      dot: "bg-violet-500",
    },
    {
      label: "DALL-E 3 illustration",
      sub: "Action · ext:ai@1.0.0",
      dot: "bg-violet-500",
    },
    {
      label: "Final output",
      sub: "Resource · anchored onchain",
      dot: "bg-emerald-500",
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
      <p className="text-[10px] font-mono text-slate-400 tracking-widest uppercase mb-6">
        Creation workflow
      </p>
      <div className="flex flex-col">
        {steps.map((step, i) => (
          <div key={step.label}>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-200">
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
      <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-3">
        <div className="h-6 w-6 rounded-md bg-slate-900 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[8px] font-bold">PK</span>
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

/* ─── Onchain visual ────────────────────────────────────────────── */

function OnchainVisual() {
  const blocks = [
    {
      hash: "0x8f2e…4a1c",
      label: "Final output anchored",
      time: "21:42 UTC",
      step: 4,
    },
    {
      hash: "0x3d91…c07f",
      label: "DALL-E 3 illustration",
      time: "21:40 UTC",
      step: 3,
    },
    {
      hash: "0xa742…f830",
      label: "Human edit recorded",
      time: "21:38 UTC",
      step: 2,
    },
    {
      hash: "0x1fe0…9d22",
      label: "GPT-4o generation",
      time: "21:35 UTC",
      step: 1,
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-mono text-slate-600 tracking-[0.18em] uppercase mb-4">
        Onchain record
      </p>
      {blocks.map((block, i) => (
        <div
          key={block.hash}
          className="rounded-xl border border-slate-700/60 bg-slate-900 p-4 flex items-center gap-4"
          style={{ opacity: 1 - i * 0.1 }}
        >
          <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-blue-600/15 border border-blue-500/20 flex items-center justify-center">
            <span className="text-blue-400 text-xs font-mono font-bold">
              #{block.step}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{block.label}</p>
            <p className="text-xs text-slate-500 font-mono">{block.hash}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-slate-500 font-mono">{block.time}</p>
            <p className="text-xs text-emerald-400 mt-0.5">confirmed</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Code block ────────────────────────────────────────────────── */

function CodeBlock() {
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-200 bg-slate-50">
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
