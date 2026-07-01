"use client";

import type { FieldErrors, FieldValues, Path, UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CUSTOMER_TITLE_OPTIONS } from "@/lib/constants/flight";

export type CustomerEditFieldValues = {
  title?: string;
  name: string;
  phone: string;
  email?: string;
  pan?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

type CustomerFormShape = { customer: CustomerEditFieldValues };

interface CustomerEditFieldsProps<T extends FieldValues & CustomerFormShape> {
  form: UseFormReturn<T>;
  billingType?: string;
}

export function CustomerEditFields<T extends FieldValues & CustomerFormShape>({
  form,
  billingType,
}: CustomerEditFieldsProps<T>) {
  const titlePath = "customer.title" as Path<T>;
  const namePath = "customer.name" as Path<T>;
  const phonePath = "customer.phone" as Path<T>;
  const emailPath = "customer.email" as Path<T>;
  const gstinPath = "customer.gstin" as Path<T>;
  const panPath = "customer.pan" as Path<T>;
  const addressPath = "customer.address" as Path<T>;
  const cityPath = "customer.city" as Path<T>;
  const statePath = "customer.state" as Path<T>;
  const pincodePath = "customer.pincode" as Path<T>;
  const customerErrors = form.formState.errors.customer as
    | FieldErrors<CustomerEditFieldValues>
    | undefined;

  return (
    <div className="space-y-4">
      {billingType === "CASH" && (
        <p className="text-xs text-muted-foreground">
          Cash bill — contact details are stored on this booking only.
        </p>
      )}
      {billingType === "LEDGER" && (
        <p className="text-xs text-muted-foreground">
          Ledger bill — changes are saved to the linked customer profile.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Name *</Label>
          <div className="flex gap-2">
            <Select
              value={(form.watch(titlePath) as string) || "Mr"}
              onValueChange={(v) => form.setValue(titlePath, v as never, { shouldDirty: true })}
            >
              <SelectTrigger className="w-[100px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_TITLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              {...form.register(namePath)}
              placeholder="Full name (without title)"
              className="flex-1"
            />
          </div>
          {customerErrors?.name && (
            <p className="text-xs text-destructive">{String(customerErrors.name.message)}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Phone *</Label>
          <Input {...form.register(phonePath)} placeholder="10-digit mobile (leading 0 optional)" />
          {customerErrors?.phone && (
            <p className="text-xs text-destructive">{String(customerErrors.phone.message)}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            {...form.register(emailPath)}
            type="text"
            inputMode="email"
            autoComplete="email"
            placeholder="optional"
          />
        </div>
        <div className="space-y-2">
          <Label>GSTIN</Label>
          <Input {...form.register(gstinPath)} />
        </div>
        <div className="space-y-2">
          <Label>PAN</Label>
          <Input
            value={(form.watch(panPath) as string) || ""}
            onChange={(e) =>
              form.setValue(panPath, e.target.value.toUpperCase() as never, { shouldDirty: true })
            }
            placeholder="optional — e.g. ABCDE1234F"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Billing Address</Label>
          <Textarea {...form.register(addressPath)} placeholder="Street, building, area..." rows={2} />
        </div>
        <div className="space-y-2">
          <Label>City</Label>
          <Input {...form.register(cityPath)} placeholder="Kolkata" />
        </div>
        <div className="space-y-2">
          <Label>State</Label>
          <Input {...form.register(statePath)} placeholder="West Bengal" />
        </div>
        <div className="space-y-2">
          <Label>Pincode</Label>
          <Input {...form.register(pincodePath)} placeholder="700001" />
        </div>
      </div>
    </div>
  );
}

interface CustomerEditFieldsControlledProps {
  value: CustomerEditFieldValues;
  onChange: (value: CustomerEditFieldValues) => void;
  billingType?: string;
}

export function CustomerEditFieldsControlled({
  value,
  onChange,
  billingType,
}: CustomerEditFieldsControlledProps) {
  function patch(partial: Partial<CustomerEditFieldValues>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-4">
      {billingType === "CASH" && (
        <p className="text-xs text-muted-foreground">
          Cash bill — contact details are stored on this booking only.
        </p>
      )}
      {billingType === "LEDGER" && (
        <p className="text-xs text-muted-foreground">
          Ledger bill — changes are saved to the linked customer profile.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Name *</Label>
          <div className="flex gap-2">
            <Select value={value.title || "Mr"} onValueChange={(v) => patch({ title: v })}>
              <SelectTrigger className="w-[100px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_TITLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={value.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Full name (without title)"
              className="flex-1"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Phone *</Label>
          <Input
            value={value.phone}
            onChange={(e) => patch({ phone: e.target.value })}
            placeholder="10-digit mobile (leading 0 optional)"
          />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            value={value.email || ""}
            onChange={(e) => patch({ email: e.target.value })}
            type="text"
            inputMode="email"
            autoComplete="email"
            placeholder="optional"
          />
        </div>
        <div className="space-y-2">
          <Label>GSTIN</Label>
          <Input value={value.gstin || ""} onChange={(e) => patch({ gstin: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>PAN</Label>
          <Input
            value={value.pan || ""}
            onChange={(e) => patch({ pan: e.target.value.toUpperCase() })}
            placeholder="optional — e.g. ABCDE1234F"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Billing Address</Label>
          <Textarea
            value={value.address || ""}
            onChange={(e) => patch({ address: e.target.value })}
            placeholder="Street, building, area..."
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label>City</Label>
          <Input value={value.city || ""} onChange={(e) => patch({ city: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>State</Label>
          <Input value={value.state || ""} onChange={(e) => patch({ state: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Pincode</Label>
          <Input value={value.pincode || ""} onChange={(e) => patch({ pincode: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
