"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LandingCTAButton } from "@/components/auth/landing-cta-button";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 lg:px-12 py-4 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900">
          <span className="text-white font-bold text-[10px] tracking-tight">PK</span>
        </div>
        <span className="font-semibold text-sm tracking-tight">ProvenanceKit</span>
      </div>
      <nav className="hidden md:flex items-center gap-8 text-sm text-slate-500">
        <Link href="https://docs.provenancekit.com" className="hover:text-slate-900 transition-colors">
          Docs
        </Link>
        <Link href="https://github.com/provenancekit" className="hover:text-slate-900 transition-colors">
          GitHub
        </Link>
      </nav>
      <LandingCTAButton />
    </header>
  );
}
