"use client";

import { useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { WizardForm } from "@/components/booking/offline-booking-wizard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  calculateFlightGst,
  calculateFlightInvoiceTotal,
  formatInr,
  getStateCodeFromGstin,
} from "@/lib/gst-calculator";

interface FlightInvoiceFieldsProps {
  form: UseFormReturn<WizardForm>;
}

export function FlightInvoiceFields({ form }: FlightInvoiceFieldsProps) {
  const [agencyStateCode, setAgencyStateCode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/crm/settings")
      .then(async (r) => {
        const type = r.headers.get("content-type") || "";
        if (!r.ok || !type.includes("application/json")) return null;
        const data = await r.json();
        return data;
      })
      .then((data) => setAgencyStateCode(getStateCodeFromGstin(data?.agency?.gstin)))
      .catch(() => setAgencyStateCode(null));
  }, []);
  const invoiceTaxType = form.watch("invoiceTaxType") as "ITC" | "NON_ITC" | undefined;
  const buyerGstin = form.watch("buyerGstin") as string | undefined;
  const customerGstin = form.watch("customer.gstin") as string | undefined;
  const baseFare = Number(form.watch("baseFare") || 0);
  const serviceCharge = Number(form.watch("serviceCharge") || 0);

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
        invoiceTaxType: invoiceTaxType || "NON_ITC",
      }),
    [serviceCharge, agencyStateCode, buyerGstin, customerGstin, invoiceTaxType]
  );

  const totalAmount = useMemo(
    () => calculateFlightInvoiceTotal(baseFare, serviceCharge, tax),
    [baseFare, serviceCharge, tax]
  );

  useEffect(() => {
    form.setValue("totalAmount", totalAmount);
  }, [totalAmount, form]);

  return (
    <div className="space-y-4 sm:col-span-2">
      <div className="space-y-2">
        <Label>Invoice Type</Label>
        <Select
          value={invoiceTaxType || "NON_ITC"}
          onValueChange={(v) => form.setValue("invoiceTaxType", v as "ITC" | "NON_ITC")}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ITC">ITC (B2B — with GSTIN)</SelectItem>
            <SelectItem value="NON_ITC">Non-ITC (B2C)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {invoiceTaxType === "ITC" && (
        <div className="space-y-2">
          <Label>Buyer GSTIN *</Label>
          <Input
            {...form.register("buyerGstin")}
            placeholder="19AAEFB7856M1ZT"
            onChange={(e) => form.setValue("buyerGstin", e.target.value.toUpperCase())}
          />
          <p className="text-xs text-muted-foreground">
            Required for ITC. Auto-filled from customer GSTIN when available.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Base Fare — Airline (INR) *</Label>
          <Input {...form.register("baseFare")} type="number" min={0} step="0.01" placeholder="10582.00" />
          <p className="text-xs text-muted-foreground">Fare reimbursement — no GST</p>
        </div>
        <div className="space-y-2">
          <Label>Service Charge (INR) *</Label>
          <Input {...form.register("serviceCharge")} type="number" min={0} step="0.01" placeholder="438.98" />
          <p className="text-xs text-muted-foreground">Taxable @ 18% (HSN 998551)</p>
        </div>
      </div>

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
        <p className="pt-2 border-t font-semibold">Invoice Total: {formatInr(totalAmount)}</p>
      </div>

      <input type="hidden" {...form.register("totalAmount")} />
    </div>
  );
}
