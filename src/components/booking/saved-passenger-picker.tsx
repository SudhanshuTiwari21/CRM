"use client";

import { useCallback, useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Bookmark, Loader2, Search, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import type { WizardForm } from "@/components/booking/offline-booking-wizard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  savedPassengerDisplayName,
  savedPassengerToWizardValues,
  wizardPassengerToSavePayload,
  type SavedPassengerRecord,
} from "@/lib/saved-passenger";

export type SavedPassengerTarget = number | "new";

function applySavedToForm(form: UseFormReturn<WizardForm>, index: number, saved: SavedPassengerRecord) {
  const values = savedPassengerToWizardValues(saved);
  (Object.keys(values) as (keyof typeof values)[]).forEach((key) => {
    const value = values[key];
    if (value !== undefined) {
      form.setValue(`passengers.${index}.${key}` as `passengers.${number}.${typeof key}`, value);
    }
  });
}

export function savedPassengerToAppendValue(saved: SavedPassengerRecord) {
  const values = savedPassengerToWizardValues(saved);
  return {
    title: values.title || "Mr",
    firstName: values.firstName || "",
    lastName: values.lastName || "",
    gender: values.gender || "Male",
    paxType: values.paxType || "adult",
    handBaggage: values.handBaggage || "7 KG",
    cabinBaggagePreset: values.cabinBaggagePreset || "7 KG",
    baggagePreset: values.baggagePreset || "",
    checkInBaggage: values.checkInBaggage || "",
    seat: values.seat || "",
    meal: values.meal || "none",
    frequentFlyerAirline: values.frequentFlyerAirline || "",
    frequentFlyerNumber: values.frequentFlyerNumber || "",
    wheelchairAssistance: values.wheelchairAssistance || false,
    dateOfBirth: values.dateOfBirth || "",
    passportNumber: values.passportNumber || "",
    passportIssuingCountry: values.passportIssuingCountry || "",
    passportIssueDate: values.passportIssueDate || "",
    passportExpiryDate: values.passportExpiryDate || "",
  } as NonNullable<WizardForm["passengers"]>[number];
}

export function useSavedPassengerActions(
  form: UseFormReturn<WizardForm>,
  appendPassenger: (value: NonNullable<WizardForm["passengers"]>[number]) => void
) {
  const [loadOpen, setLoadOpen] = useState(false);
  const [target, setTarget] = useState<SavedPassengerTarget>(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [passengers, setPassengers] = useState<SavedPassengerRecord[]>([]);

  const fetchPassengers = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/crm/saved-passengers${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load saved passengers");
      setPassengers(data.passengers || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load saved passengers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loadOpen) fetchPassengers(search);
  }, [loadOpen, search, fetchPassengers]);

  function openLoad(index: SavedPassengerTarget) {
    setTarget(index);
    setSearch("");
    setLoadOpen(true);
  }

  function handleSelect(saved: SavedPassengerRecord) {
    if (target === "new") {
      appendPassenger(savedPassengerToAppendValue(saved));
    } else {
      applySavedToForm(form, target, saved);
    }
    toast.success(`Loaded ${savedPassengerDisplayName(saved)}`);
    setLoadOpen(false);
  }

  async function handleSave(index: number) {
    const pax = form.getValues(`passengers.${index}`);
    if (!pax?.firstName?.trim()) {
      toast.error("Enter at least a first name before saving");
      return;
    }

    setSavingIndex(index);
    try {
      const res = await fetch("/api/crm/saved-passengers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wizardPassengerToSavePayload(pax)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success(
        data.updated
          ? "Passenger details updated in saved list"
          : "Passenger saved for future bookings"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSavingIndex(null);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Remove this saved passenger?")) return;
    try {
      const res = await fetch(`/api/crm/saved-passengers/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setPassengers((prev) => prev.filter((p) => p.id !== id));
      toast.success("Saved passenger removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  return {
    loadOpen,
    setLoadOpen,
    target,
    search,
    setSearch,
    loading,
    savingIndex,
    passengers,
    openLoad,
    handleSelect,
    handleSave,
    handleDelete,
  };
}

export function SavedPassengerLoadDialog({
  open,
  onOpenChange,
  target,
  search,
  onSearchChange,
  loading,
  passengers,
  onSelect,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: SavedPassengerTarget;
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  passengers: SavedPassengerRecord[];
  onSelect: (saved: SavedPassengerRecord) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {target === "new" ? "Add passenger from saved list" : "Load saved passenger"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name, seat, FF number…"
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Saved passengers are separate from customer profiles - for quick reuse on future bookings.
          </p>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : passengers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No saved passengers yet. Fill details and use &quot;Save for future&quot; on a passenger row.
              </p>
            ) : (
              passengers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p)}
                  className="flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{savedPassengerDisplayName(p)}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.paxType} · {p.gender}
                      {p.seat ? ` · Seat ${p.seat}` : ""}
                      {p.cabinBaggagePreset ? ` · Cabin ${p.cabinBaggagePreset}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={(e) => onDelete(p.id, e)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SavedPassengerRowActions({
  index,
  onSave,
  onLoad,
  saving,
}: {
  index: number;
  onSave: (index: number) => void;
  onLoad: (index: SavedPassengerTarget) => void;
  saving: boolean;
}) {
  return (
    <div className="ml-auto flex shrink-0 gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={() => onLoad(index)}
      >
        <UserRound className="mr-1 h-3.5 w-3.5" />
        Load
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        disabled={saving}
        onClick={() => onSave(index)}
      >
        {saving ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Bookmark className="mr-1 h-3.5 w-3.5" />
        )}
        Save for future
      </Button>
    </div>
  );
}
