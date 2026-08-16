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

function BrandLogo({ brand }: Readonly<{ brand: BrandPreset }>) {
  if (brand.id === "techrecoil") {
    return (
      <div className="flex items-center gap-3 px-1">
        <img
          src={brand.logoSrc}
          alt=""
          className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-white/15"
        />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold tracking-tight text-sidebar-foreground">
            TechRecoil
          </p>
          <p className="truncate text-[11px] text-sidebar-foreground/50">Travel CRM</p>
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

function BrandToggle() {
  const { brandId, setBrandId } = useBranding();

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
  onClick,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  nested?: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors",
        nested ? "px-2.5 py-1.5" : "px-2.5 py-2",
        active
          ? "bg-white/10 text-white"
          : "text-sidebar-foreground/65 hover:bg-white/5 hover:text-sidebar-foreground"
      )}
    >
      {active && (
        <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-sidebar-primary" />
      )}
      <Icon className={cn("shrink-0 opacity-80", nested ? "h-3.5 w-3.5" : "h-4 w-4")} />
      {label}
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

  useEffect(() => {
    const accountingItem = navSections
      .flatMap((section) => section.items)
      .find((item) => item.href === "/accounting");
    if (accountingItem && isGroupActive(pathname, accountingItem)) {
      setAccountingOpen(true);
    }
  }, [pathname]);

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-[72px] items-center px-4">
          <BrandLogo brand={brand} />
        </div>

        <div className="px-0 pb-3">
          <BrandToggle />
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/35">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const hasChildren = Boolean(item.children?.length);
                  const active = isPathActive(pathname, item.href);
                  const groupActive = isGroupActive(pathname, item);
                  const expanded = item.href === "/accounting" ? accountingOpen : false;

                  if (!hasChildren) {
                    return (
                      <NavLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        active={active}
                        onClick={() => setMobileOpen(false)}
                      />
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

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-1 py-1">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-white/10 text-[11px] text-sidebar-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
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
          </div>
        </div>
      </aside>
    </>
  );
}
