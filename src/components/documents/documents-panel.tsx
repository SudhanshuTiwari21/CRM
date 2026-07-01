"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DocumentType, ProductType } from "@prisma/client";
import { Bus, Building2, FileText, Plane, Search, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatDateTime } from "@/lib/utils";
import { parseApiResponse } from "@/lib/parse-api-response";
import type { DocumentCategory } from "@/lib/services/document-list.service";

type DocumentRow = {
  id: string;
  fileName: string;
  type: DocumentType;
  generatedAt: string;
  bookingId: string;
  publicRef: string;
  productType: ProductType;
  passengerNames: string[];
};

const TEMPLATES: {
  id: DocumentCategory;
  name: string;
  icon: typeof Plane;
  description: string;
}[] = [
  {
    id: "flight-ticket",
    name: "Flight E-Ticket",
    icon: Plane,
    description: "IndiGo/Akasa-style multi-passenger ticket with PNR, segments, and baggage",
  },
  {
    id: "hotel-voucher",
    name: "Hotel Voucher",
    icon: Building2,
    description: "Confirmation number, property details, check-in/out, guest list",
  },
  {
    id: "bus-ticket",
    name: "Bus Ticket",
    icon: Bus,
    description: "Operator, route, boarding/dropping, seat assignments",
  },
  {
    id: "invoice",
    name: "Tax Invoice",
    icon: FileText,
    description: "GST invoice with agency branding and payment details",
  },
];

type DocumentsPanelProps = {
  agencyName?: string | null;
};

export function DocumentsPanel({ agencyName }: DocumentsPanelProps) {
  const [category, setCategory] = useState<DocumentCategory>("all");
  const [bookingRef, setBookingRef] = useState("");
  const [passenger, setPassenger] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (bookingRef.trim()) params.set("bookingRef", bookingRef.trim());
      if (passenger.trim()) params.set("passenger", passenger.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/crm/documents?${params.toString()}`);
      const { ok, data, error } = await parseApiResponse(res);
      if (!ok) throw new Error(error);
      setDocuments((data.documents as DocumentRow[] | undefined) || []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [category, bookingRef, passenger, from, to]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDocuments();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadDocuments]);

  const hasFilters =
    category !== "all" || Boolean(bookingRef.trim()) || Boolean(passenger.trim()) || Boolean(from) || Boolean(to);

  function clearFilters() {
    setCategory("all");
    setBookingRef("");
    setPassenger("");
    setFrom("");
    setTo("");
  }

  const activeTemplate = TEMPLATES.find((t) => t.id === category);

  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TEMPLATES.map((t) => {
          const selected = category === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setCategory(selected ? "all" : t.id)}
              className="text-left"
            >
              <Card
                className={cn(
                  "h-full transition-colors hover:border-primary/50",
                  selected && "border-primary ring-2 ring-primary/20"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <t.icon className={cn("h-5 w-5", selected ? "text-primary" : "text-muted-foreground")} />
                    <CardTitle className="text-sm">{t.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs">{t.description}</CardDescription>
                  <p className="mt-2 text-xs text-muted-foreground">Branded as: {agencyName || "Book to Roam"}</p>
                  {selected ? (
                    <p className="mt-2 text-xs font-medium text-primary">Showing {t.name.toLowerCase()} only</p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Click to filter list</p>
                  )}
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              {category === "all" ? "Recent Documents" : activeTemplate?.name}
            </CardTitle>
            {hasFilters && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear filters
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="doc-booking-ref" className="text-xs">
                Booking ID
              </Label>
              <Input
                id="doc-booking-ref"
                placeholder="e.g. FB-2026-000027"
                value={bookingRef}
                onChange={(e) => setBookingRef(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="doc-passenger" className="text-xs">
                Passenger name
              </Label>
              <Input
                id="doc-passenger"
                placeholder="Search traveller or guest"
                value={passenger}
                onChange={(e) => setPassenger(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-from" className="text-xs">
                From date
              </Label>
              <Input id="doc-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-to" className="text-xs">
                To date
              </Label>
              <Input id="doc-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading documents…</p>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 opacity-40" />
              <p>No documents match your filters</p>
              {hasFilters && (
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{documents.length} document(s)</p>
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{doc.fileName}</p>
                      <Badge variant="outline">{doc.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <Link href={`/bookings/${doc.bookingId}`} className="text-primary hover:underline">
                        {doc.publicRef}
                      </Link>
                      {" • "}
                      {formatDateTime(doc.generatedAt)}
                    </p>
                    {doc.passengerNames.length > 0 && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        Passengers: {doc.passengerNames.join(", ")}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="ml-3 shrink-0" asChild>
                    <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer">
                      View
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
