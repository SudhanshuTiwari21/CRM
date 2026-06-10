import { Header } from "@/components/layout/header";
import { CustomersTable } from "@/components/customers/customers-table";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CustomersPage() {
  return (
    <div>
      <Header
        title="Customers"
        description="Manage customer profiles and booking history"
        actions={
          <CustomerFormDialog
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
