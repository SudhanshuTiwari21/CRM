"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SmtpSettings } from "@/components/settings/smtp-settings";

interface SettingsData {
  agency: {
    companyName: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    gstin?: string | null;
    phone?: string | null;
    email?: string | null;
    invoicePrefix: string;
    webhookApiKey?: string | null;
    holdModeEnabled: boolean;
    smtpHost?: string | null;
    smtpPort?: number | null;
    smtpUser?: string | null;
    smtpFrom?: string | null;
  };
  templates: { key: string; subject: string; body: string }[];
  users: { id: string; name: string; email: string; role: string; active: boolean }[];
}

export function SettingsForm() {
  const { data: session } = useSession();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [agency, setAgency] = useState<SettingsData["agency"] | null>(null);
  const [templates, setTemplates] = useState<SettingsData["templates"]>([]);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "AGENT" });

  useEffect(() => {
    fetch("/api/crm/settings")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setAgency(d.agency);
        setTemplates(d.templates);
      });
  }, []);

  async function saveAgency() {
    if (!agency) return;
    setLoading(true);
    try {
      const res = await fetch("/api/crm/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agency }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Agency settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  }

  async function saveTemplates() {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Email templates saved");
    } catch {
      toast.error("Failed to save templates");
    } finally {
      setLoading(false);
    }
  }

  async function createUser() {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success("User created");
      setNewUser({ name: "", email: "", password: "", role: "AGENT" });
      const settings = await fetch("/api/crm/settings").then((r) => r.json());
      setData(settings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (!data || !agency) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <Tabs defaultValue="agency">
      <TabsList>
        <TabsTrigger value="agency">Agency</TabsTrigger>
        <TabsTrigger value="smtp">Gmail SMTP</TabsTrigger>
        <TabsTrigger value="email">Email Templates</TabsTrigger>
        <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        {session?.user?.role === "ADMIN" && <TabsTrigger value="users">Users</TabsTrigger>}
      </TabsList>

      <TabsContent value="agency">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agency Profile</CardTitle>
            <CardDescription>Used on all PDF documents and emails</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {(["companyName", "address", "city", "state", "pincode", "gstin", "phone", "email", "invoicePrefix"] as const).map((field) => (
              <div key={field} className="space-y-2">
                <Label className="capitalize">{field.replace(/([A-Z])/g, " $1")}</Label>
                <Input
                  value={agency[field] || ""}
                  onChange={(e) => setAgency({ ...agency, [field]: e.target.value })}
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <Button onClick={saveAgency} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Agency Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="smtp">
        <SmtpSettings
          smtpHost={agency.smtpHost}
          smtpPort={agency.smtpPort}
          smtpUser={agency.smtpUser}
          smtpFrom={agency.smtpFrom}
          onSave={async (smtp) => {
            setLoading(true);
            try {
              const res = await fetch("/api/crm/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agency: { ...agency, ...smtp } }),
              });
              if (!res.ok) throw new Error("Failed");
              setAgency({ ...agency, ...smtp });
              toast.success("SMTP settings saved");
            } catch {
              toast.error("Failed to save SMTP settings");
            } finally {
              setLoading(false);
            }
          }}
        />
      </TabsContent>

      <TabsContent value="email">
        <div className="space-y-4">
          {templates.map((t, i) => (
            <Card key={t.key}>
              <CardHeader>
                <CardTitle className="text-base capitalize">{t.key.replace(/_/g, " ")}</CardTitle>
                <CardDescription>Variables: {"{{customerName}} {{publicRef}} {{pnr}} {{amount}} {{companyName}}"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={t.subject}
                  onChange={(e) => {
                    const updated = [...templates];
                    updated[i] = { ...t, subject: e.target.value };
                    setTemplates(updated);
                  }}
                  placeholder="Subject"
                />
                <Textarea
                  rows={8}
                  value={t.body}
                  onChange={(e) => {
                    const updated = [...templates];
                    updated[i] = { ...t, body: e.target.value };
                    setTemplates(updated);
                  }}
                />
              </CardContent>
            </Card>
          ))}
          <Button onClick={saveTemplates} disabled={loading}>Save Templates</Button>
        </div>
      </TabsContent>

      <TabsContent value="webhooks">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook API (Future Booking Website)</CardTitle>
            <CardDescription>Endpoints for the public booking website to push bookings into CRM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 font-mono text-sm space-y-2">
              <p>POST /api/webhooks/bookings/live</p>
              <p>POST /api/webhooks/bookings/held</p>
              <p>GET /api/webhooks/bookings/{"{publicRef}"}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Header: <code className="rounded bg-muted px-1">X-API-Key: {agency.webhookApiKey || "not-set"}</code>
            </p>
            <div className="space-y-2">
              <Label>Webhook API Key</Label>
              <Input
                value={agency.webhookApiKey || ""}
                onChange={(e) => setAgency({ ...agency, webhookApiKey: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Hold Mode</Label>
                <p className="text-xs text-muted-foreground">When enabled, website sends held bookings instead of live API</p>
              </div>
              <Button
                type="button"
                variant={agency.holdModeEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setAgency({ ...agency, holdModeEnabled: !agency.holdModeEnabled })}
              >
                {agency.holdModeEnabled ? "Enabled" : "Disabled"}
              </Button>
            </div>
            <Button onClick={saveAgency} disabled={loading}>Save Webhook Settings</Button>
          </CardContent>
        </Card>
      </TabsContent>

      {session?.user?.role === "ADMIN" && (
        <TabsContent value="users">
          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">Team Members</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.users.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge>{u.role}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Add Agent</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Input placeholder="Name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
              <Input placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              <Input placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
              <Button onClick={createUser} disabled={loading}>Create User</Button>
            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  );
}
