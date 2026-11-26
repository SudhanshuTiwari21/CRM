"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseApiResponse } from "@/lib/parse-api-response";
import { isValidGstin } from "@/lib/gstin-lookup";

export type GstinAutofillData = {
  gstin: string;
  legalName?: string;
  tradeName?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  status?: string;
  source: "api" | "parsed";
};

type GstinAutofillButtonProps = {
  gstin?: string | null;
  onFetched: (data: GstinAutofillData) => void;
  label?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
};

export function GstinAutofillButton({
  gstin,
  onFetched,
  label = "Fetch",
  size = "sm",
  variant = "outline",
}: GstinAutofillButtonProps) {
  const [loading, setLoading] = useState(false);

  async function lookup() {
    const value = (gstin || "").trim().toUpperCase();
    if (!value) {
      toast.error("Enter GSTIN first");
      return;
    }
    if (!isValidGstin(value)) {
      toast.error("Invalid GSTIN format");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/crm/gstin/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gstin: value }),
      });
      const { ok, data, error } = await parseApiResponse(res);
      if (!ok) throw new Error(error || "GSTIN lookup failed");

      const result = data as unknown as GstinAutofillData;
      onFetched({ ...result, gstin: value });

      if (result.source === "api") {
        toast.success(
          result.status && result.status !== "Active"
            ? `GSTIN fetched (${result.status})`
            : "GSTIN details fetched and form filled"
        );
      } else {
        toast.success(
          "GSTIN format/state validated. Add GSTIN_API_KEY in env for full address autofill."
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "GSTIN lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" size={size} variant={variant} onClick={() => void lookup()} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Search className="mr-1.5 h-3.5 w-3.5" />
      )}
      {label}
    </Button>
  );
}
