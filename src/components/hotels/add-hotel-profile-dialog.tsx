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

const emptyForm = {
  name: "",
  address: "",
  city: "",
  phone: "",
  email: "",
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
      const res = await fetch("/api/crm/hotels", {
        method: "POST",
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
                <Label htmlFor="add-hotel-phone">Phone</Label>
                <Input
                  id="add-hotel-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-hotel-email">Email</Label>
              <Input
                id="add-hotel-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="reservations@hotel.com"
              />
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
