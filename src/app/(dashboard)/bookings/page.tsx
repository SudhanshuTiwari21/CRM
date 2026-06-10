import Link from "next/link";
import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookingsTable } from "@/components/booking/bookings-table";
import { BookingsKanban } from "@/components/booking/bookings-kanban";
import { Plus } from "lucide-react";

export default function BookingsPage() {
  return (
    <div>
      <Header
        title="Bookings"
        description="Manage all flight, hotel, and bus bookings"
        actions={
          <Button asChild>
            <Link href="/bookings/new">
              <Plus className="mr-2 h-4 w-4" />
              New Booking
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Loading...</div>}>
            <BookingsTable />
          </Suspense>
        </TabsContent>
        <TabsContent value="kanban">
          <BookingsKanban />
        </TabsContent>
      </Tabs>
    </div>
  );
}
