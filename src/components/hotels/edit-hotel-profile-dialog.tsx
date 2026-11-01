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

export type HotelProfileEditValues = {
  id: string;
  name: string;
  address: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  checkInTime: string;
  checkOutTime: string;
};

type FormState = {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  checkInTime: string;
  checkOutTime: string;
};

function toForm(hotel: HotelProfileEditValues): FormState {
  return {
    name: hotel.name,
    address: hotel.address,
    city: hotel.city || "",
    phone: hotel.phone || "",
    email: hotel.email || "",
    checkInTime: hotel.checkInTime || "02:00 PM",
    checkOutTime: hotel.checkOutTime || "12:00 PM",
  };
}

interface EditHotelProfileDialogProps {
  hotel: HotelProfileEditValues;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
}

export function EditHotelProfileDialog({
  hotel,
  variant = "outline",
  size = "sm",
  label = "Edit",
}: EditHotelProfileDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(hotel));

  function openDialog() {
    setForm(toForm(hotel));
    setOpen(true);
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

    setSaving(true);
    try {
      const res = await fetch(`/api/crm/hotels/${hotel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim(),
          city: form.city.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || "",
          checkInTime: form.checkInTime.trim() || "02:00 PM",
          checkOutTime: form.checkOutTime.trim() || "12:00 PM",
        }),
      });
      const { ok, error } = await parseApiResponse(res);
      if (!ok) throw new Error(error || "Failed to update hotel");

      toast.success("Hotel profile updated");
      setOpen(false);
      router.refresh();

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update hotel");
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
            <DialogTitle>Edit hotel profile</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="hotel-name">Hotel name</Label>
              <Input
                id="hotel-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Property name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hotel-address">Address</Label>
              <Input
                id="hotel-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Full address"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hotel-city">City</Label>
                <Input
                  id="hotel-city"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotel-phone">Phone</Label>
                <Input
                  id="hotel-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hotel-email">Email</Label>
              <Input
                id="hotel-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="reservations@hotel.com"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hotel-checkin">Check-in</Label>
                <Input
                  id="hotel-checkin"
                  value={form.checkInTime}
                  onChange={(e) => setForm((f) => ({ ...f, checkInTime: e.target.value }))}
                  placeholder="02:00 PM"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotel-checkout">Check-out</Label>
                <Input
                  id="hotel-checkout"
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
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
