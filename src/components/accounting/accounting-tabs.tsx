"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountingDashboard } from "@/components/accounting/accounting-dashboard";
import { PendingPaymentsPanel } from "@/components/accounting/pending-payments-panel";
import { RecordPaymentsPanel } from "@/components/accounting/record-payments-panel";

export function AccountingTabs() {
  return (
    <Tabs defaultValue="sales" className="space-y-6">
      <TabsList>
        <TabsTrigger value="sales">Sales Statement</TabsTrigger>
        <TabsTrigger value="pending">Pending Payments</TabsTrigger>
        <TabsTrigger value="record">Record Payments</TabsTrigger>
      </TabsList>

      <TabsContent value="sales">
        <AccountingDashboard />
      </TabsContent>

      <TabsContent value="pending">
        <PendingPaymentsPanel />
      </TabsContent>

      <TabsContent value="record">
        <RecordPaymentsPanel />
      </TabsContent>
    </Tabs>
  );
}
