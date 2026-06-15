"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Plus, Trash2, User, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { extractPanFromGstin } from "@/lib/gstin-lookup";

type CustomerType = "INDIVIDUAL" | "BUSINESS";

interface BranchForm {
  name: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  isPrimary: boolean;
}

interface ContactForm {
  name: string;
  phone: string;
  email: string;
  designation: string;
  isPrimary: boolean;
}

interface CustomerData {
  id: string;
  type: CustomerType;
  name: string;
  phone: string;
  email?: string | null;
  pan?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  branches?: BranchForm[];
  contacts?: ContactForm[];
}

interface AddCustomerDialogProps {
  customer?: CustomerData;
  trigger?: React.ReactNode;
}

const emptyBranch = (): BranchForm => ({
  name: "Head Office",
  gstin: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  isPrimary: true,
});

const emptyContact = (): ContactForm => ({
  name: "",
  phone: "",
  email: "",
  designation: "",
  isPrimary: true,
});

export function AddCustomerDialog({ customer, trigger }: AddCustomerDialogProps) {
  const router = useRouter();
  const isEdit = !!customer;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"type" | "form">(isEdit ? "form" : "type");
  const [customerType, setCustomerType] = useState<CustomerType>(customer?.type || "INDIVIDUAL");
  const [loading, setLoading] = useState(false);
  const [fetchingGstin, setFetchingGstin] = useState<number | null>(null);

  const [individual, setIndividual] = useState({
    name: customer?.type === "INDIVIDUAL" ? customer.name : "",
    phone: customer?.phone || "",
    email: customer?.email || "",
    address: customer?.address || "",
    city: customer?.city || "",
    state: customer?.state || "",
    pincode: customer?.pincode || "",
  });

  const [business, setBusiness] = useState({
    name: customer?.type === "BUSINESS" ? customer.name : "",
    phone: customer?.phone || "",
    email: customer?.email || "",
    pan: customer?.pan || "",
  });

  const [branches, setBranches] = useState<BranchForm[]>(
    customer?.branches?.length
      ? customer.branches
      : [emptyBranch()]
  );

  const [contacts, setContacts] = useState<ContactForm[]>(
    customer?.contacts?.length
      ? customer.contacts
      : [emptyContact()]
  );

  function resetOnClose(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen && !isEdit) {
      setStep("type");
      setCustomerType("INDIVIDUAL");
    }
  }

  function selectType(type: CustomerType) {
    setCustomerType(type);
    setStep("form");
  }

  async function fetchGstinForBranch(index: number) {
    const gstin = branches[index]?.gstin?.trim().toUpperCase();
    if (!gstin) {
      toast.error("Enter GSTIN first");
      return;
    }

    setFetchingGstin(index);
    try {
      const res = await fetch("/api/crm/gstin/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gstin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "GSTIN lookup failed");

      setBranches((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          gstin,
          address: data.address || next[index].address,
          city: data.city || next[index].city,
          state: data.state || next[index].state,
          pincode: data.pincode || next[index].pincode,
          name: data.tradeName || data.legalName || next[index].name,
        };
        return next;
      });

      const pan = data.pan || extractPanFromGstin(gstin);
      if (pan) setBusiness((b) => ({ ...b, pan }));

      toast.success(
        data.source === "api"
          ? "Address fetched from GSTIN"
          : "GSTIN validated — add GSTIN_API_KEY in .env for full address lookup"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GSTIN lookup failed");
    } finally {
      setFetchingGstin(null);
    }
  }

  function updateBranch(index: number, patch: Partial<BranchForm>) {
    setBranches((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      if (patch.gstin) {
        const pan = extractPanFromGstin(patch.gstin.toUpperCase());
        if (pan) setBusiness((b) => ({ ...b, pan }));
      }
      return next;
    });
  }

  function addBranch() {
    setBranches((prev) => [
      ...prev.map((b) => ({ ...b, isPrimary: false })),
      { ...emptyBranch(), name: `Branch ${prev.length + 1}`, isPrimary: false },
    ]);
  }

  function removeBranch(index: number) {
    setBranches((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      if (!next.some((b) => b.isPrimary)) next[0].isPrimary = true;
      return next;
    });
  }

  function updateContact(index: number, patch: Partial<ContactForm>) {
    setContacts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function addContact() {
    setContacts((prev) => [
      ...prev.map((c) => ({ ...c, isPrimary: false })),
      { ...emptyContact(), isPrimary: false },
    ]);
  }

  function removeContact(index: number) {
    setContacts((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      if (!next.some((c) => c.isPrimary)) next[0].isPrimary = true;
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload =
      customerType === "INDIVIDUAL"
        ? { type: "INDIVIDUAL" as const, ...individual }
        : {
            type: "BUSINESS" as const,
            ...business,
            branches: branches.map((b) => ({
              ...b,
              gstin: b.gstin || undefined,
            })),
            contacts,
          };

    try {
      const res = await fetch(
        isEdit ? `/api/crm/customers/${customer!.id}` : "/api/crm/customers",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(isEdit ? "Customer updated" : "Customer created");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save customer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={resetOnClose}>
      <DialogTrigger asChild>
        {trigger || <Button>{isEdit ? "Edit" : "Add Customer"}</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Customer" : step === "type" ? "Add Customer" : customerType === "BUSINESS" ? "New Business Customer" : "New Individual Customer"}
          </DialogTitle>
          {step === "type" && (
            <DialogDescription>Choose customer type — like Zoho Books</DialogDescription>
          )}
        </DialogHeader>

        {step === "type" && !isEdit ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Card
              className="cursor-pointer transition-colors hover:border-primary"
              onClick={() => selectType("BUSINESS")}
            >
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <Building2 className="h-10 w-10 text-primary" />
                <div>
                  <p className="font-semibold">Business (B2B)</p>
                  <p className="text-xs text-muted-foreground">
                    GSTIN branches, PAN, multiple contacts
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer transition-colors hover:border-primary"
              onClick={() => selectType("INDIVIDUAL")}
            >
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <User className="h-10 w-10 text-primary" />
                <div>
                  <p className="font-semibold">Individual</p>
                  <p className="text-xs text-muted-foreground">
                    Personal traveller — name, phone, email
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {!isEdit && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep("type")}>
                ← Change type
              </Button>
            )}

            {customerType === "INDIVIDUAL" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Name *</Label>
                  <Input value={individual.name} onChange={(e) => setIndividual({ ...individual, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input value={individual.phone} onChange={(e) => setIndividual({ ...individual, phone: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={individual.email} onChange={(e) => setIndividual({ ...individual, email: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Address</Label>
                  <Textarea value={individual.address} onChange={(e) => setIndividual({ ...individual, address: e.target.value })} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={individual.city} onChange={(e) => setIndividual({ ...individual, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input value={individual.state} onChange={(e) => setIndividual({ ...individual, state: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Pincode</Label>
                  <Input value={individual.pincode} onChange={(e) => setIndividual({ ...individual, pincode: e.target.value })} />
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Business Name *</Label>
                    <Input value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone *</Label>
                    <Input value={business.phone} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={business.email} onChange={(e) => setBusiness({ ...business, email: e.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>PAN (optional)</Label>
                    <Input
                      value={business.pan}
                      onChange={(e) => setBusiness({ ...business, pan: e.target.value.toUpperCase() })}
                      placeholder="AAAAA0000A"
                      maxLength={10}
                    />
                    <p className="text-xs text-muted-foreground">Auto-filled when you enter a valid GSTIN</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Branches</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addBranch}>
                      <Plus className="mr-2 h-4 w-4" /> Add Branch
                    </Button>
                  </div>
                  {branches.map((branch, index) => (
                    <div key={index} className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Branch {index + 1}</p>
                        {branches.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeBranch(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Branch Name</Label>
                          <Input value={branch.name} onChange={(e) => updateBranch(index, { name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>GSTIN (optional)</Label>
                          <div className="flex gap-2">
                            <Input
                              value={branch.gstin}
                              onChange={(e) => updateBranch(index, { gstin: e.target.value.toUpperCase() })}
                              placeholder="22AAAAA0000A1Z5"
                              maxLength={15}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => fetchGstinForBranch(index)}
                              disabled={fetchingGstin === index}
                              title="Fetch address from GSTIN"
                            >
                              {fetchingGstin === index ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Search className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Address</Label>
                          <Textarea value={branch.address} onChange={(e) => updateBranch(index, { address: e.target.value })} rows={2} />
                        </div>
                        <div className="space-y-2">
                          <Label>City</Label>
                          <Input value={branch.city} onChange={(e) => updateBranch(index, { city: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>State</Label>
                          <Input value={branch.state} onChange={(e) => updateBranch(index, { state: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Pincode</Label>
                          <Input value={branch.pincode} onChange={(e) => updateBranch(index, { pincode: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Contacts</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addContact}>
                      <Plus className="mr-2 h-4 w-4" /> Add Contact
                    </Button>
                  </div>
                  {contacts.map((contact, index) => (
                    <div key={index} className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Contact {index + 1}</p>
                        {contacts.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeContact(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Name *</Label>
                          <Input value={contact.name} onChange={(e) => updateContact(index, { name: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input value={contact.phone} onChange={(e) => updateContact(index, { phone: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input type="email" value={contact.email} onChange={(e) => updateContact(index, { email: e.target.value })} />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Designation</Label>
                          <Input value={contact.designation} onChange={(e) => updateContact(index, { designation: e.target.value })} placeholder="Accounts Manager" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Update Customer" : "Create Customer"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
