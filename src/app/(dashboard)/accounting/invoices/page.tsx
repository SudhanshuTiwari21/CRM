import { getAgencySettings } from "@/lib/brand-context";
import { Header } from "@/components/layout/header";
import { DocumentsPanel } from "@/components/documents/documents-panel";

export default async function AccountingInvoicesPage() {
  const agency = await getAgencySettings();

  return (
    <div>
      <Header
        title="Invoices"
        description="Tax invoices generated for bookings"
      />
      <DocumentsPanel
        agencyName={agency?.companyName}
        defaultCategory="invoice"
        hideCategoryCards
      />
    </div>
  );
}
