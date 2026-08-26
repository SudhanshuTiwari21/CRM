import { getAgencySettings } from "@/lib/brand-context";
import { Header } from "@/components/layout/header";
import { DocumentsPanel } from "@/components/documents/documents-panel";

export default async function DocumentsPage() {
  const agency = await getAgencySettings();

  return (
    <div>
      <Header title="Documents" description="Generated tickets, vouchers, and invoices" />
      <DocumentsPanel agencyName={agency?.companyName} />
    </div>
  );
}
