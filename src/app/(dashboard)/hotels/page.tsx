import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const hotels = await prisma.hotelProfile.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    include: { _count: { select: { hotelBookings: true } } },
  });

  return (
    <div>
      <Header title="Hotels" description="Saved hotel profiles — auto-fill when booking" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Hotels ({hotels.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hotels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hotel profiles yet. Create a hotel booking to save a profile automatically.
            </p>
          ) : (
            hotels.map((hotel) => (
              <div
                key={hotel.id}
                className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{hotel.name}</p>
                  <p className="text-sm text-muted-foreground">{hotel.address}</p>
                  <p className="text-xs text-muted-foreground">
                    {[hotel.city, hotel.phone, hotel.email].filter(Boolean).join(" • ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {hotel._count.hotelBookings} booking(s)
                  </span>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/hotels/${hotel.id}`}>View</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
