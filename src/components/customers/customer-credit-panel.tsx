"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface CreditTransaction {
  id: string;
  type: string;
  amount: unknown;
  balanceAfter: unknown;
  note?: string | null;
  createdAt: string;
  booking?: { publicRef: string } | null;
  createdBy?: { name: string } | null;
}

interface CustomerCreditPanelProps {
  customerId: string;
  initial?: {
    creditEnabled: boolean;
    creditLimit: unknown;
    creditBalance: unknown;
    paymentTermsDays: number | null;
  };
}

export function CustomerCreditPanel({ customerId, initial }: CustomerCreditPanelProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [loading, setLoading] = useState(!initial);
  const [saving, setSaving] = useState(false);
  const [creditEnabled, setCreditEnabled] = useState(initial?.creditEnabled ?? false);
  const [creditLimit, setCreditLimit] = useState(
    initial?.creditLimit != null ? String(initial.creditLimit) : ""
  );
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    initial?.paymentTermsDays != null ? String(initial.paymentTermsDays) : ""
  );
  const [creditBalance, setCreditBalance] = useState(Number(initial?.creditBalance ?? 0));
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);

  useEffect(() => {
    fetch(`/api/crm/customers/${customerId}/credit`)
      .then((r) => r.json())
      .then((data) => {
        if (data.creditEnabled != null) setCreditEnabled(data.creditEnabled);
        if (data.creditLimit != null) setCreditLimit(String(data.creditLimit));
        if (data.creditBalance != null) setCreditBalance(Number(data.creditBalance));
        if (data.paymentTermsDays != null) setPaymentTermsDays(String(data.paymentTermsDays));
        setTransactions(data.transactions || []);
      })
      .catch(() => toast.error("Failed to load credit details"))
      .finally(() => setLoading(false));
  }, [customerId]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/customers/${customerId}/credit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditEnabled,
          creditLimit: creditLimit ? Number(creditLimit) : null,
          paymentTermsDays: paymentTermsDays ? Number(paymentTermsDays) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success("Credit settings updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading credit account…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Credit Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Outstanding Balance</p>
            <p className="text-2xl font-bold">{formatCurrency(creditBalance)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Credit Limit</p>
            <p className="text-lg font-medium">
              {creditLimit ? formatCurrency(Number(creditLimit)) : "No limit set"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="text-lg font-medium">{creditEnabled ? "Enabled" : "Disabled"}</p>
          </div>
        </div>

        {isAdmin && (
          <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
            <div className="flex items-center justify-between sm:col-span-2">
              <div>
                <Label>Enable credit for this customer</Label>
                <p className="text-xs text-muted-foreground">B2B and B2C - per account basis</p>
              </div>
              <Button
                type="button"
                variant={creditEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setCreditEnabled(!creditEnabled)}
              >
                {creditEnabled ? "Enabled" : "Disabled"}
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Credit Limit (INR)</Label>
              <Input
                type="number"
                min={0}
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Terms (days)</Label>
              <Input
                type="number"
                min={0}
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(e.target.value)}
                placeholder="e.g. 30"
              />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Credit Settings
              </Button>
            </div>
          </div>
        )}

        {transactions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Ledger</p>
            {transactions.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex justify-between rounded border p-3 text-sm">
                <div>
                  <p className="font-medium">{tx.type}</p>
                  <p className="text-muted-foreground">
                    {tx.booking?.publicRef || tx.note || "-"} · {formatDateTime(tx.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p>{formatCurrency(Number(tx.amount))}</p>
                  <p className="text-muted-foreground">Bal: {formatCurrency(Number(tx.balanceAfter))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
