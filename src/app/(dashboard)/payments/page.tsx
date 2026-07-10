import { Header } from "@/components/layout/header";
import { PaymentsTabs } from "@/components/payments/payments-tabs";

export default function PaymentsPage() {
  return (
    <div>
      <Header
        title="Payments"
        description="Record payments against bookings, on-account receipts, and credit notes"
      />
      <PaymentsTabs />
    </div>
  );
}
