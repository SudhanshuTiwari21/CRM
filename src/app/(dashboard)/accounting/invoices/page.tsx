import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/header";
import { DocumentsPanel } from "@/components/documents/documents-panel";

export default async function AccountingInvoicesPage() {
  const agency = await prisma.agencySettings.findUnique({ where: { id: "default" } });

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
