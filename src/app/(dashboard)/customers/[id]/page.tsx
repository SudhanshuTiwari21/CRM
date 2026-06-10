import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { StatusBadge } from "@/components/booking/status-badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { PRODUCT_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      bookings: {
        orderBy: { createdAt: "desc" },
        include: { assignedAgent: { select: { name: true } } },
      },
    },
  });

  if (!customer) notFound();

  const lifetimeValue = customer.bookings
    .filter((b) => b.paymentStatus === "PAID")
    .reduce((sum, b) => sum + Number(b.totalAmount), 0);

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/customers"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
        </Button>
      </div>

      <Header
        title={customer.name}
        description={customer.phone}
        actions={<CustomerFormDialog customer={customer} trigger={<Button variant="outline">Edit</Button>} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Bookings</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{customer.bookings.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Lifetime Value</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(lifetimeValue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Contact</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p>{customer.email || "No email"}</p>
            <p className="text-muted-foreground">{customer.address || "No address"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Booking History</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {customer.bookings.length === 0 ? (
            <p className="text-muted-foreground">No bookings yet</p>
          ) : (
            customer.bookings.map((b) => (
              <Link key={b.id} href={`/bookings/${b.id}`} className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
                <div>
                  <p className="font-medium">{b.publicRef}</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(b.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{PRODUCT_LABELS[b.productType]}</Badge>
                  <StatusBadge status={b.status} />
                  <span className="font-medium">{formatCurrency(b.totalAmount)}</span>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
