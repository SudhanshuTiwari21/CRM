import Link from "next/link";
import { formatDateTime } from "@/lib/utils";
import {
  CheckCircle2,
  Mail,
  FileText,
  UserPlus,
  StickyNote,
  Plus,
  Ban,
} from "lucide-react";

interface ActivityItem {
  id: string;
  action: string;
  createdAt: Date;
  user: { name: string } | null;
  booking: { id: string; publicRef: string } | null;
}

const actionMeta: Record<string, { icon: typeof Plus; color: string; label: string }> = {
  BOOKING_CREATED: { icon: Plus, color: "text-blue-600 bg-blue-500/10", label: "Booking created" },
  PNR_CONFIRMED: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-500/10", label: "PNR confirmed" },
  DOCUMENTS_GENERATED: { icon: FileText, color: "text-violet-600 bg-violet-500/10", label: "Documents generated" },
  EMAIL_RESENT: { icon: Mail, color: "text-cyan-600 bg-cyan-500/10", label: "Email sent" },
  AGENT_ASSIGNED: { icon: UserPlus, color: "text-amber-600 bg-amber-500/10", label: "Agent assigned" },
  NOTE_ADDED: { icon: StickyNote, color: "text-slate-600 bg-slate-500/10", label: "Note added" },
  LIVE_BOOKING_CONFIRMED: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-500/10", label: "Live booking confirmed" },
  BOOKING_CANCELLED: { icon: Ban, color: "text-red-600 bg-red-500/10", label: "Booking cancelled" },
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <h3 className="font-semibold tracking-tight">Live Activity</h3>
        <p className="text-xs text-muted-foreground">Real-time operations log</p>
      </div>

      <div className="max-h-[320px] overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No activity yet</p>
        ) : (
          <div className="relative space-y-1 pl-2">
            <div className="absolute bottom-2 left-[19px] top-2 w-px bg-border" />
            {items.map((item) => {
              const meta = actionMeta[item.action] || {
                icon: Plus,
                color: "text-muted-foreground bg-muted",
                label: item.action.replace(/_/g, " ").toLowerCase(),
              };
              const Icon = meta.icon;

              return (
                <div key={item.id} className="relative flex gap-3 rounded-lg p-2 hover:bg-muted/40">
                  <div
                    className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.color}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm">
                      <span className="font-medium capitalize">{meta.label}</span>
                      {item.booking && (
                        <>
                          {" · "}
                          <Link
                            href={`/bookings/${item.booking.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {item.booking.publicRef}
                          </Link>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.user?.name || "System"} · {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
