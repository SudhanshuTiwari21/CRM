"use client";

import { useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { WizardForm } from "@/components/booking/offline-booking-wizard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  calculateFlightGst,
  calculateFlightInvoiceTotal,
  formatInr,
  getStateCodeFromGstin,
} from "@/lib/gst-calculator";
import { getAdultPassengers, passengerDisplayName, sumAdultBaseFares } from "@/lib/flight-fare-breakup";
import { FormSettingToggle } from "@/components/booking/edit-form-section";

interface FlightInvoiceFieldsProps {
  form: UseFormReturn<WizardForm>;
}

export function FlightInvoiceFields({ form }: FlightInvoiceFieldsProps) {
  const [agencyGstin, setAgencyGstin] = useState<string | null>(null);
  const [agencyStateCode, setAgencyStateCode] = useState<string | null>(null);
  const [msmes, setMsmes] = useState<{ label: string; number: string }[]>([]);

  useEffect(() => {
    fetch("/api/crm/settings")
      .then(async (r) => {
        const type = r.headers.get("content-type") || "";
        if (!r.ok || !type.includes("application/json")) return null;
        return r.json();
      })
      .then((data) => {
        const gstin = data?.agency?.gstin || null;
        setAgencyGstin(gstin);
        setAgencyStateCode(getStateCodeFromGstin(gstin));
      })
      .catch(() => {
        setAgencyGstin(null);
        setAgencyStateCode(null);
      });

    fetch("/api/crm/msme")
      .then((r) => r.json())
      .then((d) => setMsmes(d.msmes || []))
      .catch(() => setMsmes([]));
  }, []);

  const hasAgencyGst = Boolean(agencyGstin?.trim());
  const invoiceTaxType = form.watch("invoiceTaxType") as "ITC" | "NON_ITC" | undefined;
  const buyerGstin = form.watch("buyerGstin") as string | undefined;
  const customerGstin = form.watch("customer.gstin") as string | undefined;
  const baseFare = Number(form.watch("baseFare") || 0);
  const serviceCharge = Number(form.watch("serviceCharge") || 0);
  const discountAmount = Number(form.watch("discountAmount") || 0);
  const passengers = form.watch("passengers") || [];
  const adults = getAdultPassengers(passengers);

  function setAdultBaseFare(passengerIndex: number, raw: string) {
    const value = raw === "" ? undefined : Number(raw);
    form.setValue(`passengers.${passengerIndex}.baseFare`, value, { shouldDirty: true });
    const updated = form.getValues("passengers") || [];
    form.setValue("baseFare", sumAdultBaseFares(updated), { shouldDirty: true });
  }

  function distributeBaseFareEvenly() {
    if (adults.length === 0 || baseFare <= 0) return;
    const each = Math.round((baseFare / adults.length) * 100) / 100;
    let adultCount = 0;
    passengers.forEach((p, i) => {
      if ((p.paxType || "adult") !== "adult") return;
      const amount =
        adultCount === adults.length - 1
          ? Math.round((baseFare - each * (adults.length - 1)) * 100) / 100
          : each;
      form.setValue(`passengers.${i}.baseFare`, amount, { shouldDirty: true });
      adultCount++;
    });
  }

  useEffect(() => {
    if (invoiceTaxType === "ITC" && customerGstin && !buyerGstin) {
      form.setValue("buyerGstin", customerGstin.toUpperCase());
    }
  }, [invoiceTaxType, customerGstin, buyerGstin, form]);

  const tax = useMemo(
    () =>
      calculateFlightGst({
        serviceCharge,
        agencyStateCode,
        buyerGstin: buyerGstin || customerGstin,
        buyerState: form.watch("customer.state") as string | undefined,
        invoiceTaxType: invoiceTaxType || "NON_ITC",
      }),
    [serviceCharge, agencyStateCode, buyerGstin, customerGstin, invoiceTaxType, form]
  );

  const invoiceSubtotal = useMemo(
    () => calculateFlightInvoiceTotal(baseFare, serviceCharge, tax, discountAmount),
    [baseFare, serviceCharge, tax, discountAmount]
  );

  useEffect(() => {
    form.setValue("totalAmount", invoiceSubtotal);
    form.setValue("paymentGatewayCharge", 0);
    if (hasAgencyGst) {
      form.setValue("flightInvoiceSubtotal", invoiceSubtotal);
    }
  }, [invoiceSubtotal, hasAgencyGst, form]);

  return (
    <div className="space-y-4 sm:col-span-2">
      {invoiceTaxType === "ITC" && (
        <div className="space-y-2">
          <Label>Buyer GSTIN *</Label>
          <Input
            {...form.register("buyerGstin")}
            placeholder="19AAEFB7856M1ZT"
            onChange={(e) => form.setValue("buyerGstin", e.target.value.toUpperCase())}
          />
        </div>
      )}

      {hasAgencyGst ? (
        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-base">Base Fare - Adult wise (INR)</Label>
              {adults.length > 1 && baseFare > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={distributeBaseFareEvenly}>
                  Split total evenly
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Fare reimbursement per adult - shown as separate lines on the tax invoice.</p>
            {adults.map((p, adultIdx) => {
              const passengerIndex = passengers.indexOf(p);
              const label = passengerDisplayName(p) || `Adult ${adultIdx + 1}`;
              return (
                <div key={`adult-fare-${passengerIndex}`} className="space-y-2">
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={p.baseFare ?? ""}
                    onChange={(e) => setAdultBaseFare(passengerIndex, e.target.value)}
                  />
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t pt-3 text-sm font-medium">
              <span>Total Base Fare</span>
              <span>{formatInr(sumAdultBaseFares(passengers) || baseFare)}</span>
            </div>
            <input type="hidden" {...form.register("baseFare")} />
          </div>
          <div className="space-y-2">
            <Label>Service Charge / Other Charges (INR) *</Label>
            <Input {...form.register("serviceCharge")} type="number" min={0} step="0.01" placeholder="438.98" />
            <p className="text-xs text-muted-foreground">Taxable @ 18% (HSN 998551)</p>
          </div>
        </div>
      ) : (
        <NonGstFlightTotalFields form={form} />
      )}

      {hasAgencyGst && (
        <>
          <div className="space-y-2">
            <Label>Discount (INR)</Label>
            <Input {...form.register("discountAmount")} type="number" min={0} step="0.01" placeholder="0.00" />
          </div>

          {msmes.length > 0 && (
            <div className="space-y-2">
              <Label>MSME / Udyam (optional)</Label>
              <Select
                value={form.watch("msmeNumber") || "__none__"}
                onValueChange={(v) => form.setValue("msmeNumber", v === "__none__" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Select MSME" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {msmes.map((m) => (
                    <SelectItem key={m.number} value={m.number}>
                      {m.label} - {m.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
            <p className="font-medium">Tax Breakdown (on service charge)</p>
            <div className="grid gap-1 sm:grid-cols-2">
              <p>Taxable Value: {formatInr(tax.taxableValue)}</p>
              <p>Place of Supply: {tax.placeOfSupply || "Same state (CGST + SGST)"}</p>
              {tax.isInterState ? (
                <p>IGST @ {tax.igstRate}%: {formatInr(tax.igstAmount)}</p>
              ) : (
                <>
                  <p>CGST @ {tax.cgstRate}%: {formatInr(tax.cgstAmount)}</p>
                  <p>SGST @ {tax.sgstRate}%: {formatInr(tax.sgstAmount)}</p>
                </>
              )}
            </div>
            {discountAmount > 0 && (
              <p className="text-amber-700">Discount: −{formatInr(discountAmount)}</p>
            )}
            <p className="pt-2 border-t font-semibold">Invoice Total: {formatInr(invoiceSubtotal)}</p>
          </div>
        </>
      )}

      <div className="space-y-2 rounded-lg border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
        <Label className="text-amber-900 dark:text-amber-100">Remarks / Narration (shown on invoice)</Label>
        <Textarea
          {...form.register("invoiceNarration")}
          rows={3}
          placeholder="e.g. Sector - MAA-CCU 11100/-"
          className="border-amber-200 bg-white dark:bg-background"
        />
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Charge breakup or notes - highlighted on the printed invoice.
        </p>
      </div>

      <FormSettingToggle
        label="Show passenger name on invoice"
        description="Hide passenger name for privacy on B2B invoices"
        checked={form.watch("showPassengerName") !== false}
        onCheckedChange={(v) => form.setValue("showPassengerName", v)}
      />

      <input type="hidden" {...form.register("totalAmount")} />
      <input type="hidden" {...form.register("paymentGatewayCharge")} />
      <input type="hidden" {...form.register("flightInvoiceSubtotal")} />
    </div>
  );
}

function NonGstFlightTotalFields({ form }: { form: UseFormReturn<WizardForm> }) {
  const subtotal = Number(form.watch("flightInvoiceSubtotal") || form.watch("totalAmount") || 0);

  useEffect(() => {
    form.setValue("paymentGatewayCharge", 0);
    form.setValue("totalAmount", subtotal);
  }, [subtotal, form]);

  function handleSubtotalChange(raw: string) {
    const value = raw === "" ? 0 : Number(raw);
    form.setValue("flightInvoiceSubtotal", value, { shouldDirty: true });
    form.setValue("paymentGatewayCharge", 0);
    form.setValue("totalAmount", value);
  }

  return (
    <div className="space-y-2">
      <Label>Total Amount (INR) *</Label>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={subtotal || ""}
        onChange={(e) => handleSubtotalChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        Add agency GSTIN in Settings to enable fare breakup and tax invoice fields.
      </p>
    </div>
  );
}
