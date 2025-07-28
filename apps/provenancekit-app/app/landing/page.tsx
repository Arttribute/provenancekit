/*
 * Landing page for ProvenanceKit. This standalone React component is
 * designed for a Next.js + Tailwind CSS project. To use it in your
 * monorepo, place this file under an `app/landing/page.tsx` (or similar)
 * directory within your `provenancekit-app` package and add the
 * accompanying `hero-network.png` image into the `public` folder of
 * that app. The page loads a Google Font for Space Grotesk, Space Mono
 * and Chakra Petch to achieve a sleek, modern aesthetic. Tailwind
 * utility classes are used throughout for layout and styling. Feel free
 * to adjust the copy or add additional sections to suit your needs.
 */

import Head from "next/head";
import Image from "next/image";
import { ShieldCheck, Network, Users, Layers } from "lucide-react";

// A simple SVG illustration of a provenance graph. Three resources are
// connected by actions and entities to demonstrate the concept of
// inputs, outputs and performers. Adjust colours to match your
// branding.
function GraphIllustration() {
  return (
    <svg
      viewBox="0 0 300 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto text-indigo-500"
    >
      {/* Resource nodes */}
      <circle cx="60" cy="100" r="20" stroke="currentColor" strokeWidth="2" />
      <circle cx="150" cy="50" r="20" stroke="currentColor" strokeWidth="2" />
      <circle cx="240" cy="120" r="20" stroke="currentColor" strokeWidth="2" />
      {/* Action nodes */}
      <rect
        x="95"
        y="110"
        width="40"
        height="20"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="190"
        y="40"
        width="40"
        height="20"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Edges */}
      <line
        x1="80"
        y1="100"
        x2="110"
        y2="120"
        stroke="currentColor"
        strokeWidth="2"
        markerEnd="url(#arrow)"
      />
      <line
        x1="170"
        y1="50"
        x2="210"
        y2="50"
        stroke="currentColor"
        strokeWidth="2"
        markerEnd="url(#arrow)"
      />
      <line
        x1="115"
        y1="130"
        x2="220"
        y2="120"
        stroke="currentColor"
        strokeWidth="2"
        markerEnd="url(#arrow)"
      />
      {/* Arrow marker definition */}
      <defs>
        <marker
          id="arrow"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto-start-reverse"
        >
          <path d="M0 0L6 3L0 6V0Z" fill="currentColor" />
        </marker>
      </defs>
    </svg>
  );
}

// Feature definitions. Each item describes a core capability of
// ProvenanceKit and references a Lucide icon for visual context.
const features = [
  {
    title: "Transparent provenance",
    description:
      "Every generation, remix, assignment and approval is recorded with signatures, metadata and links, ensuring a tamper‑proof history.",
    icon: ShieldCheck,
  },
  {
    title: "Replayable graphs",
    description:
      "Reconstruct and visualise the entire content lifecycle. Explore how resources come to be and branch across agents and tools.",
    icon: Network,
  },
  {
    title: "Collaborative attribution",
    description:
      "Connect collaborators and attribute credit fairly. Assign roles, track contributions and share value across humans, AI and organisations.",
    icon: Users,
  },
  {
    title: "Extensible ecosystem",
    description:
      "Customise action types, roles or resource categories. Integrate our SDK, React UI library and on‑chain storage to build your own tools.",
    icon: Layers,
  },
];

export default function LandingPage() {
  return (
    <>
      <Head>
        <title>ProvenanceKit – Transparent AI provenance</title>
        {/* Preconnects improve font loading performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        {/* Import multiple weights of Space Grotesk, Space Mono and Chakra Petch */}
        <link
          href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;700&family=Space+Grotesk:wght@400;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className="overflow-x-hidden">
        {/* Hero section */}
        <section className="relative isolate pt-24 pb-32 px-6 md:px-12 lg:px-24 flex flex-col md:flex-row items-center max-w-7xl mx-auto">
          {/* Textual call‑to‑action */}
          <div className="flex-1 max-w-xl space-y-6 text-center md:text-left">
            <h1
              className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              ProvenanceKit
            </h1>
            <p className="text-lg md:text-xl text-gray-600">
              Transparency, attribution and value‑sharing for AI‑generated
              content
            </p>
            <p className="text-gray-500 max-w-md">
              ProvenanceKit transforms how we track the lifecycle of generative
              AI. Instead of isolated outputs, agents produce composable
              histories with auditable trails.
            </p>
            <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0 justify-center md:justify-start">
              <a
                href="/docs"
                className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow hover:bg-indigo-700 transition-colors"
              >
                Get started
              </a>
              <a
                href="/demo"
                className="inline-flex items-center justify-center rounded-md border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Live demo
              </a>
            </div>
          </div>
          {/* Decorative graphic */}
          <div className="mt-12 md:mt-0 md:ml-12 flex-1 w-full max-w-md relative">
            {/* Use next/image for optimised loading; adjust sizes as needed */}
            <Image
              src="/hero-network.png"
              alt="Abstract network background"
              width={600}
              height={600}
              className="rounded-xl shadow-lg object-cover"
              priority
            />
          </div>
        </section>

        {/* Features section */}
        <section className="bg-gray-50 py-20 px-6 md:px-12 lg:px-24">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2
                className="text-3xl md:text-4xl font-bold text-gray-900"
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              >
                Why ProvenanceKit?
              </h2>
              <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
                Our platform is built to make AI workflows transparent and
                trustworthy, empowering creators, organisations and users alike.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="bg-white rounded-lg shadow-sm p-6 flex flex-col items-start hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-md bg-indigo-100 text-indigo-600 mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3
                    className="text-lg font-semibold text-gray-900 mb-2"
                    style={{ fontFamily: "Space Grotesk, sans-serif" }}
                  >
                    {title}
                  </h3>
                  <p className="text-sm text-gray-600 flex-1">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Provenance graph section */}
        <section className="py-20 px-6 md:px-12 lg:px-24">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2
                className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              >
                Visualise your content’s lineage
              </h2>
              <p className="text-gray-600 mb-6">
                Dive into the provenance graph to see how each resource was
                created. Each node represents an entity, action or resource and
                every edge captures their relationships, such as inputs,
                derivations, assignments and approvals.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="mt-2 mr-3 inline-block w-3 h-3 bg-indigo-500 rounded-full"></span>
                  <div>
                    <span className="font-semibold text-gray-900">
                      Inputs & derivations
                    </span>
                    <p className="text-sm text-gray-600">
                      Connect raw materials and see how they combine into new
                      works.
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mt-2 mr-3 inline-block w-3 h-3 bg-indigo-500 rounded-full"></span>
                  <div>
                    <span className="font-semibold text-gray-900">
                      Assignments & tools
                    </span>
                    <p className="text-sm text-gray-600">
                      Identify who performed each action and which tools were
                      employed.
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mt-2 mr-3 inline-block w-3 h-3 bg-indigo-500 rounded-full"></span>
                  <div>
                    <span className="font-semibold text-gray-900">
                      Approvals & outcomes
                    </span>
                    <p className="text-sm text-gray-600">
                      Trace reviews and approvals to understand quality and
                      intent.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="max-w-md mx-auto md:mx-0">
              <GraphIllustration />
            </div>
          </div>
        </section>

        {/* Ecosystem section */}
        <section className="bg-gray-50 py-20 px-6 md:px-12 lg:px-24">
          <div className="max-w-7xl mx-auto">
            <h2
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              A full‑stack toolkit
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <h3
                  className="text-lg font-semibold text-gray-900 mb-2"
                  style={{ fontFamily: "Space Grotesk, sans-serif" }}
                >
                  Frontend
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Build beautiful, performant interfaces with our React UI
                  library. We use Next.js and Tailwind CSS for a modern
                  development experience.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <h3
                  className="text-lg font-semibold text-gray-900 mb-2"
                  style={{ fontFamily: "Space Grotesk, sans-serif" }}
                >
                  API & SDK
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Our Hono server powers endpoints for uploading files,
                  inspecting provenance, searching and graph queries. Integrate
                  via our TypeScript SDK.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <h3
                  className="text-lg font-semibold text-gray-900 mb-2"
                  style={{ fontFamily: "Space Grotesk, sans-serif" }}
                >
                  Storage & ledger
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Content is pinned to IPFS via Pinata, indexed in Supabase and
                  recorded on‑chain for permanence. Seamlessly blend off‑chain
                  speed with on‑chain integrity.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final call‑to‑action */}
        <section className="py-16 px-6 md:px-12 lg:px-24 text-center">
          <h2
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-6"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            Ready to build with provenance?
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Join developers and creators who are bringing trust and
            accountability to AI. Start integrating ProvenanceKit in minutes.
          </p>
          <a
            href="/docs"
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-8 py-4 text-sm font-medium text-white shadow hover:bg-indigo-700 transition-colors"
          >
            Read the documentation
          </a>
        </section>
      </div>
    </>
  );
}
