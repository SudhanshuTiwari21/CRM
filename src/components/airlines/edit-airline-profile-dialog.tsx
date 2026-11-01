"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
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

export type AirlineProfileEditValues = {
  id: string;
  name: string;
  iataCode: string | null;
  logoUrl: string | null;
};

type FormState = {
  name: string;
  iataCode: string;
  logoUrl: string;
};

function toForm(airline: AirlineProfileEditValues): FormState {
  return {
    name: airline.name,
    iataCode: airline.iataCode || "",
    logoUrl: airline.logoUrl || "",
  };
}

interface EditAirlineProfileDialogProps {
  airline: AirlineProfileEditValues;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
}

export function EditAirlineProfileDialog({
  airline,
  variant = "outline",
  size = "sm",
  label = "Edit",
}: EditAirlineProfileDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(airline));

  function openDialog() {
    setForm(toForm(airline));
    setOpen(true);
  }

  const previewLogo =
    form.logoUrl.trim() || getAirlineLogoUrl(form.name.trim() || airline.name) || null;

  async function save() {
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error("Airline name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/crm/airlines/${airline.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          iataCode: form.iataCode.trim().toUpperCase(),
          logoUrl: form.logoUrl.trim(),
        }),
      });
      const { ok, error } = await parseApiResponse(res);
      if (!ok) throw new Error(error || "Failed to update airline");

      toast.success("Airline profile updated");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update airline");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={openDialog}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit airline profile</DialogTitle>
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
              <Label htmlFor="airline-name">Airline name</Label>
              <Input
                id="airline-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="SpiceJet"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="airline-iata">IATA code</Label>
              <Input
                id="airline-iata"
                value={form.iataCode}
                onChange={(e) => setForm((f) => ({ ...f, iataCode: e.target.value.toUpperCase() }))}
                placeholder="SG"
                maxLength={2}
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="airline-logo">Logo URL (optional)</Label>
              <Input
                id="airline-logo"
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
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
