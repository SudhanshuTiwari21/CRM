"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneWithCountry } from "@/components/ui/phone-with-country";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseApiResponse } from "@/lib/parse-api-response";
import { COUNTRY_DIAL_CODES } from "@/lib/country-dial-codes";

const HOTEL_COUNTRY_OPTIONS = [...COUNTRY_DIAL_CODES].sort((a, b) =>
  a.name.localeCompare(b.name)
);

const emptyForm = {
  name: "",
  address: "",
  city: "",
  country: "",
  phone: "",
  emails: ["", "", ""] as [string, string, string],
  checkInTime: "02:00 PM",
  checkOutTime: "12:00 PM",
};

interface AddHotelProfileDialogProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function AddHotelProfileDialog({
  variant = "default",
  size = "sm",
}: AddHotelProfileDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  function openDialog() {
    setForm(emptyForm);
    setOpen(true);
  }

  function setEmailAt(index: 0 | 1 | 2, value: string) {
    setForm((f) => {
      const emails = [...f.emails] as [string, string, string];
      emails[index] = value;
      return { ...f, emails };
    });
  }

  async function save() {
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error("Hotel name is required");
      return;
    }
    if (!form.address.trim() || form.address.trim().length < 3) {
      toast.error("Address is required");
      return;
    }

    const emailValues = form.emails.map((e) => e.trim()).filter(Boolean);
    for (const e of emailValues) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        toast.error(`Invalid email: ${e}`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/crm/hotels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim(),
          city: form.city.trim() || undefined,
          country: form.country.trim() || undefined,
          phone: form.phone.trim() || undefined,
          emails: form.emails.map((e) => e.trim()),
          checkInTime: form.checkInTime.trim() || "02:00 PM",
          checkOutTime: form.checkOutTime.trim() || "12:00 PM",
        }),
      });
      const { ok, error } = await parseApiResponse(res);
      if (!ok) throw new Error(error || "Failed to create hotel");

      toast.success("Hotel profile created");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create hotel");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={openDialog}>
        <Plus className="mr-2 h-3.5 w-3.5" />
        Add hotel
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add hotel profile</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-hotel-name">Hotel name</Label>
              <Input
                id="add-hotel-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Property name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-hotel-address">Address</Label>
              <Input
                id="add-hotel-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Full address"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add-hotel-city">City</Label>
                <Input
                  id="add-hotel-city"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Select
                  value={form.country || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {HOTEL_COUNTRY_OPTIONS.map((c) => (
                      <SelectItem key={c.iso2} value={c.name}>
                        <span className="flex items-center gap-2">
                          <span aria-hidden>{c.flag}</span>
                          <span>{c.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <PhoneWithCountry
                value={form.phone}
                defaultCountryIso2={
                  HOTEL_COUNTRY_OPTIONS.find((c) => c.name === form.country)?.iso2 || "IN"
                }
                placeholder="Phone number"
                onChange={(full) => setForm((f) => ({ ...f, phone: full }))}
              />
            </div>
            <div className="space-y-3">
              <div>
                <Label>Emails</Label>
                <p className="text-xs text-muted-foreground">Up to 3 hotel contact emails</p>
              </div>
              {([0, 1, 2] as const).map((i) => (
                <Input
                  key={i}
                  id={`add-hotel-email-${i}`}
                  type="email"
                  value={form.emails[i]}
                  onChange={(e) => setEmailAt(i, e.target.value)}
                  placeholder={
                    i === 0 ? "reservations@hotel.com" : i === 1 ? "sales@hotel.com" : "fo@hotel.com"
                  }
                />
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add-hotel-checkin">Check-in</Label>
                <Input
                  id="add-hotel-checkin"
                  value={form.checkInTime}
                  onChange={(e) => setForm((f) => ({ ...f, checkInTime: e.target.value }))}
                  placeholder="02:00 PM"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-hotel-checkout">Check-out</Label>
                <Input
                  id="add-hotel-checkout"
                  value={form.checkOutTime}
                  onChange={(e) => setForm((f) => ({ ...f, checkOutTime: e.target.value }))}
                  placeholder="12:00 PM"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create hotel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
