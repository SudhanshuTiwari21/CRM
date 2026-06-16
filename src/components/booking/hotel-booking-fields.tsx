"use client";

import { useEffect, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HOTEL_ROOM_AMENITIES, MEAL_PLAN_OPTIONS } from "@/lib/constants/hotel";

function CheckBox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-gray-300"
    />
  );
}
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface HotelBookingFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  guestFields: { id: string }[];
  appendGuest: (value: { name: string; type: "adult" | "child" }) => void;
}

export function HotelBookingFields({ form, guestFields, appendGuest }: HotelBookingFieldsProps) {
  const [loadingProfile, setLoadingProfile] = useState(false);
  const propertyName = form.watch("propertyName");
  const selectedAmenities: string[] = form.watch("roomAmenities") || [];
  const includeCancellationPolicy = form.watch("includeCancellationPolicy");

  useEffect(() => {
    const name = propertyName?.trim();
    if (!name || name.length < 3) return;

    const timer = setTimeout(async () => {
      setLoadingProfile(true);
      try {
        const res = await fetch(`/api/crm/hotels/lookup?name=${encodeURIComponent(name)}`);
        const data = await res.json();
        if (data.found) {
          form.setValue("propertyAddress", data.address || "");
          form.setValue("city", data.city || "");
          form.setValue("propertyPhone", data.phone || "");
          form.setValue("propertyEmail", data.email || "");
          form.setValue("checkInTime", data.checkInTime || "02:00 PM");
          form.setValue("checkOutTime", data.checkOutTime || "12:00 PM");
        }
      } finally {
        setLoadingProfile(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [propertyName, form]);

  function toggleAmenity(amenity: string) {
    const current = form.getValues("roomAmenities") || [];
    const next = current.includes(amenity)
      ? current.filter((a: string) => a !== amenity)
      : [...current, amenity];
    form.setValue("roomAmenities", next);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label>Hotel Name *</Label>
        <Input {...form.register("propertyName")} placeholder="The Grand Empire" />
        {loadingProfile && <p className="text-xs text-muted-foreground">Loading saved hotel profile...</p>}
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Address *</Label>
        <Textarea {...form.register("propertyAddress")} placeholder="Full hotel address" rows={2} />
      </div>
      <div className="space-y-2">
        <Label>City</Label>
        <Input {...form.register("city")} placeholder="Patna" />
      </div>
      <div className="space-y-2">
        <Label>Hotel Phone</Label>
        <Input {...form.register("propertyPhone")} placeholder="9297871703" />
      </div>
      <div className="space-y-2">
        <Label>Hotel Email</Label>
        <Input {...form.register("propertyEmail")} type="text" inputMode="email" placeholder="fo@hotel.com" />
      </div>
      <div className="space-y-2">
        <Label>Room Type *</Label>
        <Input {...form.register("roomType")} placeholder="Superior Twin Room" />
      </div>
      <div className="space-y-2">
        <Label>Rooms</Label>
        <Input {...form.register("roomsCount")} type="number" min={1} defaultValue={1} />
      </div>
      <div className="space-y-2">
        <Label>Check In *</Label>
        <Input {...form.register("checkIn")} type="date" />
      </div>
      <div className="space-y-2">
        <Label>Check Out *</Label>
        <Input {...form.register("checkOut")} type="date" />
      </div>
      <div className="space-y-2">
        <Label>Check In Time</Label>
        <Input {...form.register("checkInTime")} placeholder="02:00 PM" defaultValue="02:00 PM" />
      </div>
      <div className="space-y-2">
        <Label>Check Out Time</Label>
        <Input {...form.register("checkOutTime")} placeholder="12:00 PM" defaultValue="12:00 PM" />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Meal Plan</Label>
        <Select
          value={form.watch("mealPlan") || "ROOM_ONLY"}
          onValueChange={(v) => form.setValue("mealPlan", v)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MEAL_PLAN_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Inclusions</Label>
        <Textarea {...form.register("inclusions")} placeholder="e.g. LIVE Singing on Weekend" rows={2} />
      </div>

      <div className="space-y-3 sm:col-span-2">
        <Label>Guests *</Label>
        {guestFields.map((field, i) => (
          <div key={field.id} className="flex gap-2">
            <Input {...form.register(`guests.${i}.name`)} placeholder="Guest Name" />
            <Select
              value={form.watch(`guests.${i}.type`)}
              onValueChange={(v) => form.setValue(`guests.${i}.type`, v as "adult" | "child")}
            >
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="adult">Adult</SelectItem>
                <SelectItem value="child">Child</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => appendGuest({ name: "", type: "adult" })}>
          <Plus className="mr-2 h-4 w-4" /> Add Guest
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border p-4 sm:col-span-2">
        <Label>Room Amenities (optional)</Label>
        <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
          {HOTEL_ROOM_AMENITIES.map((amenity) => (
            <label key={amenity} className="flex items-center gap-2 text-sm">
              <CheckBox
                checked={selectedAmenities.includes(amenity)}
                onChange={() => toggleAmenity(amenity)}
              />
              {amenity}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <CheckBox
            checked={Boolean(includeCancellationPolicy)}
            onChange={(v) => form.setValue("includeCancellationPolicy", v)}
          />
          Add cancellation policy to the voucher
        </label>
        {includeCancellationPolicy && (
          <Textarea
            {...form.register("cancellationPolicy")}
            placeholder="Enter hotel cancellation policy..."
            rows={3}
          />
        )}
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label>Agent Remarks</Label>
        <Textarea {...form.register("agentRemarks")} placeholder="Internal remarks" rows={2} />
      </div>
    </div>
  );
}
