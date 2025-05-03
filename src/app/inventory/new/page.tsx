
import { AddItemForm } from "@/components/inventory/add-item-form";
import { ArrowLeft, Home, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb" // Import Breadcrumb components


export default function AddInventoryItemPage() {
  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-6"> {/* Added spacing */}
       {/* Breadcrumbs */}
        <Breadcrumb>
           <BreadcrumbList>
             <BreadcrumbItem>
               <BreadcrumbLink asChild><Link href="/"><Home className="h-4 w-4"/></Link></BreadcrumbLink>
             </BreadcrumbItem>
             <BreadcrumbSeparator />
              <BreadcrumbItem>
               <BreadcrumbLink asChild><Link href="/inventory">Inventory</Link></BreadcrumbLink>
             </BreadcrumbItem>
             <BreadcrumbSeparator />
             <BreadcrumbItem>
               <BreadcrumbPage>Add New Item</BreadcrumbPage>
             </BreadcrumbItem>
           </BreadcrumbList>
         </Breadcrumb>

       {/* Back Button */}
       <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" asChild>
           <Link href="/inventory">
             <ArrowLeft className="mr-2 h-4 w-4" />
             Back to Inventory
           </Link>
         </Button>
          <h1 className="text-2xl font-semibold text-foreground hidden md:block">Add New Inventory Item</h1> {/* Title for larger screens */}
       </div>

       {/* Form Component */}
      <AddItemForm />
    </div>
  );
}

export const metadata = {
  title: 'Add New Item | Showroom Manager',
  description: 'Add a new item to the inventory.',
};
