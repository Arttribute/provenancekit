"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Key,
  Users,
  CreditCard,
  Settings,
  Database,
  GitBranch,
  BarChart3,
  Shield,
  Webhook,
  ChevronLeft,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

/** Static top-level path segments that are not org slugs. */
const GLOBAL_SEGMENTS = new Set(["dashboard", "orgs", "settings", ""]);

/** Org-level path segments that are not project slugs. */
const ORG_SEGMENTS = new Set(["members", "billing", "settings", "projects"]);

function parseSlugs(pathname: string): {
  orgSlug?: string;
  projectSlug?: string;
} {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0];
  if (!first || GLOBAL_SEGMENTS.has(first)) return {};
  const orgSlug = first;
  const second = parts[1];
  if (!second || ORG_SEGMENTS.has(second)) return { orgSlug };
  return { orgSlug, projectSlug: second };
}

export function Sidebar() {
  const pathname = usePathname();
  const { orgSlug, projectSlug } = parseSlugs(pathname);

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  // ── Project context: show only project nav ────────────────────────────────
  if (orgSlug && projectSlug) {
    const projectLinks: NavLink[] = [
      {
        href: `/${orgSlug}/${projectSlug}`,
        label: "Overview",
        icon: <FolderKanban className="h-4 w-4" />,
        exact: true,
      },
      {
        href: `/${orgSlug}/${projectSlug}/resources`,
        label: "Resources",
        icon: <Database className="h-4 w-4" />,
      },
      {
        href: `/${orgSlug}/${projectSlug}/provenance`,
        label: "Provenance Graph",
        icon: <GitBranch className="h-4 w-4" />,
      },
      {
        href: `/${orgSlug}/${projectSlug}/api-keys`,
        label: "API Keys",
        icon: <Key className="h-4 w-4" />,
      },
      {
        href: `/${orgSlug}/${projectSlug}/analytics`,
        label: "Analytics",
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        href: `/${orgSlug}/${projectSlug}/privacy`,
        label: "Privacy",
        icon: <Shield className="h-4 w-4" />,
      },
      {
        href: `/${orgSlug}/${projectSlug}/settings`,
        label: "Settings",
        icon: <Settings className="h-4 w-4" />,
      },
    ];

    return (
      <aside className="flex h-full w-60 flex-col border-r bg-sidebar">
        <SidebarHeader />
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          <Link
            href={`/${orgSlug}`}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            <span className="truncate">{orgSlug}</span>
          </Link>
          <div>
            <div className="flex items-center gap-1.5 px-2 mb-2">
              <FolderKanban className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {projectSlug}
              </span>
            </div>
            <NavSection links={projectLinks} isActive={isActive} />
          </div>
        </nav>
        <SidebarFooter />
      </aside>
    );
  }

  // ── Org context: show only org nav ────────────────────────────────────────
  if (orgSlug) {
    const orgLinks: NavLink[] = [
      {
        href: `/${orgSlug}`,
        label: "Overview",
        icon: <LayoutDashboard className="h-4 w-4" />,
        exact: true,
      },
      {
        href: `/${orgSlug}/members`,
        label: "Members",
        icon: <Users className="h-4 w-4" />,
      },
      {
        href: `/${orgSlug}/billing`,
        label: "Billing",
        icon: <CreditCard className="h-4 w-4" />,
      },
      {
        href: `/${orgSlug}/settings`,
        label: "Settings",
        icon: <Settings className="h-4 w-4" />,
      },
    ];

    return (
      <aside className="flex h-full w-60 flex-col border-r bg-sidebar">
        <SidebarHeader />
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            <span>All organizations</span>
          </Link>
          <div>
            <div className="flex items-center gap-1.5 px-2 mb-2">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {orgSlug}
              </span>
            </div>
            <NavSection links={orgLinks} isActive={isActive} />
          </div>
        </nav>
        <SidebarFooter />
      </aside>
    );
  }

  // ── Global context ────────────────────────────────────────────────────────
  const globalLinks: NavLink[] = [
    {
      href: "/dashboard",
      label: "Overview",
      icon: <LayoutDashboard className="h-4 w-4" />,
      exact: true,
    },
    {
      href: "/orgs",
      label: "Organizations",
      icon: <Users className="h-4 w-4" />,
    },
    {
      href: "/settings",
      label: "Settings",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-sidebar">
      <SidebarHeader />
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NavSection links={globalLinks} isActive={isActive} />
      </nav>
      <SidebarFooter />
    </aside>
  );
}

function SidebarHeader() {
  return (
    <div className="flex h-14 items-center border-b px-4">
      <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
          Pr
        </div>
        <span className="text-sm">ProvenanceKit</span>
      </Link>
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="border-t px-3 py-3">
      <a
        href="https://docs.provenancekit.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
      >
        <Webhook className="h-4 w-4" />
        Documentation
      </a>
    </div>
  );
}

function NavSection({
  links,
  isActive,
}: {
  links: NavLink[];
  isActive: (href: string, exact?: boolean) => boolean;
}) {
  return (
    <ul className="space-y-0.5">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
              isActive(link.href, link.exact)
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            {link.icon}
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
