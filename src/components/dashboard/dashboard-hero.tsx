"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Sparkles,
  Zap,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette";
import { useBranding } from "@/components/branding/branding-provider";

interface DashboardHeroProps {
  userName?: string | null;
  processingCount: number;
  pendingPnr: number;
}

export function DashboardHero({ userName, processingCount, pendingPnr }: DashboardHeroProps) {
  const router = useRouter();
  const { brand } = useBranding();
  const firstName = userName?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#312e81] p-6 text-white shadow-xl shadow-primary/10 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            {brand.heroTagline}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting}, {firstName}
            </h1>
            <p className="mt-1 text-sm text-blue-100/80">{dateLabel}</p>
          </div>
          {(processingCount > 0 || pendingPnr > 0) && (
            <p className="flex items-center gap-2 text-sm text-amber-200">
              <Zap className="h-4 w-4 shrink-0" />
              {pendingPnr > 0
                ? `${pendingPnr} booking${pendingPnr > 1 ? "s" : ""} need PNR confirmation today`
                : `${processingCount} in processing queue`}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="hidden sm:block">
            <CommandPalette />
          </div>
          <Button
            variant="secondary"
            className="border-0 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25"
            onClick={() => router.push("/bookings?status=PROCESSING")}
          >
            <Search className="mr-2 h-4 w-4" />
            View Queue
            {processingCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">
                {processingCount}
              </span>
            )}
          </Button>
          <Button asChild className="bg-white text-[#1e3a8a] shadow-lg hover:bg-blue-50">
            <Link href="/bookings/new">
              <Plus className="mr-2 h-4 w-4" />
              New Booking
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
