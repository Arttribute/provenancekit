import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareViewer } from "./share-viewer";
import type { ShareData } from "@/components/provenance/share-components";

type Props = { params: Promise<{ shareId: string }> };

const PK_API_BASE = process.env.PK_API_URL ?? "https://api.provenancekit.com";

async function fetchShare(shareId: string): Promise<ShareData | null> {
  try {
    const res = await fetch(`${PK_API_BASE}/p/shares/${shareId}`, {
      // Public endpoint — no auth required
      next: { revalidate: 60 }, // revalidate every 60s (view counts change)
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params;
  const share = await fetchShare(shareId);

  if (!share) {
    return { title: "Provenance Record Not Found" };
  }

  const title = share.title ?? "Provenance Record";
  const description =
    share.description ??
    `ProvenanceKit record with ${share.bundle?.actions.length ?? 0} actions, ${share.bundle?.resources.length ?? 0} resources.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | ProvenanceKit`,
      description,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `${title} | ProvenanceKit`,
      description,
    },
    // Prevent search engines from indexing individual share pages
    robots: { index: false, follow: false },
  };
}

export default async function SharePage({ params }: Props) {
  const { shareId } = await params;
  const share = await fetchShare(shareId);

  if (!share) {
    notFound();
  }

  return <ShareViewer share={share} />;
}
