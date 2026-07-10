"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecordPaymentPanel } from "@/components/payments/record-payment-panel";
import { CreditNotesPanel } from "@/components/payments/credit-notes-panel";
import { PaymentHistoryPanel } from "@/components/payments/payment-history-panel";
import { OutstandingBillsPanel } from "@/components/payments/outstanding-bills-panel";

const VALID_TABS = ["record", "outstanding", "credit-notes", "history"] as const;

function PaymentsTabsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const defaultTab = VALID_TABS.includes(tabParam as (typeof VALID_TABS)[number])
    ? (tabParam as (typeof VALID_TABS)[number])
    : "record";
  const initialBookingId = searchParams.get("bookingId") || undefined;
  const initialBillingType =
    searchParams.get("billingType") === "CASH" || searchParams.get("billingType") === "LEDGER"
      ? (searchParams.get("billingType") as "CASH" | "LEDGER")
      : undefined;

  return (
    <Tabs defaultValue={defaultTab} key={`${defaultTab}-${initialBookingId ?? ""}`} className="space-y-6">
      <TabsList>
        <TabsTrigger value="record">Record Payment</TabsTrigger>
        <TabsTrigger value="outstanding">Outstanding Bills</TabsTrigger>
        <TabsTrigger value="credit-notes">Credit Notes</TabsTrigger>
        <TabsTrigger value="history">Payment History</TabsTrigger>
      </TabsList>

      <TabsContent value="record">
        <RecordPaymentPanel
          initialBookingId={initialBookingId}
          initialBillingType={initialBillingType}
        />
      </TabsContent>

      <TabsContent value="outstanding">
        <OutstandingBillsPanel />
      </TabsContent>

      <TabsContent value="credit-notes">
        <CreditNotesPanel />
      </TabsContent>

      <TabsContent value="history">
        <PaymentHistoryPanel />
      </TabsContent>
    </Tabs>
  );
}

export function PaymentsTabs() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PaymentsTabsContent />
    </Suspense>
  );
}
