"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DEFAULT_TRIP_TERMS,
  TRIP_MARKUP_TYPE_OPTIONS,
  TRIP_PLAN_STATUS_LABELS,
  TRIP_SERVICE_TYPE_OPTIONS,
} from "@/lib/constants/trip-plan";
import { computeItemSellPrice } from "@/lib/trip-plan-costing";
import { formatCurrency } from "@/lib/utils";
import type { TripMarkupType, TripPlanStatus, TripServiceType } from "@prisma/client";

export interface TripPlanItemForm {
  id?: string;
  dayNumber: number;
  sortOrder: number;
  serviceType: TripServiceType;
  title: string;
  description: string;
  supplierName: string;
  location: string;
  serviceDate: string;
  quantity: number;
  costPrice: number;
  markupType: TripMarkupType;
  markupValue: number;
  sellPrice: number;
}

export interface TripPlanFormState {
  id?: string;
  leadId: string;
  version: number;
  status: TripPlanStatus;
  title: string;
  travelDate: string;
  returnDate: string;
  destinations: string;
  adultCount: string;
  childCount: string;
  infantCount: string;
  durationDays: string;
  currency: string;
  gstRate: string;
  offerPrice: string;
  inclusions: string;
  exclusions: string;
  terms: string;
  internalNotes: string;
  items: TripPlanItemForm[];
}

function emptyItem(day = 1): TripPlanItemForm {
  return {
    dayNumber: day,
    sortOrder: 0,
    serviceType: "HOTEL",
    title: "",
    description: "",
    supplierName: "",
    location: "",
    serviceDate: "",
    quantity: 1,
    costPrice: 0,
    markupType: "FIXED",
    markupValue: 0,
    sellPrice: 0,
  };
}

function toDateInput(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildInitialState(
  leadId: string,
  lead?: {
    name: string;
    destinations?: string | null;
    travelDate?: string | Date | null;
    returnDate?: string | Date | null;
    adultCount?: number | null;
    childCount?: number | null;
    infantCount?: number | null;
  },
  plan?: Partial<TripPlanFormState> & { items?: TripPlanItemForm[] }
): TripPlanFormState {
  const dest = lead?.destinations || "";
  return {
    leadId,
    version: plan?.version ?? 1,
    status: plan?.status ?? "DRAFT",
    title: plan?.title || (dest ? `${dest} Trip` : `${lead?.name || "Guest"} Trip`),
    travelDate: plan?.travelDate ?? toDateInput(lead?.travelDate),
    returnDate: plan?.returnDate ?? toDateInput(lead?.returnDate),
    destinations: plan?.destinations ?? dest,
    adultCount: plan?.adultCount ?? (lead?.adultCount != null ? String(lead.adultCount) : "2"),
    childCount: plan?.childCount ?? (lead?.childCount != null ? String(lead.childCount) : "0"),
    infantCount: plan?.infantCount ?? (lead?.infantCount != null ? String(lead.infantCount) : "0"),
    durationDays: plan?.durationDays ?? "",
    currency: plan?.currency ?? "INR",
    gstRate: plan?.gstRate ?? "5",
    offerPrice: plan?.offerPrice ?? "",
    inclusions: plan?.inclusions ?? "",
    exclusions: plan?.exclusions ?? "",
    terms: plan?.terms ?? DEFAULT_TRIP_TERMS,
    internalNotes: plan?.internalNotes ?? "",
    items: plan?.items?.length ? plan.items : [emptyItem(1)],
    id: plan?.id,
  };
}

function recalcItem(item: TripPlanItemForm): TripPlanItemForm {
  const sellPrice = computeItemSellPrice(
    item.costPrice,
    item.quantity,
    item.markupType,
    item.markupValue
  );
  return { ...item, sellPrice };
}

export function TripPlanBuilder({
  leadId,
  lead,
  initialPlan,
}: {
  leadId: string;
  lead: {
    id: string;
    name: string;
    queryRef?: string | null;
    destinations?: string | null;
    travelDate?: string | Date | null;
    returnDate?: string | Date | null;
    adultCount?: number | null;
    childCount?: number | null;
    infantCount?: number | null;
  };
  initialPlan?: TripPlanFormState | null;
}) {
  const router = useRouter();
  const isNew = !initialPlan?.id;
  const [form, setForm] = useState<TripPlanFormState>(() =>
    buildInitialState(leadId, lead, initialPlan ?? undefined)
  );
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const totals = useMemo(() => {
    const items = form.items.map(recalcItem);
    const subtotalCost = items.reduce((s, i) => s + i.costPrice * i.quantity, 0);
    const subtotalSell = items.reduce((s, i) => s + i.sellPrice, 0);
    const gstRate = parseFloat(form.gstRate) || 0;
    const gstAmount = gstRate > 0 ? (subtotalSell * gstRate) / 100 : 0;
    const computedOffer = subtotalSell + gstAmount;
    const offerPrice = form.offerPrice ? parseFloat(form.offerPrice) : computedOffer;
    return { subtotalCost, subtotalSell, gstAmount, computedOffer, offerPrice };
  }, [form]);

  const maxDay = useMemo(
    () => Math.max(1, ...form.items.map((i) => i.dayNumber)),
    [form.items]
  );

  const updateItem = useCallback((index: number, patch: Partial<TripPlanItemForm>) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = recalcItem({ ...items[index], ...patch });
      return { ...prev, items };
    });
  }, []);

  const addItem = (day?: number) => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, emptyItem(day ?? maxDay)],
    }));
  };

  const removeItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const payload = () => ({
    title: form.title,
    travelDate: form.travelDate || null,
    returnDate: form.returnDate || null,
    destinations: form.destinations || null,
    adultCount: form.adultCount ? parseInt(form.adultCount, 10) : null,
    childCount: form.childCount ? parseInt(form.childCount, 10) : null,
    infantCount: form.infantCount ? parseInt(form.infantCount, 10) : null,
    durationDays: form.durationDays ? parseInt(form.durationDays, 10) : null,
    currency: form.currency,
    gstRate: form.gstRate ? parseFloat(form.gstRate) : null,
    offerPrice: form.offerPrice ? parseFloat(form.offerPrice) : totals.computedOffer,
    inclusions: form.inclusions || null,
    exclusions: form.exclusions || null,
    terms: form.terms || null,
    internalNotes: form.internalNotes || null,
    items: form.items.map((item, index) => {
      const recalc = recalcItem(item);
      return {
        dayNumber: recalc.dayNumber,
        sortOrder: index,
        serviceType: recalc.serviceType,
        title: recalc.title,
        description: recalc.description || null,
        supplierName: recalc.supplierName || null,
        location: recalc.location || null,
        serviceDate: recalc.serviceDate || null,
        quantity: recalc.quantity,
        costPrice: recalc.costPrice,
        markupType: recalc.markupType,
        markupValue: recalc.markupValue,
        sellPrice: recalc.sellPrice,
      };
    }),
  });

  const save = async (markSent = false) => {
    if (!form.title.trim()) {
      toast.error("Trip title is required");
      return;
    }
    if (form.items.some((i) => !i.title.trim())) {
      toast.error("Every service line needs a title");
      return;
    }

    markSent ? setSending(true) : setSaving(true);
    try {
      const body = { ...payload(), ...(markSent ? { status: "SENT" as const } : {}) };
      let res: Response;

      if (isNew) {
        res = await fetch(`/api/crm/leads/${leadId}/trip-plans`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/crm/trip-plans/${form.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save trip plan");

      toast.success(markSent ? "Proposal sent" : "Trip plan saved");
      if (isNew && data.id) {
        router.replace(`/leads/${leadId}/trip-plan/${data.id}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
      setSending(false);
    }
  };

  const duplicate = async () => {
    if (!form.id) return;
    try {
      const res = await fetch(`/api/crm/trip-plans/${form.id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create new version");
      toast.success(`Created V${data.version}`);
      router.push(`/leads/${leadId}/trip-plan/${data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Duplicate failed");
    }
  };

  const itemsByDay = useMemo(() => {
    const map = new Map<number, { item: TripPlanItemForm; index: number }[]>();
    form.items.forEach((item, index) => {
      const list = map.get(item.dayNumber) || [];
      list.push({ item, index });
      map.set(item.dayNumber, list);
    });
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [form.items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/leads/${leadId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to lead
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{form.title || "Trip Plan"}</h1>
              <Badge variant="outline">V{form.version}</Badge>
              <Badge>{TRIP_PLAN_STATUS_LABELS[form.status]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {lead.queryRef ? `${lead.queryRef} · ` : ""}
              {lead.name}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/crm/trip-plans/${form.id}/pdf`} target="_blank" rel="noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={duplicate}>
                <Copy className="mr-2 h-4 w-4" />
                New version
              </Button>
            </>
          ) : null}
          <Button variant="outline" onClick={() => save(false)} disabled={saving || sending}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save draft
          </Button>
          <Button onClick={() => save(true)} disabled={saving || sending}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send proposal
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trip details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Trip title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Dubai 5N/6D Package"
                />
              </div>
              <div>
                <Label>Destinations</Label>
                <Input
                  value={form.destinations}
                  onChange={(e) => setForm({ ...form, destinations: e.target.value })}
                />
              </div>
              <div>
                <Label>Duration (days)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.durationDays}
                  onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                />
              </div>
              <div>
                <Label>Travel date</Label>
                <Input
                  type="date"
                  value={form.travelDate}
                  onChange={(e) => setForm({ ...form, travelDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Return date</Label>
                <Input
                  type="date"
                  value={form.returnDate}
                  onChange={(e) => setForm({ ...form, returnDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Adults</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.adultCount}
                  onChange={(e) => setForm({ ...form, adultCount: e.target.value })}
                />
              </div>
              <div>
                <Label>Children</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.childCount}
                  onChange={(e) => setForm({ ...form, childCount: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Services & itinerary</CardTitle>
              <Button variant="outline" size="sm" onClick={() => addItem()}>
                <Plus className="mr-2 h-4 w-4" />
                Add service
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {itemsByDay.map(([day, entries]) => (
                <div key={day}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-blue-700">Day {day}</h3>
                    <Button variant="ghost" size="sm" onClick={() => addItem(day)}>
                      <Plus className="mr-1 h-3 w-3" />
                      Add to day {day}
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {entries.map(({ item, index }) => (
                      <div key={index} className="rounded-lg border bg-muted/20 p-4">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <Select
                            value={item.serviceType}
                            onValueChange={(v) =>
                              updateItem(index, { serviceType: v as TripServiceType })
                            }
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TRIP_SERVICE_TYPE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeItem(index)}
                            disabled={form.items.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <Label>Title</Label>
                            <Input
                              value={item.title}
                              onChange={(e) => updateItem(index, { title: e.target.value })}
                              placeholder="e.g. 4* Hotel with breakfast"
                            />
                          </div>
                          <div>
                            <Label>Location</Label>
                            <Input
                              value={item.location}
                              onChange={(e) => updateItem(index, { location: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Supplier</Label>
                            <Input
                              value={item.supplierName}
                              onChange={(e) => updateItem(index, { supplierName: e.target.value })}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <Label>Description</Label>
                            <Textarea
                              rows={2}
                              value={item.description}
                              onChange={(e) => updateItem(index, { description: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Day</Label>
                            <Input
                              type="number"
                              min={1}
                              value={item.dayNumber}
                              onChange={(e) =>
                                updateItem(index, { dayNumber: parseInt(e.target.value, 10) || 1 })
                              }
                            />
                          </div>
                          <div>
                            <Label>Qty</Label>
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(index, { quantity: parseInt(e.target.value, 10) || 1 })
                              }
                            />
                          </div>
                          <div>
                            <Label>Cost (per unit)</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.costPrice}
                              onChange={(e) =>
                                updateItem(index, { costPrice: parseFloat(e.target.value) || 0 })
                              }
                            />
                          </div>
                          <div>
                            <Label>Markup</Label>
                            <div className="flex gap-2">
                              <Select
                                value={item.markupType}
                                onValueChange={(v) =>
                                  updateItem(index, { markupType: v as TripMarkupType })
                                }
                              >
                                <SelectTrigger className="w-[110px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TRIP_MARKUP_TYPE_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.markupValue}
                                onChange={(e) =>
                                  updateItem(index, {
                                    markupValue: parseFloat(e.target.value) || 0,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div>
                            <Label>Sell price (line total)</Label>
                            <Input
                              readOnly
                              value={formatCurrency(recalcItem(item).sellPrice)}
                              className="bg-muted"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inclusions, exclusions & terms</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div>
                <Label>Inclusions (one per line)</Label>
                <Textarea
                  rows={4}
                  value={form.inclusions}
                  onChange={(e) => setForm({ ...form, inclusions: e.target.value })}
                  placeholder="Return flights&#10;4 nights hotel with breakfast&#10;Airport transfers"
                />
              </div>
              <div>
                <Label>Exclusions (one per line)</Label>
                <Textarea
                  rows={3}
                  value={form.exclusions}
                  onChange={(e) => setForm({ ...form, exclusions: e.target.value })}
                  placeholder="Visa fees&#10;Personal expenses"
                />
              </div>
              <div>
                <Label>Terms & conditions</Label>
                <Textarea
                  rows={5}
                  value={form.terms}
                  onChange={(e) => setForm({ ...form, terms: e.target.value })}
                />
              </div>
              <div>
                <Label>Internal notes (not on PDF)</Label>
                <Textarea
                  rows={2}
                  value={form.internalNotes}
                  onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-base">Costing summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total cost</span>
                <span>{formatCurrency(totals.subtotalCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total sell</span>
                <span>{formatCurrency(totals.subtotalSell)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Margin</span>
                <span className="text-emerald-700">
                  {formatCurrency(totals.subtotalSell - totals.subtotalCost)}
                </span>
              </div>
              <div>
                <Label>GST %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={form.gstRate}
                  onChange={(e) => setForm({ ...form, gstRate: e.target.value })}
                />
              </div>
              {totals.gstAmount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST amount</span>
                  <span>{formatCurrency(totals.gstAmount)}</span>
                </div>
              ) : null}
              <div>
                <Label>Offer price (override optional)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={String(Math.round(totals.computedOffer))}
                  value={form.offerPrice}
                  onChange={(e) => setForm({ ...form, offerPrice: e.target.value })}
                />
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs text-emerald-800">Customer offer price</p>
                <p className="text-2xl font-bold text-emerald-900">
                  {formatCurrency(totals.offerPrice)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
