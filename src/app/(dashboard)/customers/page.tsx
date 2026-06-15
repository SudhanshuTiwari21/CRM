import { Header } from "@/components/layout/header";
import { CustomersTable } from "@/components/customers/customers-table";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CustomersPage() {
  return (
    <div>
      <Header
        title="Customers"
        description="Manage customer profiles and booking history"
        actions={
          <AddCustomerDialog
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            }
          />
        }
      />
      <CustomersTable />
    </div>
  );
}
