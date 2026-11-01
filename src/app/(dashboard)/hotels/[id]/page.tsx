import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { EditHotelProfileDialog } from "@/components/hotels/edit-hotel-profile-dialog";

export default async function HotelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hotel = await prisma.hotelProfile.findUnique({
    where: { id },
    include: {
      hotelBookings: {
        orderBy: { booking: { createdAt: "desc" } },
        take: 20,
        include: {
          booking: {
            select: {
              id: true,
              publicRef: true,
              status: true,
              createdAt: true,
              customer: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!hotel) notFound();

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/hotels"><ArrowLeft className="mr-2 h-4 w-4" />Back to Hotels</Link>
      </Button>
      <Header
        title={hotel.name}
        description="Hotel profile"
        actions={
          <EditHotelProfileDialog
            hotel={{
              id: hotel.id,
              name: hotel.name,
              address: hotel.address,
              city: hotel.city,
              phone: hotel.phone,
              email: hotel.email,
              checkInTime: hotel.checkInTime,
              checkOutTime: hotel.checkOutTime,
            }}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact & Location</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-medium">Address:</span> {hotel.address}</p>
            {hotel.city && <p><span className="font-medium">City:</span> {hotel.city}</p>}
            {hotel.phone && <p><span className="font-medium">Phone:</span> {hotel.phone}</p>}
            {hotel.email && <p><span className="font-medium">Email:</span> {hotel.email}</p>}
            <p><span className="font-medium">Check-in:</span> {hotel.checkInTime}</p>
            <p><span className="font-medium">Check-out:</span> {hotel.checkOutTime}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Bookings</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {hotel.hotelBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              hotel.hotelBookings.map((hb) => (
                <Link
                  key={hb.id}
                  href={`/bookings/${hb.booking.id}`}
                  className="block rounded border p-3 text-sm hover:bg-muted/50"
                >
                  <p className="font-medium">{hb.booking.publicRef}</p>
                  <p className="text-muted-foreground">
                    {hb.booking.customer.name} • {formatDateTime(hb.booking.createdAt)}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
