"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { parseApiResponse } from "@/lib/parse-api-response";
import type { ParsedTicketResult } from "@/lib/services/ticket-parse.service";

type ProductType = "FLIGHT" | "HOTEL" | "BUS";

export function TicketUploadPanel({
  productType,
  onExtracted,
}: {
  productType: ProductType;
  onExtracted: (result: ParsedTicketResult) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [lastFile, setLastFile] = useState<string | null>(null);

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setLoading(true);
    setLastFile(file.name);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("productHint", productType);

      const res = await fetch("/api/crm/bookings/parse-ticket", {
        method: "POST",
        body,
        credentials: "include",
      });
      const { ok, data, error } = await parseApiResponse(res);
      if (!ok) throw new Error(error || "Could not read ticket");

      const result = data as unknown as ParsedTicketResult;
      if (!result?.fields || !result.productType) {
        throw new Error(
          "Ticket was read but no usable high-confidence fields were found. Fill details manually or try a clearer upload."
        );
      }
      onExtracted(result);

      const warnCount = result.warnings?.length || 0;
      const fieldKeys = Object.keys(result.fields).filter((k) => k !== "productType");
      if (fieldKeys.length === 0 || result.confidence === "low") {
        toast.warning(
          warnCount
            ? `Nothing auto-filled (high-confidence only). ${result.warnings[0]}`
            : "Nothing auto-filled — OpenAI was not confident enough. Enter fields manually."
        );
      } else if (warnCount) {
        toast.success(
          `Filled ${fieldKeys.length} high-confidence field(s). ${warnCount} note(s) — review skipped fields.`
        );
      } else {
        toast.success(`Filled ${fieldKeys.length} high-confidence field(s) from ticket`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to parse ticket";
      toast.error(message, { duration: 8000 });
      console.error("[ticket-import]", error);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Import booked ticket
            </CardTitle>
            <CardDescription className="mt-1">
              Upload a ticket PDF or clear photo (PNG/JPG). OpenAI fills only very high-confidence fields —
              uncertain values are left blank for you to enter.
            </CardDescription>
          </div>
          <Badge variant="secondary">OpenAI · high confidence</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf,image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp,text/plain,.txt"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="mr-2 h-4 w-4" />
          )}
          {loading ? "Extracting…" : "Upload ticket PDF / image"}
        </Button>
        {lastFile && !loading && (
          <p className="text-xs text-muted-foreground">Last file: {lastFile}</p>
        )}
      </CardContent>
    </Card>
  );
}
