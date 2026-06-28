import { Header } from "@/components/layout/header";
import { AccountingTabs } from "@/components/accounting/accounting-tabs";

export default function AccountingPage() {
  return (
    <div>
      <Header
        title="Accounting"
        description="Sales statements, GST bills, and outstanding payments"
      />
      <AccountingTabs />
    </div>
  );
}
