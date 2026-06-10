"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, Mail, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SmtpStatus {
  configured: boolean;
  host: string;
  port: number;
  user: string;
  from: string;
  secure: boolean;
}

interface SmtpSettingsProps {
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpFrom?: string | null;
  onSave: (data: { smtpHost: string; smtpPort: number; smtpUser: string; smtpFrom: string }) => Promise<void>;
}

export function SmtpSettings({ smtpHost, smtpPort, smtpUser, smtpFrom, onSave }: SmtpSettingsProps) {
  const { data: session } = useSession();
  const [status, setStatus] = useState<SmtpStatus | null>(null);
  const [testTo, setTestTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    smtpHost: smtpHost || "smtp.gmail.com",
    smtpPort: smtpPort || 587,
    smtpUser: smtpUser || "",
    smtpFrom: smtpFrom || "",
  });

  useEffect(() => {
    fetch("/api/crm/email/test")
      .then((r) => r.json())
      .then(setStatus);
  }, []);

  useEffect(() => {
    setForm({
      smtpHost: smtpHost || "smtp.gmail.com",
      smtpPort: smtpPort || 587,
      smtpUser: smtpUser || "",
      smtpFrom: smtpFrom || "",
    });
  }, [smtpHost, smtpPort, smtpUser, smtpFrom]);

  async function handleSave() {
    setLoading(true);
    try {
      await onSave(form);
      toast.success("SMTP settings saved");
      const updated = await fetch("/api/crm/email/test").then((r) => r.json());
      setStatus(updated);
    } catch {
      toast.error("Failed to save SMTP settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Test email sent to ${data.sentTo}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test email failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Gmail SMTP Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            {status?.configured ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <Badge variant="success">Connected</Badge>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                <Badge variant="destructive">Not configured</Badge>
              </>
            )}
          </div>
          {status && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Host:</span> {status.host}:{status.port}</p>
              <p><span className="text-muted-foreground">User:</span> {status.user || "—"}</p>
              <p><span className="text-muted-foreground">From:</span> {status.from || "—"}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SMTP Settings</CardTitle>
          <CardDescription>
            For Gmail: enable 2FA, create an App Password at myaccount.google.com/apppasswords, set it as SMTP_PASS in .env.
            The From address must match your Gmail account or a verified alias.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>SMTP Host</Label>
            <Input value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>SMTP Port</Label>
            <Input
              type="number"
              value={form.smtpPort}
              onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value, 10) || 587 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Gmail Address</Label>
            <Input
              type="email"
              value={form.smtpUser}
              onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
              placeholder="your@gmail.com"
            />
          </div>
          <div className="space-y-2">
            <Label>From Name & Email</Label>
            <Input
              value={form.smtpFrom}
              onChange={(e) => setForm({ ...form, smtpFrom: e.target.value })}
              placeholder='Book to Roam <your@gmail.com>'
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save SMTP Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {session?.user?.role === "ADMIN" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send Test Email</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              placeholder={session.user.email}
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
            <Button onClick={handleTest} disabled={loading || !status?.configured}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Test
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
