import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { CustomerCreditPanel } from "@/components/customers/customer-credit-panel";
import { StatusBadge } from "@/components/booking/status-badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { PRODUCT_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      branches: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
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

  const editCustomer = {
    id: customer.id,
    type: customer.type,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    pan: customer.pan,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    pincode: customer.pincode,
    branches: customer.branches.map((b) => ({
      name: b.name,
      gstin: b.gstin || "",
      address: b.address || "",
      city: b.city || "",
      state: b.state || "",
      pincode: b.pincode || "",
      isPrimary: b.isPrimary,
    })),
    contacts: customer.contacts.map((c) => ({
      name: c.name,
      phone: c.phone || "",
      email: c.email || "",
      designation: c.designation || "",
      isPrimary: c.isPrimary,
    })),
  };

  const addressLine = [customer.address, customer.city, customer.state, customer.pincode]
    .filter(Boolean)
    .join(", ");

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
        actions={
          <AddCustomerDialog
            customer={editCustomer}
            trigger={<Button variant="outline">Edit</Button>}
          />
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          {customer.type === "BUSINESS" ? (
            <><Building2 className="h-3 w-3" /> Business</>
          ) : (
            <><User className="h-3 w-3" /> Individual</>
          )}
        </Badge>
        {customer.pan && <Badge variant="outline">PAN: {customer.pan}</Badge>}
        {customer.gstin && <Badge variant="outline">GSTIN: {customer.gstin}</Badge>}
      </div>

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
            <p className="text-muted-foreground">{addressLine || "No address"}</p>
          </CardContent>
        </Card>
      </div>

      <CustomerCreditPanel
        customerId={customer.id}
        initial={{
          creditEnabled: customer.creditEnabled,
          creditLimit: customer.creditLimit,
          creditBalance: customer.creditBalance,
          paymentTermsDays: customer.paymentTermsDays,
        }}
      />

      {customer.type === "BUSINESS" && customer.branches.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Branches</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {customer.branches.map((branch) => (
              <div key={branch.id} className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{branch.name}</p>
                  {branch.isPrimary && <Badge variant="secondary">Primary</Badge>}
                </div>
                {branch.gstin && <p className="text-sm text-muted-foreground">GSTIN: {branch.gstin}</p>}
                <p className="text-sm text-muted-foreground">
                  {[branch.address, branch.city, branch.state, branch.pincode].filter(Boolean).join(", ") || "—"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {customer.type === "BUSINESS" && customer.contacts.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Contacts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {customer.contacts.map((contact) => (
              <div key={contact.id} className="flex items-start justify-between rounded-lg border p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{contact.name}</p>
                    {contact.isPrimary && <Badge variant="secondary">Primary</Badge>}
                  </div>
                  {contact.designation && <p className="text-sm text-muted-foreground">{contact.designation}</p>}
                  <p className="text-sm">{contact.phone || "—"} · {contact.email || "—"}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
