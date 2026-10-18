"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CityAutocomplete } from "@/components/ui/city-autocomplete";
import { formatCurrency } from "@/lib/utils";
import { parseApiResponse } from "@/lib/parse-api-response";

type ActivityRow = {
  id: string;
  city: string;
  country: string | null;
  name: string;
  description: string | null;
  tag: string | null;
  startTimes: string | null;
  duration: string | null;
  costPrice: number | string;
  sellPrice: number | string;
  active: boolean;
};

const emptyForm = {
  city: "",
  country: "",
  name: "",
  description: "",
  tag: "",
  startTimes: "",
  duration: "",
  costPrice: "0",
  sellPrice: "0",
  active: true,
};

export function ActivitiesManager() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/crm/activities?${params}`, { credentials: "include" });
    const { ok, data } = await parseApiResponse(res);
    setRows(ok ? (data.activities as ActivityRow[]) || [] : []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: ActivityRow) {
    setEditingId(row.id);
    setForm({
      city: row.city,
      country: row.country || "",
      name: row.name,
      description: row.description || "",
      tag: row.tag || "",
      startTimes: row.startTimes || "",
      duration: row.duration || "",
      costPrice: String(Number(row.costPrice) || 0),
      sellPrice: String(Number(row.sellPrice) || 0),
      active: row.active,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.city.trim() || !form.name.trim()) {
      toast.error("City and activity name are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        city: form.city.trim(),
        country: form.country.trim() || null,
        name: form.name.trim(),
        description: form.description.trim() || null,
        tag: form.tag.trim() || null,
        startTimes: form.startTimes.trim() || null,
        duration: form.duration.trim() || null,
        costPrice: Number(form.costPrice) || 0,
        sellPrice: Number(form.sellPrice) || 0,
        active: form.active,
      };
      const res = await fetch(editingId ? `/api/crm/activities/${editingId}` : "/api/crm/activities", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const { ok, error } = await parseApiResponse(res);
      if (!ok) throw new Error(error || "Save failed");
      toast.success(editingId ? "Activity updated" : "Activity created");
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this activity?")) return;
    const res = await fetch(`/api/crm/activities/${id}`, { method: "DELETE" });
    const { ok, error } = await parseApiResponse(res);
    if (!ok) {
      toast.error(error || "Delete failed");
      return;
    }
    toast.success("Activity deleted");
    await load();
  }

  const byCity = rows.reduce<Record<string, ActivityRow[]>>((acc, row) => {
    const key = row.city || "Other";
    (acc[key] ||= []).push(row);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Activities</h1>
          <p className="text-sm text-muted-foreground">
            City-wise catalog for holiday packages. Pick these into Morning / Afternoon / Evening slots.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New activity
        </Button>
      </div>

      <Input
        placeholder="Search by city, name, or tag…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No activities yet. Create your first city activity to use in trip plans.
          </CardContent>
        </Card>
      ) : (
        Object.entries(byCity).map(([city, list]) => (
          <Card key={city}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{city}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {list.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{row.name}</p>
                      {row.tag && <Badge variant="secondary">{row.tag}</Badge>}
                      {!row.active && <Badge variant="outline">Inactive</Badge>}
                    </div>
                    {(row.startTimes || row.duration) && (
                      <p className="text-xs text-muted-foreground">
                        {row.startTimes ? `Starts: ${row.startTimes}` : ""}
                        {row.startTimes && row.duration ? " · " : ""}
                        {row.duration ? `Duration: ${row.duration}` : ""}
                      </p>
                    )}
                    {row.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{row.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">+ {formatCurrency(Number(row.sellPrice))}</p>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => void remove(row.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit activity" : "New activity"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>City *</Label>
              <CityAutocomplete
                value={form.city}
                onChange={(city) => setForm((f) => ({ ...f, city }))}
                onSelectCity={(c) => setForm((f) => ({ ...f, city: c.city, country: c.country || f.country }))}
              />
            </div>
            <div>
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
            </div>
            <div>
              <Label>Activity name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Tag</Label>
              <Input
                value={form.tag}
                placeholder="e.g. Must See"
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Start times</Label>
                <Input
                  value={form.startTimes}
                  placeholder="09:00 hrs, 12:00 hrs"
                  onChange={(e) => setForm((f) => ({ ...f, startTimes: e.target.value }))}
                />
              </div>
              <div>
                <Label>Duration</Label>
                <Input
                  value={form.duration}
                  placeholder="6 hrs"
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Cost (INR)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.costPrice}
                  onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
                />
              </div>
              <div>
                <Label>Sell / add-on price (INR)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sellPrice}
                  onChange={(e) => setForm((f) => ({ ...f, sellPrice: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
