"use client";

import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormSettingToggle } from "@/components/booking/edit-form-section";
import {
  FLIGHT_CANCELLATION_CUSTOM_ID,
  FLIGHT_CANCELLATION_POLICIES,
  findFlightCancellationPolicyByText,
  resolveFlightCancellationPresetId,
} from "@/lib/constants/flight-cancellation-policies";

interface FlightCancellationPolicyFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
}

export function FlightCancellationPolicyFields({ form }: FlightCancellationPolicyFieldsProps) {
  const includeCancellationPolicy = Boolean(form.watch("includeCancellationPolicy"));
  const cancellationPolicy = form.watch("cancellationPolicy") || "";
  const [presetId, setPresetId] = useState(() => resolveFlightCancellationPresetId(cancellationPolicy));

  useEffect(() => {
    const resolved = resolveFlightCancellationPresetId(form.getValues("cancellationPolicy"));
    setPresetId(resolved);
  }, [cancellationPolicy, form]);

  function handlePresetChange(value: string) {
    setPresetId(value);
    if (value === FLIGHT_CANCELLATION_CUSTOM_ID) return;
    const option = FLIGHT_CANCELLATION_POLICIES.find((p) => p.id === value);
    if (option) {
      form.setValue("cancellationPolicy", option.text, { shouldDirty: true });
    }
  }

  function handlePolicyTextChange(value: string) {
    form.setValue("cancellationPolicy", value, { shouldDirty: true });
    const match = findFlightCancellationPolicyByText(value);
    setPresetId(match?.id ?? FLIGHT_CANCELLATION_CUSTOM_ID);
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-800 dark:bg-amber-950/20">
      <FormSettingToggle
        label="Add cancellation policy to voucher"
        description="Shown on the flight ticket PDF sent to the customer"
        checked={includeCancellationPolicy}
        onCheckedChange={(v) => form.setValue("includeCancellationPolicy", v)}
      />
      {includeCancellationPolicy && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Select policy template</Label>
            <Select value={presetId || undefined} onValueChange={handlePresetChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a cancellation policy" />
              </SelectTrigger>
              <SelectContent>
                {FLIGHT_CANCELLATION_POLICIES.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value={FLIGHT_CANCELLATION_CUSTOM_ID}>Custom (write your own)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Pick a template to auto-fill the policy text with timings. You can edit the text below before saving.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Policy text on voucher</Label>
            <Textarea
              value={cancellationPolicy}
              onChange={(e) => handlePolicyTextChange(e.target.value)}
              placeholder="Select a template above or write your own cancellation terms..."
              rows={6}
              className="resize-y bg-background text-sm leading-relaxed"
            />
          </div>
        </div>
      )}
    </div>
  );
}
