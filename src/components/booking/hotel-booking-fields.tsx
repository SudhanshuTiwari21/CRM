"use client";

import { useEffect, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HOTEL_ROOM_AMENITIES, MEAL_PLAN_OPTIONS } from "@/lib/constants/hotel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MAX_ADULTS_PER_ROOM,
  MAX_CHILDREN_PER_ROOM,
  MAX_ROOMS,
  normalizeHotelRooms,
  resizeHotelRooms,
  totalsFromHotelRooms,
  updateRoomOccupancy,
} from "@/lib/hotel-rooms";
import type { HotelRoom } from "@/types/booking";
import { Users } from "lucide-react";

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

interface HotelBookingFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  /** Kept for call-site compatibility; room UI manages guests itself */
  guestFields?: { id: string }[];
  appendGuest?: (value: { name: string; type: "adult" | "child" }) => void;
}

function rangeOptions(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export function HotelBookingFields({ form }: HotelBookingFieldsProps) {
  const [loadingProfile, setLoadingProfile] = useState(false);
  const propertyName = form.watch("propertyName");
  const selectedAmenities: string[] = form.watch("roomAmenities") || [];
  const includeCancellationPolicy = form.watch("includeCancellationPolicy");
  const roomsWatch = form.watch("rooms");
  const roomsCountWatch = form.watch("roomsCount");

  const rooms: HotelRoom[] =
    Array.isArray(roomsWatch) && roomsWatch.length > 0
      ? normalizeHotelRooms({ rooms: roomsWatch })
      : normalizeHotelRooms({
          roomsCount: roomsCountWatch || 1,
          adultsCount: form.getValues("adultsCount"),
          childrenCount: form.getValues("childrenCount"),
          guests: form.getValues("guests"),
        });

  function syncRooms(nextRooms: HotelRoom[]) {
    const totals = totalsFromHotelRooms(nextRooms);
    form.setValue("rooms", nextRooms, { shouldDirty: true });
    form.setValue("roomsCount", totals.roomsCount, { shouldDirty: true });
    form.setValue("adultsCount", totals.adultsCount, { shouldDirty: true });
    form.setValue("childrenCount", totals.childrenCount, { shouldDirty: true });
    form.setValue("guests", totals.guests, { shouldDirty: true });
  }

  // Seed rooms once if missing (edit/create forms)
  useEffect(() => {
    const current = form.getValues("rooms");
    if (Array.isArray(current) && current.length > 0) return;
    const seeded = normalizeHotelRooms({
      roomsCount: form.getValues("roomsCount") || 1,
      adultsCount: form.getValues("adultsCount"),
      childrenCount: form.getValues("childrenCount"),
      guests: form.getValues("guests"),
    });
    syncRooms(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function setRoomsCount(count: number) {
    syncRooms(resizeHotelRooms(rooms, count));
  }

  function setRoomAdults(roomIndex: number, adults: number) {
    const next = rooms.map((room, i) =>
      i === roomIndex ? updateRoomOccupancy(room, adults, room.childrenCount) : room
    );
    syncRooms(next);
  }

  function setRoomChildren(roomIndex: number, children: number) {
    const next = rooms.map((room, i) =>
      i === roomIndex ? updateRoomOccupancy(room, room.adultsCount, children) : room
    );
    syncRooms(next);
  }

  function setGuestName(roomIndex: number, guestIndex: number, name: string) {
    const next = rooms.map((room, i) => {
      if (i !== roomIndex) return room;
      const guests = room.guests.map((g, gi) => (gi === guestIndex ? { ...g, name } : g));
      return { ...room, guests };
    });
    syncRooms(next);
  }

  const totalGuests = rooms.reduce((sum, r) => sum + r.adultsCount + r.childrenCount, 0);

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

      {/* Room breakup — Riya-style */}
      <div className="space-y-3 rounded-lg border p-4 sm:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-semibold">Add Room(s)</Label>
          </div>
          <div className="inline-flex items-center rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
            {rooms.length} Room{rooms.length !== 1 ? "s" : ""} {totalGuests} Guest
            {totalGuests !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="grid gap-3 border-b pb-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">No. Of Rooms</Label>
            <Select
              value={String(rooms.length)}
              onValueChange={(v) => setRoomsCount(parseInt(v, 10))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rangeOptions(1, MAX_ROOMS).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          {rooms.map((room, roomIndex) => (
            <div key={room.roomNumber} className="rounded-md border bg-muted/20 p-3">
              <p className="mb-3 text-sm font-semibold text-blue-800">Room {room.roomNumber}</p>

              <div className="mb-3 grid gap-3 sm:grid-cols-3">
                {roomIndex === 0 ? (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">No. Of Rooms</Label>
                    <Select
                      value={String(rooms.length)}
                      onValueChange={(v) => setRoomsCount(parseInt(v, 10))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {rangeOptions(1, MAX_ROOMS).map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="hidden sm:block" />
                )}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">No. Of Adults</Label>
                  <Select
                    value={String(room.adultsCount)}
                    onValueChange={(v) => setRoomAdults(roomIndex, parseInt(v, 10))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rangeOptions(1, MAX_ADULTS_PER_ROOM).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">No. Of Child</Label>
                  <Select
                    value={String(room.childrenCount)}
                    onValueChange={(v) => setRoomChildren(roomIndex, parseInt(v, 10))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rangeOptions(0, MAX_CHILDREN_PER_ROOM).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Guest names (Room {room.roomNumber})</Label>
                <p className="text-[11px] text-muted-foreground">
                  Enter each guest name for this room — they will print on the voucher.
                </p>
                <div className="grid gap-2">
                  {room.guests.map((guest, guestIndex) => {
                    const typeIndex =
                      room.guests.slice(0, guestIndex + 1).filter((g) => g.type === guest.type).length;
                    const placeholder =
                      guest.type === "child"
                        ? `Child ${typeIndex} name`
                        : typeIndex === 1
                          ? "Primary guest name"
                          : `Adult ${typeIndex} name`;
                    return (
                      <div key={`${room.roomNumber}-${guest.type}-${guestIndex}`} className="flex gap-2">
                        <Input
                          value={guest.name || ""}
                          onChange={(e) => setGuestName(roomIndex, guestIndex, e.target.value)}
                          placeholder={placeholder}
                        />
                        <div className="flex w-24 shrink-0 items-center justify-center rounded-md border bg-background text-xs text-muted-foreground">
                          {guest.type === "child" ? "Child" : "Adult"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hidden registered fields so RHF still tracks totals */}
      <input type="hidden" {...form.register("roomsCount", { valueAsNumber: true })} />
      <input type="hidden" {...form.register("adultsCount", { valueAsNumber: true })} />
      <input type="hidden" {...form.register("childrenCount", { valueAsNumber: true })} />

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
