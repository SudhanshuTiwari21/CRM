import { Header } from "@/components/layout/header";
import { OfflineBookingWizard } from "@/components/booking/offline-booking-wizard";

export default function NewBookingPage() {
  return (
    <div>
      <Header
        title="New Offline Booking"
        description="Create an offline booking - saved as Processing until PNR is entered"
      />
      <OfflineBookingWizard />
    </div>
  );
}
