"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function EditFormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-sm", className)}>
      <div className="border-b bg-muted/30 px-4 py-3 sm:px-5">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function FormSettingToggle({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className={cn("flex shrink-0 rounded-lg border bg-background p-0.5", disabled && "opacity-50 pointer-events-none")}>
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            !checked ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onCheckedChange(false)}
        >
          Off
        </button>
        <button
          type="button"
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            checked ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onCheckedChange(true)}
        >
          On
        </button>
      </div>
    </div>
  );
}

const PAYMENT_STATUS_VARIANT: Record<string, "success" | "warning" | "info" | "destructive" | "secondary"> = {
  PAID: "success",
  PENDING: "warning",
  ON_CREDIT: "info",
  REFUNDED: "secondary",
  FAILED: "destructive",
};

export function PaymentStatusChip({ status }: { status: string }) {
  const variant = PAYMENT_STATUS_VARIANT[status] || "secondary";
  const label = status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge variant={variant}>{label}</Badge>;
}

export function EditDialogFooter({
  onCancel,
  onSave,
  loading,
  saveLabel = "Save & Regenerate",
}: {
  onCancel: () => void;
  onSave: () => void;
  loading: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-muted/20 px-6 py-4">
      <Button variant="outline" onClick={onCancel} disabled={loading}>
        Cancel
      </Button>
      <Button onClick={onSave} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {saveLabel}
      </Button>
    </div>
  );
}
