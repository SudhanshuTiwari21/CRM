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
import { Separator } from "@/components/ui/separator";
import { useBranding } from "@/components/branding/branding-provider";
import { BRAND_OPTIONS, type BrandId } from "@/lib/branding";

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

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bookings", label: "Bookings", icon: Plane },
  { href: "/bookings/upcoming-48h", label: "Within 48 hrs", icon: Clock },
  { href: "/cancellations", label: "Cancellations", icon: Ban },
  { href: "/hotels", label: "Hotels", icon: Building2 },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/leads", label: "Leads", icon: Target },
  { href: "/documents", label: "Documents", icon: FileText },
  {
    href: "/accounting",
    label: "Accounting",
    icon: Calculator,
    children: [
      { href: "/accounting/invoices", label: "Invoice", icon: Receipt },
      { href: "/payments", label: "Payments", icon: Wallet },
    ],
  },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
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

function BrandToggle() {
  const { brandId, setBrandId } = useBranding();

  return (
    <div className="px-3 pb-3">
      <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
        Active brand
      </p>
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-1">
        {BRAND_OPTIONS.map((option) => {
          const active = brandId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setBrandId(option.id as BrandId)}
              className={cn(
                "rounded-md px-1.5 py-1.5 text-center text-[10px] font-semibold leading-tight transition-all",
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              {option.id === "book-to-roam" ? (
                <>
                  Book to
                  <br />
                  Roam
                </>
              ) : (
                "TechRecoil"
              )}
            </button>
          );
        })}
      </div>
    </div>
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
    const accountingItem = navItems.find((item) => item.href === "/accounting");
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

  const NavContent = () => (
    <>
      <div className="flex h-20 items-center overflow-hidden px-4">
        {brand.id === "book-to-roam" ? (
          <img
            src={brand.logoSrc}
            alt={brand.label}
            className="h-12 w-auto origin-left scale-[3]"
            style={{ maxWidth: "none" }}
          />
        ) : (
          <div className="flex items-center gap-2.5">
            <img src={brand.logoSrc} alt={brand.label} className="h-10 w-auto" />
          </div>
        )}
      </div>
      <Separator className="bg-sidebar-border" />
      <div className="pt-3">
        <BrandToggle />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = Boolean(item.children?.length);
          const active = isPathActive(pathname, item.href);
          const groupActive = isGroupActive(pathname, item);
          const expanded = item.href === "/accounting" ? accountingOpen : false;

          if (!hasChildren) {
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-sidebar-accent text-white shadow-sm before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-blue-400"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          }

          return (
            <div key={item.href} className="space-y-1">
              <div
                className={cn(
                  "relative flex items-center rounded-lg transition-all duration-200",
                  groupActive && !active
                    ? "text-sidebar-foreground"
                    : active
                      ? "bg-sidebar-accent text-white shadow-sm before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-blue-400"
                      : "text-sidebar-foreground/70"
                )}
              >
                <Link
                  href={item.href}
                  onClick={() => {
                    setAccountingOpen(true);
                    setMobileOpen(false);
                  }}
                  className={cn(
                    "flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                    !active && "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
                <button
                  type="button"
                  aria-label={expanded ? "Collapse Accounting" : "Expand Accounting"}
                  onClick={() => setAccountingOpen((o) => !o)}
                  className={cn(
                    "mr-1 rounded-md p-1.5 hover:bg-sidebar-accent/50",
                    active ? "text-white/80" : "text-sidebar-foreground/60"
                  )}
                >
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
                  />
                </button>
              </div>

              {expanded && (
                <div className="ml-3 space-y-0.5 border-l border-sidebar-border pl-2">
                  {item.children!.map((child) => {
                    const ChildIcon = child.icon;
                    const childActive = isPathActive(pathname, child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                          childActive
                            ? "bg-sidebar-accent text-white shadow-sm"
                            : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <ChildIcon className="h-3.5 w-3.5" />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/20 text-xs text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{session?.user?.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">{session?.user?.role}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {process.env.NEXT_PUBLIC_DISABLE_AUTH !== "true" && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          )}
        </div>
      </div>
    </>
  );

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
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-sidebar-border/50 bg-sidebar shadow-xl transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}
