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
  const ledgerMode = form.watch("ledgerMode");
  const customerId = form.watch("customerId");
  const customerPhone = form.watch("customer.phone");

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const showManualFields =
    billingType === "CASH" ||
    (billingType === "LEDGER" && ledgerMode === "NEW") ||
    (billingType === "LEDGER" && ledgerMode === "EXISTING" && Boolean(customerId));

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
      form.setValue("ledgerMode", undefined);
      form.setValue("customerId", undefined);
      if (form.getValues("paymentMethod") === "CREDIT") {
        form.setValue("paymentMethod", "Cash");
      }
    } else {
      form.setValue("ledgerMode", "EXISTING");
      form.setValue("customerId", undefined);
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

        {billingType === "CASH" && (
          <p className="text-sm text-muted-foreground">
            Cash walk-in — contact details are saved on the booking only. No customer profile is created.
            Records appear under Reports → Cash Sales.
          </p>
        )}

        {billingType === "LEDGER" && (
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
                form.setValue("customerId", undefined);
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                ledgerMode === "NEW" ? "border-primary bg-primary/10 text-primary" : "border-border"
              }`}
            >
              Create New Ledger
            </button>
          </div>
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
                You can edit these details — changes are saved to the customer profile when the booking is created.
              </p>
            )}
            <div className="space-y-2 sm:col-span-2">
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
            </div>
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
              <Input {...form.register("customer.gstin")} />
            </div>
            <div className="space-y-2">
              <Label>PAN</Label>
              <Input
                value={form.watch("customer.pan") || ""}
                onChange={(e) => form.setValue("customer.pan", e.target.value.toUpperCase())}
                placeholder="optional — e.g. ABCDE1234F"
              />
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
