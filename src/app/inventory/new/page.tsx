
import { AddItemForm } from "@/components/inventory/add-item-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AddInventoryItemPage() {
  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in">
       <div className="mb-6 flex items-center justify-between">
          <Button variant="outline" size="sm" asChild>
           <Link href="/inventory">
             <ArrowLeft className="mr-2 h-4 w-4" />
             Back to Inventory
           </Link>
         </Button>
       </div>
      <AddItemForm />
    </div>
  );
}

export const metadata = {
  title: 'Add New Item | Showroom Manager',
  description: 'Add a new item to the inventory.',
};
