"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Plane,
  Users,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Building2,
  Calculator,
  Clock,
  Ban,
  Wallet,
  Target,
  ChevronDown,
  Receipt,
  PanelLeftClose,
  PanelLeftOpen,
  Compass,
  type LucideIcon,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useBranding } from "@/components/branding/branding-provider";
import { BRAND_OPTIONS, type BrandId, type BrandPreset } from "@/lib/branding";

const SIDEBAR_COLLAPSED_KEY = "crm-sidebar-collapsed";
const SIDEBAR_EXPANDED_WIDTH = 248;
const SIDEBAR_COLLAPSED_WIDTH = 72;

type NavChild = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: NavChild[];
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/bookings", label: "Bookings", icon: Plane },
      { href: "/bookings/upcoming-48h", label: "Within 48 hrs", icon: Clock },
      { href: "/cancellations", label: "Cancellations", icon: Ban },
      { href: "/hotels", label: "Hotels", icon: Building2 },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/leads", label: "Leads", icon: Target },
      { href: "/activities", label: "Activities", icon: Compass },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        href: "/accounting",
        label: "Accounting",
        icon: Calculator,
        children: [
          { href: "/accounting/invoices", label: "Invoices", icon: Receipt },
          { href: "/payments", label: "Payments", icon: Wallet },
        ],
      },
      { href: "/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isPathActive(pathname: string, href: string) {
  if (href === "/bookings") {
    return pathname === "/bookings" || /^\/bookings\/[^/]+$/.test(pathname);
  }
  if (href === "/accounting") {
    return pathname === "/accounting";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGroupActive(pathname: string, item: NavItem) {
  if (isPathActive(pathname, item.href)) return true;
  return item.children?.some((child) => isPathActive(pathname, child.href)) ?? false;
}

function BrandLogo({ brand, collapsed }: Readonly<{ brand: BrandPreset; collapsed: boolean }>) {
  if (brand.id === "techrecoil") {
    return (
      <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 px-1")}>
        <img
          src={brand.logoSrc}
          alt={brand.label}
          className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-white/15"
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold tracking-tight text-sidebar-foreground">
              TechRecoil
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/50">Travel CRM</p>
          </div>
        )}
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="flex justify-center">
        <div className="relative h-9 w-9 overflow-hidden rounded-md ring-1 ring-white/10">
          <img
            src={brand.logoSrc}
            alt={brand.label}
            className="absolute left-1/2 top-1/2 h-[72px] w-[72px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-1">
      <div className="relative h-9 w-[168px] overflow-hidden">
        <img
          src={brand.logoSrc}
          alt={brand.label}
          className="absolute left-1/2 top-1/2 h-[92px] w-[92px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
        />
      </div>
    </div>
  );
}

function BrandToggle({ collapsed }: Readonly<{ collapsed: boolean }>) {
  const { brandId, setBrandId } = useBranding();

  if (collapsed) {
    return (
      <div className="flex flex-col gap-1 px-2">
        {BRAND_OPTIONS.map((option) => {
          const active = brandId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              title={option.label}
              onClick={() => setBrandId(option.id as BrandId)}
              className={cn(
                "rounded-md px-1 py-1 text-[10px] font-semibold tracking-wide",
                active
                  ? "bg-white text-slate-900"
                  : "text-sidebar-foreground/55 hover:bg-white/5 hover:text-sidebar-foreground"
              )}
            >
              {option.shortLabel}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="px-3">
      <div className="grid grid-cols-2 rounded-lg bg-white/5 p-0.5 ring-1 ring-white/10">
        {BRAND_OPTIONS.map((option) => {
          const active = brandId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setBrandId(option.id as BrandId)}
              className={cn(
                "rounded-md px-2 py-1.5 text-[11px] font-medium tracking-wide transition-colors",
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground"
              )}
            >
              {option.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  nested = false,
  collapsed = false,
  onClick,
}: Readonly<{
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  nested?: boolean;
  collapsed?: boolean;
  onClick: () => void;
}>) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={cn(
        "group relative flex items-center rounded-md text-[13px] font-medium transition-colors",
        collapsed ? "justify-center px-0 py-2" : nested ? "gap-2.5 px-2.5 py-1.5" : "gap-2.5 px-2.5 py-2",
        active
          ? "bg-white/10 text-white"
          : "text-sidebar-foreground/65 hover:bg-white/5 hover:text-sidebar-foreground"
      )}
    >
      {active && !collapsed && (
        <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-sidebar-primary" />
      )}
      <Icon className={cn("shrink-0 opacity-80", nested && !collapsed ? "h-3.5 w-3.5" : "h-4 w-4")} />
      {!collapsed && label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { brand } = useBranding();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountingOpen, setAccountingOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    const accountingItem = navSections
      .flatMap((section) => section.items)
      .find((item) => item.href === "/accounting");
    if (accountingItem && isGroupActive(pathname, accountingItem)) {
      setAccountingOpen(true);
    }
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const compact = collapsed && !mobileOpen;
  const width = compact ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className="hidden shrink-0 transition-[width] duration-200 ease-out lg:block"
        style={{ width }}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-200 ease-out lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ width }}
      >
        <div
          className={cn(
            "flex items-center",
            compact ? "flex-col justify-center gap-2 px-2 py-3" : "h-[72px] gap-2 px-3"
          )}
        >
          <div className={cn("min-w-0", !compact && "flex-1")}>
            <BrandLogo brand={brand} collapsed={compact} />
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-white/5 hover:text-sidebar-foreground lg:flex"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <div className="pb-3">
          <BrandToggle collapsed={compact} />
        </div>

        <nav className={cn("flex-1 overflow-y-auto pb-4", compact ? "space-y-3 px-2" : "space-y-5 px-3")}>
          {navSections.map((section) => (
            <div key={section.label}>
              {!compact && (
                <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/35">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const hasChildren = Boolean(item.children?.length);
                  const active = isPathActive(pathname, item.href);
                  const groupActive = isGroupActive(pathname, item);
                  const expanded = !compact && item.href === "/accounting" ? accountingOpen : false;

                  if (!hasChildren) {
                    return (
                      <NavLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        active={active}
                        collapsed={compact}
                        onClick={() => setMobileOpen(false)}
                      />
                    );
                  }

                  if (compact) {
                    return (
                      <div key={item.href} className="space-y-0.5">
                        <NavLink
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          active={active || groupActive}
                          collapsed
                          onClick={() => setMobileOpen(false)}
                        />
                        {item.children!.map((child) => (
                          <NavLink
                            key={child.href}
                            href={child.href}
                            label={child.label}
                            icon={child.icon}
                            active={isPathActive(pathname, child.href)}
                            collapsed
                            onClick={() => setMobileOpen(false)}
                          />
                        ))}
                      </div>
                    );
                  }

                  return (
                    <div key={item.href}>
                      <div className="flex items-center">
                        <div className="min-w-0 flex-1">
                          <NavLink
                            href={item.href}
                            label={item.label}
                            icon={item.icon}
                            active={active}
                            onClick={() => {
                              setAccountingOpen(true);
                              setMobileOpen(false);
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          aria-label={expanded ? "Collapse Accounting" : "Expand Accounting"}
                          onClick={() => setAccountingOpen((open) => !open)}
                          className={cn(
                            "mr-1 rounded-md p-1 text-sidebar-foreground/45 hover:bg-white/5 hover:text-sidebar-foreground",
                            (active || groupActive) && "text-sidebar-foreground/70"
                          )}
                        >
                          <ChevronDown
                            className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
                          />
                        </button>
                      </div>
                      {expanded && (
                        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                          {item.children!.map((child) => (
                            <NavLink
                              key={child.href}
                              href={child.href}
                              label={child.label}
                              icon={child.icon}
                              active={isPathActive(pathname, child.href)}
                              nested
                              onClick={() => setMobileOpen(false)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <div className={cn("flex items-center rounded-lg py-1", compact ? "justify-center" : "gap-2.5 px-1")}>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-white/10 text-[11px] text-sidebar-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!compact && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-sidebar-foreground">
                    {session?.user?.name}
                  </p>
                  <p className="truncate text-[11px] capitalize text-sidebar-foreground/45">
                    {session?.user?.role?.toLowerCase()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-sidebar-foreground/55 hover:bg-white/10 hover:text-sidebar-foreground"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </Button>
                {process.env.NEXT_PUBLIC_DISABLE_AUTH !== "true" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-sidebar-foreground/55 hover:bg-white/10 hover:text-sidebar-foreground"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>
          {compact && (
            <div className="mt-1 flex flex-col items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-sidebar-foreground/55 hover:bg-white/10 hover:text-sidebar-foreground"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </Button>
              {process.env.NEXT_PUBLIC_DISABLE_AUTH !== "true" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-sidebar-foreground/55 hover:bg-white/10 hover:text-sidebar-foreground"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
