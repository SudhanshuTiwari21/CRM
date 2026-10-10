"use client";

import { useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateFlightGst,
  calculateFlightInvoiceTotal,
  formatInr,
  getStateCodeFromGstin,
} from "@/lib/gst-calculator";
import type { WizardForm } from "@/components/booking/offline-booking-wizard";

interface HotelInvoiceFieldsProps {
  form: UseFormReturn<WizardForm>;
}

export function HotelInvoiceFields({ form }: HotelInvoiceFieldsProps) {
  const [agencyGstin, setAgencyGstin] = useState<string | null>(null);
  const [agencyStateCode, setAgencyStateCode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/crm/settings", { credentials: "include" })
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
  }, []);

  const hasAgencyGst = Boolean(agencyGstin?.trim());
  const invoiceTaxType = form.watch("invoiceTaxType") as "ITC" | "NON_ITC" | undefined;
  const buyerGstin = form.watch("buyerGstin") as string | undefined;
  const customerGstin = form.watch("customer.gstin") as string | undefined;
  const baseFare = Number(form.watch("baseFare") || 0);
  const serviceCharge = Number(form.watch("serviceCharge") || 0);
  const discountAmount = Number(form.watch("discountAmount") || 0);

  useEffect(() => {
    if (customerGstin && !buyerGstin) {
      form.setValue("buyerGstin", customerGstin.toUpperCase());
    }
  }, [customerGstin, buyerGstin, form]);

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

  const invoiceSubtotal = useMemo(
    () => calculateFlightInvoiceTotal(baseFare, serviceCharge, tax, discountAmount),
    [baseFare, serviceCharge, tax, discountAmount]
  );

  useEffect(() => {
    form.setValue("totalAmount", invoiceSubtotal);
  }, [invoiceSubtotal, form]);

  if (!hasAgencyGst) {
    return (
      <div className="space-y-2 sm:col-span-2">
        <Label>Total Amount (INR) *</Label>
        <Input {...form.register("totalAmount")} type="number" />
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-medium">Price breakup is hidden</p>
          <p className="mt-1 text-amber-800/90">
            Add your agency GSTIN in{" "}
            <a href="/settings" className="font-semibold underline underline-offset-2">
              Settings
            </a>{" "}
            for this brand. After saving, refresh — hotel charges, tax, and breakup fields will appear.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:col-span-2">
      <div className="space-y-2">
        <Label>Buyer GSTIN</Label>
        <Input
          {...form.register("buyerGstin")}
          placeholder="Optional — pick branch GSTIN above if available"
          onChange={(e) => form.setValue("buyerGstin", e.target.value.toUpperCase())}
        />
        <p className="text-xs text-muted-foreground">
          Optional for both B2B and B2C. Used on the tax invoice and GST reports when available.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Hotel Charges (INR) *</Label>
          <Input {...form.register("baseFare")} type="number" min={0} step="0.01" />
          <p className="text-xs text-muted-foreground">Room / package cost (fare reimbursement).</p>
        </div>
        <div className="space-y-2">
          <Label>Service Charge (INR) *</Label>
          <Input {...form.register("serviceCharge")} type="number" min={0} step="0.01" />
          <p className="text-xs text-muted-foreground">Agency fee — GST applies on this amount.</p>
        </div>
        <div className="space-y-2">
          <Label>Discount (INR)</Label>
          <Input {...form.register("discountAmount")} type="number" min={0} step="0.01" />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
        <p>Hotel Charges: {formatInr(baseFare)}</p>
        <p>Service Charge: {formatInr(serviceCharge)}</p>
        {tax.igstAmount > 0 ? (
          <p>
            IGST @ {tax.igstRate}%: {formatInr(tax.igstAmount)}
          </p>
        ) : (
          <>
            <p>
              CGST @ {tax.cgstRate}%: {formatInr(tax.cgstAmount)}
            </p>
            <p>
              SGST @ {tax.sgstRate}%: {formatInr(tax.sgstAmount)}
            </p>
          </>
        )}
        {discountAmount > 0 && <p className="text-amber-700">Discount: −{formatInr(discountAmount)}</p>}
        <p className="pt-2 border-t font-semibold">Invoice Total: {formatInr(invoiceSubtotal)}</p>
        <p className="text-xs text-muted-foreground">
          Place of Supply: {tax.placeOfSupply || "Same state (CGST + SGST)"}
        </p>
      </div>

      <div className="space-y-2 rounded-lg border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
        <Label className="text-amber-900 dark:text-amber-100">Remarks / Narration (shown on invoice)</Label>
        <Textarea
          {...form.register("invoiceNarration")}
          rows={3}
          placeholder="e.g. 2N Singapore — ibis Selegie"
          className="border-amber-200 bg-white dark:bg-background"
        />
      </div>

      <input type="hidden" {...form.register("totalAmount")} />
    </div>
  );
}
