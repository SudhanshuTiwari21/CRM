"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { LeadsTable } from "@/components/leads/leads-table";
import { AddLeadDialog } from "@/components/leads/add-lead-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function LeadsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <Header
        title="Leads"
        description="Capture enquiries, follow up, and convert to customers"
        actions={
          <AddLeadDialog
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Lead
              </Button>
            }
            onCreated={() => setRefreshKey((k) => k + 1)}
          />
        }
      />
      <LeadsTable refreshKey={refreshKey} />
    </div>
  );
}
