"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, FileText, Pencil, Plane, Ticket } from "lucide-react";
import { toast } from "sonner";
import type { FlightBooking } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlightBookingFields } from "@/components/booking/flight-booking-fields";
import { FlightInvoiceFields } from "@/components/booking/flight-invoice-fields";
import {
  CustomerEditFields,
  CustomerEditFieldsControlled,
  type CustomerEditFieldValues,
} from "@/components/booking/customer-edit-fields";
import {
  EditDialogFooter,
  EditFormSection,
  FormSettingToggle,
  PaymentStatusChip,
} from "@/components/booking/edit-form-section";
import type { WizardForm } from "@/components/booking/offline-booking-wizard";
import {
  buildCustomerEditFormValues,
  buildFlightEditFormValues,
  flightEditFormSchema,
  normalizeFlightEditPayload,
  type FlightEditFormValues,
} from "@/lib/flight-edit-form";
import type { BookingCustomerContact } from "@/lib/cash-customer";
import { getFirstFormErrorMessage } from "@/lib/form-errors";

type FlightEditWizardForm = Omit<WizardForm, "billingType" | "ledgerMode" | "customerId"> &
  Pick<FlightEditFormValues, "pnr" | "internalNotes">;

const PAYMENT_METHOD_OPTIONS = ["UPI", "Cash", "Card", "Bank Transfer"] as const;

function buildPaymentPayload(markAsPaid: boolean, paymentMethod: string) {
  if (!markAsPaid) return {};
  return {
    paymentStatus: "PAID" as const,
    paymentMethod,
  };
}

function MarkPaymentPaidFields({
  paymentStatus,
  markAsPaid,
  onMarkAsPaidChange,
  paymentMethod,
  onPaymentMethodChange,
}: {
  paymentStatus: string;
  markAsPaid: boolean;
  onMarkAsPaidChange: (value: boolean) => void;
  paymentMethod: string;
  onPaymentMethodChange: (value: string) => void;
}) {
  const canMarkPaid = paymentStatus === "PENDING" || paymentStatus === "FAILED";

  if (!canMarkPaid) {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Payment recorded</p>
          <p className="text-xs text-muted-foreground">Status cannot be changed from this screen.</p>
        </div>
        <PaymentStatusChip status={paymentStatus} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Payment is currently <PaymentStatusChip status={paymentStatus} />
        </p>
      </div>
      <FormSettingToggle
        label="Mark as paid"
        description="Record payment and update booking status"
        checked={markAsPaid}
        onCheckedChange={onMarkAsPaidChange}
      />
      {markAsPaid && (
        <div className="space-y-2">
          <Label>Payment Method *</Label>
          <Select value={paymentMethod} onValueChange={onPaymentMethodChange}>
            <SelectTrigger>
              <SelectValue placeholder="How was payment received?" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHOD_OPTIONS.map((method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

interface EditBookingDialogProps {
  bookingId: string;
  productType: string;
  paymentStatus: string;
  billingType: string;
  customerContact: BookingCustomerContact;
  pnr?: string | null;
  internalNotes?: string | null;
  totalAmount: number;
  flight?: FlightBooking | null;
}

function buildCustomerPayload(customer: CustomerEditFieldValues) {
  return {
    title: customer.title,
    name: customer.name.trim(),
    phone: customer.phone,
    email: customer.email?.trim() || undefined,
    pan: customer.pan?.trim().toUpperCase() || undefined,
    gstin: customer.gstin?.trim() || undefined,
    address: customer.address?.trim() || undefined,
    city: customer.city?.trim() || undefined,
    state: customer.state?.trim() || undefined,
    pincode: customer.pincode?.trim() || undefined,
  };
}

function SimpleEditForm({
  bookingId,
  productType,
  paymentStatus,
  billingType,
  customerContact,
  pnr,
  internalNotes,
  totalAmount,
  flight,
  onClose,
}: EditBookingDialogProps & { onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [customer, setCustomer] = useState<CustomerEditFieldValues>(() =>
    buildCustomerEditFormValues(customerContact)
  );
  const [form, setForm] = useState({
    pnr: pnr || "",
    internalNotes: internalNotes || "",
    totalAmount: String(totalAmount),
    invoiceNarration: flight?.invoiceNarration || "",
    showPassengerName: flight?.showPassengerName !== false,
    baseFare: flight?.baseFare != null ? String(flight.baseFare) : "",
    serviceCharge: flight?.serviceCharge != null ? String(flight.serviceCharge) : "",
    discountAmount: flight?.discountAmount != null ? String(flight.discountAmount) : "",
  });

  async function handleSave() {
    if (markAsPaid && !paymentMethod) {
      toast.error("Select a payment method");
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        pnr: form.pnr.trim() || undefined,
        internalNotes: form.internalNotes,
        customer: buildCustomerPayload(customer),
        regenerateDocuments: true,
        ...buildPaymentPayload(markAsPaid, paymentMethod),
      };

      if (productType !== "FLIGHT") {
        payload.totalAmount = Number(form.totalAmount);
      } else {
        payload.invoiceNarration = form.invoiceNarration;
        payload.showPassengerName = form.showPassengerName;
        if (form.baseFare) payload.baseFare = Number(form.baseFare);
        if (form.serviceCharge) payload.serviceCharge = Number(form.serviceCharge);
        if (form.discountAmount) payload.discountAmount = Number(form.discountAmount);
        if (form.totalAmount) payload.totalAmount = Number(form.totalAmount);
      }

      const res = await fetch(`/api/crm/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      toast.success(markAsPaid ? "Booking updated and marked as paid" : "Booking updated — documents regenerated");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        <EditFormSection title="Booking Reference" description="PNR or supplier confirmation number">
          <div className="space-y-2">
            <Label>PNR / Confirmation</Label>
            <Input
              value={form.pnr}
              onChange={(e) => setForm({ ...form, pnr: e.target.value.toUpperCase() })}
              placeholder="e.g. UC9WTSJS"
              className="font-mono tracking-wide"
            />
          </div>
        </EditFormSection>

        <EditFormSection title="Customer" description="Contact and billing details on invoice and voucher">
          <CustomerEditFieldsControlled
            value={customer}
            onChange={setCustomer}
            billingType={billingType}
          />
        </EditFormSection>

        {productType === "FLIGHT" && (
          <EditFormSection title="Invoice & Pricing" description="Fare breakup shown on tax invoice">
            <FormSettingToggle
              label="Show passenger name on invoice"
              description="Hide for privacy-sensitive B2B invoices"
              checked={form.showPassengerName}
              onCheckedChange={(v) => setForm({ ...form, showPassengerName: v })}
            />
            <div className="space-y-2">
              <Label>Invoice Remarks / Narration</Label>
              <Textarea
                value={form.invoiceNarration}
                onChange={(e) => setForm({ ...form, invoiceNarration: e.target.value })}
                rows={3}
                placeholder="e.g. Sector - MAA-CCU 11100/-"
                className="resize-y"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Base Fare (INR)</Label>
                <Input
                  type="number"
                  value={form.baseFare}
                  onChange={(e) => setForm({ ...form, baseFare: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Service Charge (INR)</Label>
                <Input
                  type="number"
                  value={form.serviceCharge}
                  onChange={(e) => setForm({ ...form, serviceCharge: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Discount (INR)</Label>
                <Input
                  type="number"
                  value={form.discountAmount}
                  onChange={(e) => setForm({ ...form, discountAmount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Amount (INR)</Label>
                <Input
                  type="number"
                  value={form.totalAmount}
                  onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                />
              </div>
            </div>
          </EditFormSection>
        )}

        {productType !== "FLIGHT" && (
          <EditFormSection title="Pricing">
            <div className="space-y-2">
              <Label>Total Amount (INR)</Label>
              <Input
                type="number"
                value={form.totalAmount}
                onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
              />
            </div>
          </EditFormSection>
        )}

        <EditFormSection title="Internal Notes" description="Staff-only — not shown on voucher or invoice">
          <Textarea
            value={form.internalNotes}
            onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
            rows={4}
            placeholder="WhatsApp conversation notes, follow-up reminders..."
            className="resize-y min-h-[100px]"
          />
        </EditFormSection>

        <EditFormSection title="Payment" description="Record payment received after booking">
          <MarkPaymentPaidFields
            paymentStatus={paymentStatus}
            markAsPaid={markAsPaid}
            onMarkAsPaidChange={setMarkAsPaid}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
          />
        </EditFormSection>
      </div>

      <EditDialogFooter
        onCancel={onClose}
        onSave={handleSave}
        loading={loading}
        saveLabel={markAsPaid ? "Save & Mark Paid" : "Save & Regenerate"}
      />
    </div>
  );
}

function FlightEditForm({
  bookingId,
  flight,
  billingType,
  customerContact,
  paymentStatus,
  pnr,
  internalNotes,
  totalAmount,
  onClose,
}: {
  bookingId: string;
  flight: FlightBooking;
  billingType: string;
  customerContact: BookingCustomerContact;
  paymentStatus: string;
  pnr?: string | null;
  internalNotes?: string | null;
  totalAmount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");

  const form = useForm<FlightEditWizardForm>({
    resolver: zodResolver(flightEditFormSchema) as Resolver<FlightEditWizardForm>,
    defaultValues: buildFlightEditFormValues(flight, customerContact, { pnr, internalNotes, totalAmount }) as FlightEditWizardForm,
  });

  const {
    fields: segmentFields,
    append: appendSegment,
    remove: removeSegment,
  } = useFieldArray({ control: form.control, name: "segments" });

  const {
    fields: passengerFields,
    append: appendPassenger,
    remove: removePassenger,
  } = useFieldArray({ control: form.control, name: "passengers" });

  async function handleSave() {
    let hasErrors = false;
    await form.handleSubmit(
      async () => {},
      (errors) => {
        hasErrors = true;
        toast.error(getFirstFormErrorMessage(errors));
      }
    )();
    if (hasErrors) return;
    if (markAsPaid && !paymentMethod) {
      toast.error("Select a payment method");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...normalizeFlightEditPayload(form.getValues() as FlightEditFormValues),
        ...buildPaymentPayload(markAsPaid, paymentMethod),
      };
      const res = await fetch(`/api/crm/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      toast.success(markAsPaid ? "Booking updated and marked as paid" : "Booking updated — documents regenerated");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        <EditFormSection title="Booking Reference" description="PNR or airline confirmation number">
          <div className="space-y-2">
            <Label htmlFor="edit-pnr">PNR / Confirmation</Label>
            <Input
              id="edit-pnr"
              {...form.register("pnr")}
              placeholder="e.g. B5ETJP"
              className="font-mono tracking-wide"
            />
          </div>
        </EditFormSection>

        <EditFormSection title="Customer" description="Contact and billing details on invoice and voucher">
          <CustomerEditFields form={form} billingType={billingType} />
        </EditFormSection>

        <EditFormSection title="Flight Itinerary" description="Segments, passengers, and travel options">
          <FlightBookingFields
            form={form as unknown as ReturnType<typeof useForm<WizardForm>>}
            segmentFields={segmentFields}
            appendSegment={appendSegment as never}
            removeSegment={removeSegment}
            passengerFields={passengerFields}
            appendPassenger={appendPassenger as never}
            removePassenger={removePassenger}
          />
        </EditFormSection>

        <EditFormSection title="Invoice & Pricing" description="Fare breakup, tax category, and invoice narration">
          <FlightInvoiceFields form={form as unknown as ReturnType<typeof useForm<WizardForm>>} />
        </EditFormSection>

        <EditFormSection title="Internal Notes" description="Staff-only — not printed on voucher or invoice">
          <Textarea
            {...form.register("internalNotes")}
            rows={4}
            placeholder="WhatsApp conversation notes, follow-up reminders..."
            className="resize-y min-h-[100px]"
          />
        </EditFormSection>

        <EditFormSection title="Payment" description="Record payment when received from customer">
          <MarkPaymentPaidFields
            paymentStatus={paymentStatus}
            markAsPaid={markAsPaid}
            onMarkAsPaidChange={setMarkAsPaid}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
          />
        </EditFormSection>
      </div>

      <EditDialogFooter
        onCancel={onClose}
        onSave={handleSave}
        loading={loading}
        saveLabel={markAsPaid ? "Save & Mark Paid" : "Save & Regenerate"}
      />
    </div>
  );
}

export function EditBookingDialog({
  bookingId,
  productType,
  paymentStatus,
  billingType,
  customerContact,
  pnr,
  internalNotes,
  totalAmount,
  flight,
}: EditBookingDialogProps) {
  const [open, setOpen] = useState(false);
  const isFlightEdit = productType === "FLIGHT" && flight;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Edit Booking
        </Button>
      </DialogTrigger>
      <DialogContent
        className={
          isFlightEdit
            ? "flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
            : "flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        }
      >
        <DialogHeader className="shrink-0 space-y-3 border-b bg-muted/20 px-6 py-5 pr-12">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Edit Booking
              </DialogTitle>
              <DialogDescription>
                Admin only. Saving regenerates invoice and voucher PDFs.
              </DialogDescription>
            </div>
            <PaymentStatusChip status={paymentStatus} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1">
              <Ticket className="h-3 w-3" />
              {productType}
            </span>
            {isFlightEdit && (
              <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1">
                <Plane className="h-3 w-3" />
                Full itinerary edit
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1">
              <CreditCard className="h-3 w-3" />
              Payment: {paymentStatus.replace(/_/g, " ").toLowerCase()}
            </span>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
          {open && isFlightEdit ? (
            <FlightEditForm
              bookingId={bookingId}
              flight={flight}
              billingType={billingType}
              customerContact={customerContact}
              paymentStatus={paymentStatus}
              pnr={pnr}
              internalNotes={internalNotes}
              totalAmount={totalAmount}
              onClose={() => setOpen(false)}
            />
          ) : open ? (
            <SimpleEditForm
              bookingId={bookingId}
              productType={productType}
              paymentStatus={paymentStatus}
              billingType={billingType}
              customerContact={customerContact}
              pnr={pnr}
              internalNotes={internalNotes}
              totalAmount={totalAmount}
              flight={flight}
              onClose={() => setOpen(false)}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
