import { Header } from "@/components/layout/header";
import { SettingsForm } from "@/components/settings/settings-form";

export default function SettingsPage() {
  return (
    <div>
      <Header title="Settings" description="Agency profile, email templates, webhooks, and user management" />
      <SettingsForm />
    </div>
  );
}
