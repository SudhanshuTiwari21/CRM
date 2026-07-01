import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/header";
import { DocumentsPanel } from "@/components/documents/documents-panel";

export default async function DocumentsPage() {
  const agency = await prisma.agencySettings.findUnique({ where: { id: "default" } });

  return (
    <div>
      <Header title="Documents" description="Generated tickets, vouchers, and invoices" />
      <DocumentsPanel agencyName={agency?.companyName} />
    </div>
  );
}
