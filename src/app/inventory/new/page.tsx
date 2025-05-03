import { AddItemForm } from "@/components/inventory/add-item-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AddInventoryItemPage() {
  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in">
       <div className="mb-6 flex items-center justify-between">
         {/* Optional: Add a back button if direct navigation is expected */}
          <Button variant="outline" size="sm" asChild>
           <Link href="/inventory">
             <ArrowLeft className="mr-2 h-4 w-4" />
             Back to Inventory
           </Link>
         </Button>
         {/* Title could also be here or handled within the form component */}
       </div>
      <AddItemForm />
    </div>
  );
}

// Optional: Add dynamic metadata generation
export const metadata = {
  title: 'Add New Item | Showroom Manager',
  description: 'Add a new item to the inventory.',
};