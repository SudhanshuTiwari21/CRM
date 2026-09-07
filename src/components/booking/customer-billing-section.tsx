"use client";

import { useCallback, useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CUSTOMER_TITLE_OPTIONS } from "@/lib/constants/flight";
import { parseApiResponse } from "@/lib/parse-api-response";
import { Loader2, Search } from "lucide-react";
import type { WizardForm } from "@/components/booking/offline-booking-wizard";



interface CustomerOption {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  pan: string | null;
  gstin: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  type: string;
}

interface CustomerBillingSectionProps {
  form: UseFormReturn<WizardForm>;
  onCreditAvailabilityChange?: (available: boolean) => void;
}

function splitCustomerName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const titles = CUSTOMER_TITLE_OPTIONS.map((o) => o.value);
  if (parts.length > 1 && titles.includes(parts[0] as (typeof titles)[number])) {
    return { title: parts[0], name: parts.slice(1).join(" ") };
  }
  return { title: "Mr", name: fullName };
}

export function CustomerBillingSection({ form, onCreditAvailabilityChange }: CustomerBillingSectionProps) {
  const billingType = form.watch("billingType");
  const cashBillTo = form.watch("cashBillTo") || "INDIVIDUAL";
  const ledgerBillTo = form.watch("ledgerBillTo") || "INDIVIDUAL";
  const ledgerMode = form.watch("ledgerMode");
  const totalAmount = Number(form.watch("totalAmount") || 0);
  const [cashCompliance, setCashCompliance] = useState<{
    cashBillingLocked: boolean;
    cashSalesRatio: number;
    cashSalesRatioLimit: number;
    fyLabel: string;
    cashTxnMax: number;
    cashPanThreshold: number;
    wouldExceed: boolean;
    message: string | null;
  } | null>(null);
  const customerId = form.watch("customerId");
  const customerPhone = form.watch("customer.phone");
  const productType = form.watch("productType");
  const invoiceTaxType = form.watch("invoiceTaxType") as "ITC" | "NON_ITC" | undefined;

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const showManualFields =
    billingType === "CASH" ||
    (billingType === "LEDGER" && ledgerMode === "NEW") ||
    (billingType === "LEDGER" && ledgerMode === "EXISTING" && Boolean(customerId));

  const isCompanyBill =
    (billingType === "CASH" && cashBillTo === "COMPANY") ||
    (billingType === "LEDGER" && ledgerMode === "NEW" && ledgerBillTo === "COMPANY");

  const fetchCustomers = useCallback(async (search: string) => {
    setLoadingCustomers(true);
    const params = new URLSearchParams({ limit: "30", page: "1" });
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/crm/customers?${params}`);
    const { ok, data } = await parseApiResponse(res);
    setCustomerOptions(ok ? ((data.customers as CustomerOption[]) || []) : []);
    setLoadingCustomers(false);
  }, []);

  useEffect(() => {
    if (billingType === "LEDGER" && ledgerMode === "EXISTING") {
      fetchCustomers(customerSearch);
    }
  }, [billingType, ledgerMode, customerSearch, fetchCustomers]);

  useEffect(() => {
    if (billingType !== "CASH") {
      setCashCompliance(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/crm/cash-compliance?amount=${encodeURIComponent(String(totalAmount || 0))}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.error) return;
          setCashCompliance({
            cashBillingLocked: Boolean(data.cashBillingLocked),
            cashSalesRatio: Number(data.cashSalesRatio) || 0,
            cashSalesRatioLimit: Number(data.cashSalesRatioLimit) || 30,
            fyLabel: data.fyLabel || "FY",
            cashTxnMax: Number(data.cashTxnMax) || 199999,
            cashPanThreshold: Number(data.cashPanThreshold) || 100000,
            wouldExceed: Boolean(data.wouldExceed),
            message: data.message || null,
          });
        })
        .catch(() => setCashCompliance(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [billingType, totalAmount]);

  const panRequired =
    billingType === "CASH" &&
    totalAmount > (cashCompliance?.cashPanThreshold ?? 100_000);
  const cashAmountBlocked =
    billingType === "CASH" &&
    totalAmount > (cashCompliance?.cashTxnMax ?? 199_999);

  useEffect(() => {
    if (billingType !== "LEDGER" || ledgerMode !== "EXISTING") {
      onCreditAvailabilityChange?.(false);
      return;
    }
    const phone = customerPhone?.trim();
    if (!phone || phone.length < 10) {
      onCreditAvailabilityChange?.(false);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/crm/customers/credit-lookup?phone=${encodeURIComponent(phone)}`)
        .then((r) => r.json())
        .then((data) => onCreditAvailabilityChange?.(Boolean(data.customer?.creditEnabled)))
        .catch(() => onCreditAvailabilityChange?.(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [billingType, ledgerMode, customerPhone, onCreditAvailabilityChange]);

  function applyCustomer(c: CustomerOption) {
    const { title, name } = splitCustomerName(c.name);
    form.setValue("customerId", c.id);
    form.setValue("customer.title", title);
    form.setValue("customer.name", name);
    form.setValue("customer.phone", c.phone);
    form.setValue("customer.email", c.email || "");
    form.setValue("customer.pan", c.pan || "");
    form.setValue("customer.gstin", c.gstin || "");
    form.setValue("customer.address", c.address || "");
    form.setValue("customer.city", c.city || "");
    form.setValue("customer.state", c.state || "");
    form.setValue("customer.pincode", c.pincode || "");
    if (c.gstin) form.setValue("buyerGstin", c.gstin);
  }

  function handleBillingTypeChange(value: "CASH" | "LEDGER") {
    form.setValue("billingType", value);
    if (value === "CASH") {
      form.setValue("cashBillTo", "INDIVIDUAL");
      form.setValue("ledgerMode", undefined);
      form.setValue("customerId", undefined);
    } else {
      form.setValue("ledgerMode", "EXISTING");
      form.setValue("ledgerBillTo", "INDIVIDUAL");
      form.setValue("customerId", undefined);
    }
  }

  function handleBillToChange(value: "INDIVIDUAL" | "COMPANY", mode: "CASH" | "LEDGER") {
    if (mode === "CASH") {
      form.setValue("cashBillTo", value);
    } else {
      form.setValue("ledgerBillTo", value);
    }
    if (value === "COMPANY") {
      if (productType === "FLIGHT" && form.getValues("invoiceTaxType") !== "ITC") {
        form.setValue("invoiceTaxType", "ITC");
      }
    } else {
      form.setValue("customer.contactPerson", "");
      if (!form.getValues("customer.title")) {
        form.setValue("customer.title", "Mr");
      }
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Customer Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleBillingTypeChange("CASH")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              billingType === "CASH"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            Cash Bill
          </button>
          <button
            type="button"
            onClick={() => handleBillingTypeChange("LEDGER")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              billingType === "LEDGER"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            Ledger Bill
          </button>
        </div>

        {billingType === "CASH" && cashCompliance && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              cashCompliance.cashBillingLocked || cashCompliance.wouldExceed || cashAmountBlocked
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-amber-200 bg-amber-50 text-amber-950"
            }`}
          >
            <p className="font-medium">
              Cash sales ratio ({cashCompliance.fyLabel}): {cashCompliance.cashSalesRatio}% /{" "}
              {cashCompliance.cashSalesRatioLimit}%
            </p>
            {cashAmountBlocked ? (
              <p className="mt-1">
                Cash bill cannot exceed ₹{(cashCompliance.cashTxnMax || 199999).toLocaleString("en-IN")}.
              </p>
            ) : null}
            {cashCompliance.message ? <p className="mt-1">{cashCompliance.message}</p> : null}
            {!cashCompliance.cashBillingLocked && !cashCompliance.wouldExceed && !cashAmountBlocked ? (
              <p className="mt-1 text-xs opacity-80">
                Max cash bill ₹{cashCompliance.cashTxnMax.toLocaleString("en-IN")}. PAN required above ₹
                {cashCompliance.cashPanThreshold.toLocaleString("en-IN")}.
              </p>
            ) : null}
          </div>
        )}

        {productType === "FLIGHT" && (
          <div className="space-y-2">
            <Label>Booking Category</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => form.setValue("invoiceTaxType", "NON_ITC")}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  (invoiceTaxType || "NON_ITC") === "NON_ITC"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                B2C (Retail)
              </button>
              <button
                type="button"
                onClick={() => form.setValue("invoiceTaxType", "ITC")}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  invoiceTaxType === "ITC"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                B2B (Business)
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Controls invoice layout and tax treatment. Buyer GSTIN is optional for both B2B and B2C.
            </p>
          </div>
        )}

        {billingType === "CASH" && (
          <>
            <p className="text-sm text-muted-foreground">
              Cash walk-in - contact details are saved on the booking only. No customer profile is created.
              Records appear under Reports → Cash Sales.
            </p>
            <div className="space-y-2">
              <Label>Bill To</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleBillToChange("INDIVIDUAL", "CASH")}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    cashBillTo === "INDIVIDUAL"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => handleBillToChange("COMPANY", "CASH")}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    cashBillTo === "COMPANY"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  Company
                </button>
              </div>
              {cashBillTo === "COMPANY" && (
                <p className="text-xs text-muted-foreground">
                  Company name appears on the invoice. For flight bookings, B2B is selected automatically — GSTIN is optional.
                </p>
              )}
            </div>
          </>
        )}

        {billingType === "LEDGER" && (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  form.setValue("ledgerMode", "EXISTING");
                  form.setValue("customerId", undefined);
                }}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  ledgerMode === "EXISTING" ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}
              >
                Select Customer
              </button>
              <button
                type="button"
                onClick={() => {
                  form.setValue("ledgerMode", "NEW");
                  form.setValue("ledgerBillTo", "INDIVIDUAL");
                  form.setValue("customerId", undefined);
                }}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  ledgerMode === "NEW" ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}
              >
                Create New Ledger
              </button>
            </div>
            {ledgerMode === "NEW" && (
              <div className="space-y-2">
                <Label>Ledger Type</Label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleBillToChange("INDIVIDUAL", "LEDGER")}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      ledgerBillTo === "INDIVIDUAL"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBillToChange("COMPANY", "LEDGER")}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      ledgerBillTo === "COMPANY"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    Company
                  </button>
                </div>
                {ledgerBillTo === "COMPANY" && (
                  <p className="text-xs text-muted-foreground">
                    Creates a business ledger profile with company name, GSTIN, and contact person.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {billingType === "LEDGER" && ledgerMode === "EXISTING" && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <Label>Choose existing customer</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, phone, email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
            {loadingCustomers ? (
              <div className="flex justify-center py-4 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {customerOptions.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">No customers found</p>
                ) : (
                  customerOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => applyCustomer(c)}
                      className={`flex w-full items-start justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                        customerId === c.id ? "border-primary bg-primary/5" : ""
                      }`}
                    >
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.phone}
                          {c.email ? ` • ${c.email}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {c.type === "BUSINESS" ? "B2B" : "Individual"}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {(showManualFields) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {billingType === "LEDGER" && ledgerMode === "EXISTING" && customerId && (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                You can edit these details - changes are saved to the customer profile when the booking is created.
              </p>
            )}
            <div className="space-y-2 sm:col-span-2">
              {isCompanyBill ? (
                <>
                  <Label>Company Name *</Label>
                  <Input
                    {...form.register("customer.name")}
                    placeholder="e.g. Binod Textiles Pvt Ltd"
                  />
                </>
              ) : (
                <>
                  <Label>Name *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.watch("customer.title") || "Mr"}
                      onValueChange={(v) => form.setValue("customer.title", v)}
                    >
                      <SelectTrigger className="w-[100px] shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CUSTOMER_TITLE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      {...form.register("customer.name")}
                      placeholder="Full name (without title)"
                      className="flex-1"
                    />
                  </div>
                </>
              )}
            </div>
            {isCompanyBill && (
              <div className="space-y-2 sm:col-span-2">
                <Label>
                  Contact Person{billingType === "LEDGER" && ledgerMode === "NEW" ? " *" : ""}
                </Label>
                <Input
                  {...form.register("customer.contactPerson")}
                  placeholder={
                    billingType === "LEDGER"
                      ? "Primary contact at the company"
                      : "Optional - person at the company"
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input
                {...form.register("customer.phone")}
                placeholder="10-digit mobile (leading 0 optional)"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                {...form.register("customer.email")}
                type="text"
                inputMode="email"
                autoComplete="email"
                placeholder="optional"
              />
            </div>
            <div className="space-y-2">
              <Label>GSTIN</Label>
              <Input
                {...form.register("customer.gstin")}
                placeholder="Optional"
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  form.setValue("customer.gstin", value);
                  if (productType === "FLIGHT") {
                    form.setValue("buyerGstin", value);
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>PAN{panRequired ? " *" : ""}</Label>
              <Input
                value={form.watch("customer.pan") || ""}
                onChange={(e) => form.setValue("customer.pan", e.target.value.toUpperCase())}
                placeholder={
                  panRequired ? "Required for cash above ₹1,00,000" : "optional - e.g. ABCDE1234F"
                }
              />
              {panRequired ? (
                <p className="text-xs text-amber-700">Mandatory for cash bills above ₹1,00,000</p>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Billing Address</Label>
              <Textarea
                {...form.register("customer.address")}
                placeholder="Street, building, area..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                {...form.register("customer.city")}
                placeholder="Kolkata"
              />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input
                {...form.register("customer.state")}
                placeholder="West Bengal"
              />
            </div>
            <div className="space-y-2">
              <Label>Pincode</Label>
              <Input
                {...form.register("customer.pincode")}
                placeholder="700001"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
