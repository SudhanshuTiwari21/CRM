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
      });
      const { ok, data, error } = await parseApiResponse(res);
      if (!ok) throw new Error(error);

      const result = data as ParsedTicketResult;
      onExtracted(result);

      const warnCount = result.warnings?.length || 0;
      if (result.confidence === "low") {
        toast.warning(
          warnCount
            ? `Weak extraction — review fields. ${result.warnings[0]}`
            : "Weak extraction — please review and fill missing fields"
        );
      } else if (warnCount) {
        toast.success(`Filled from ticket (${result.confidence} confidence). ${warnCount} field(s) need review.`);
      } else {
        toast.success("Ticket details filled into the form");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to parse ticket");
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
              Upload a text-based e-ticket PDF to auto-fill {productType === "FLIGHT" ? "flight" : productType === "HOTEL" ? "hotel" : "bus"}{" "}
              details. Scanned image PDFs are not supported.
            </CardDescription>
          </div>
          <Badge variant="secondary">Local PDF text</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf,text/plain,.txt"
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
          {loading ? "Extracting…" : "Upload ticket PDF"}
        </Button>
        {lastFile && !loading && (
          <p className="text-xs text-muted-foreground">Last file: {lastFile}</p>
        )}
      </CardContent>
    </Card>
  );
}
