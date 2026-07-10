"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, MessageCircle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface WhatsAppStatus {
  enabled: boolean;
  configured: boolean;
  phoneNumberId: string;
  apiVersion: string;
  hasToken: boolean;
}

interface WhatsAppSettingsProps {
  whatsappEnabled?: boolean;
  whatsappPhoneNumberId?: string | null;
  whatsappApiVersion?: string | null;
  onSave: (data: {
    whatsappEnabled: boolean;
    whatsappPhoneNumberId: string;
    whatsappApiVersion: string;
  }) => Promise<void>;
}

export function WhatsAppSettings({
  whatsappEnabled,
  whatsappPhoneNumberId,
  whatsappApiVersion,
  onSave,
}: WhatsAppSettingsProps) {
  const { data: session } = useSession();
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [testTo, setTestTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    whatsappEnabled: whatsappEnabled ?? false,
    whatsappPhoneNumberId: whatsappPhoneNumberId || "",
    whatsappApiVersion: whatsappApiVersion || "v21.0",
  });

  useEffect(() => {
    fetch("/api/crm/whatsapp/test")
      .then((r) => r.json())
      .then(setStatus);
  }, []);

  useEffect(() => {
    setForm({
      whatsappEnabled: whatsappEnabled ?? false,
      whatsappPhoneNumberId: whatsappPhoneNumberId || "",
      whatsappApiVersion: whatsappApiVersion || "v21.0",
    });
  }, [whatsappEnabled, whatsappPhoneNumberId, whatsappApiVersion]);

  async function handleSave() {
    setLoading(true);
    try {
      await onSave(form);
      toast.success("WhatsApp settings saved");
      const updated = await fetch("/api/crm/whatsapp/test").then((r) => r.json());
      setStatus(updated);
    } catch {
      toast.error("Failed to save WhatsApp settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    if (!testTo.trim()) {
      toast.error("Enter a phone number to test");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/crm/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Test message sent to ${testTo}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test failed");
    } finally {
      setLoading(false);
    }
  }

  if (session?.user?.role !== "ADMIN") {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Only admins can configure WhatsApp.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-5 w-5" />
          WhatsApp Cloud API
        </CardTitle>
        <CardDescription>
          Sends booking confirmation messages in parallel with email. Uses Meta WhatsApp Business Cloud API.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {status && (
          <div className="flex flex-wrap items-center gap-2">
            {status.configured ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Ready
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" /> Not configured
              </Badge>
            )}
            {status.hasToken && <Badge variant="outline">Token set</Badge>}
            {status.phoneNumberId && <Badge variant="outline">ID {status.phoneNumberId}</Badge>}
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label>Enable WhatsApp notifications</Label>
            <p className="text-xs text-muted-foreground">Send on confirmed bookings (alongside email)</p>
          </div>
          <Button
            type="button"
            variant={form.whatsappEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setForm({ ...form, whatsappEnabled: !form.whatsappEnabled })}
          >
            {form.whatsappEnabled ? "Enabled" : "Disabled"}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Phone Number ID</Label>
            <Input
              value={form.whatsappPhoneNumberId}
              onChange={(e) => setForm({ ...form, whatsappPhoneNumberId: e.target.value })}
              placeholder="From Meta Developer Console"
            />
          </div>
          <div className="space-y-2">
            <Label>API Version</Label>
            <Input
              value={form.whatsappApiVersion}
              onChange={(e) => setForm({ ...form, whatsappApiVersion: e.target.value })}
              placeholder="v21.0"
            />
          </div>
        </div>

        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Environment variable (server only)</p>
          <p>
            Set <code className="text-xs">WHATSAPP_ACCESS_TOKEN</code> in <code className="text-xs">.env</code> or
            Vercel - never expose in the browser. Get it from Meta Business → WhatsApp → API Setup.
          </p>
          <p>
            For production outbound messages, Meta may require an approved message template if the customer
            has not messaged you in the last 24 hours.
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save WhatsApp Settings
          </Button>
        </div>

        <div className="border-t pt-6 space-y-3">
          <Label>Send test message</Label>
          <div className="flex gap-2">
            <Input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="9876543210 (10-digit Indian mobile)"
            />
            <Button variant="outline" onClick={handleTest} disabled={loading}>
              Test
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
