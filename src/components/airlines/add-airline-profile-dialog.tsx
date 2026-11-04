"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseApiResponse } from "@/lib/parse-api-response";
import { getAirlineLogoUrl } from "@/lib/airline-logo";

const emptyForm = {
  name: "",
  iataCode: "",
  logoUrl: "",
};

interface AddAirlineProfileDialogProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function AddAirlineProfileDialog({
  variant = "default",
  size = "sm",
}: AddAirlineProfileDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  function openDialog() {
    setForm(emptyForm);
    setOpen(true);
  }

  const previewLogo =
    form.logoUrl.trim() || getAirlineLogoUrl(form.name.trim()) || null;

  async function save() {
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error("Airline name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/crm/airlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          iataCode: form.iataCode.trim().toUpperCase(),
          logoUrl: form.logoUrl.trim(),
        }),
      });
      const { ok, error } = await parseApiResponse(res);
      if (!ok) throw new Error(error || "Failed to create airline");

      toast.success("Airline profile created");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create airline");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={openDialog}>
        <Plus className="mr-2 h-3.5 w-3.5" />
        Add airline
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add airline profile</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="flex items-center gap-3">
              {previewLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewLogo}
                  alt=""
                  className="h-12 w-12 rounded border bg-white object-contain p-1"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
                  Logo
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Logo preview updates from IATA lookup or custom URL.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-airline-name">Airline name</Label>
              <Input
                id="add-airline-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="SpiceJet"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-airline-iata">IATA code</Label>
              <Input
                id="add-airline-iata"
                value={form.iataCode}
                onChange={(e) => setForm((f) => ({ ...f, iataCode: e.target.value.toUpperCase() }))}
                placeholder="SG"
                maxLength={2}
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-airline-logo">Logo URL (optional)</Label>
              <Input
                id="add-airline-logo"
                value={form.logoUrl}
                onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create airline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
