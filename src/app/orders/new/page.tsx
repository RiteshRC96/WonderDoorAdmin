
import { CreateOrderForm } from "@/components/orders/create-order-form";
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
} from "@/components/ui/breadcrumb";
import { db, collection, getDocs, Timestamp } from '@/lib/firebase/firebase';
import type { AddItemInput } from '@/schemas/inventory';

// Define the structure of an inventory item for selection
interface InventorySelectItem extends AddItemInput {
  id: string;
  // Timestamps are not needed for selection, but keep structure consistent
  createdAt?: string;
  updatedAt?: string;
}

// Function to fetch inventory items for selection (similar to inventory page fetch)
async function getInventoryItemsForSelection(): Promise<{ items: InventorySelectItem[]; error?: string }> {
  if (!db) {
    const errorMessage = "Database initialization failed. Cannot fetch inventory for order creation.";
    console.error(errorMessage);
    return { items: [], error: "Database initialization failed." };
  }

  try {
    const inventoryCollectionRef = collection(db, 'inventory');
    const querySnapshot = await getDocs(inventoryCollectionRef);
    const items: InventorySelectItem[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data() as AddItemInput & { createdAt?: Timestamp, updatedAt?: Timestamp };

      // Convert Timestamps to ISO strings for serialization
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined;
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined;

      const { createdAt: _, updatedAt: __, ...restData } = data;

      items.push({
        id: doc.id,
        ...restData,
        createdAt,
        updatedAt,
      });
    });
    return { items };
  } catch (error) {
    const errorMessage = `Error fetching inventory items for selection: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return { items: [], error: "Failed to load inventory data." };
  }
}

export default async function CreateOrderPage() {
  const { items: inventoryItems, error: fetchError } = await getInventoryItemsForSelection();

  // Handle fetch error if necessary (display error in form or block access)
  // For simplicity, we'll pass the error to the form to handle

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-6">
       {/* Breadcrumbs */}
        <Breadcrumb>
           <BreadcrumbList>
             <BreadcrumbItem>
               <BreadcrumbLink asChild><Link href="/"><Home className="h-4 w-4"/></Link></BreadcrumbLink>
             </BreadcrumbItem>
             <BreadcrumbSeparator />
              <BreadcrumbItem>
               <BreadcrumbLink asChild><Link href="/orders">Orders</Link></BreadcrumbLink>
             </BreadcrumbItem>
             <BreadcrumbSeparator />
             <BreadcrumbItem>
               <BreadcrumbPage>Create New Order</BreadcrumbPage>
             </BreadcrumbItem>
           </BreadcrumbList>
         </Breadcrumb>

       {/* Back Button */}
       <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" asChild>
           <Link href="/orders">
             <ArrowLeft className="mr-2 h-4 w-4" />
             Back to Orders
           </Link>
         </Button>
          <h1 className="text-2xl font-semibold text-foreground hidden md:block">Create New Order</h1>
       </div>

       {/* Form Component */}
      <CreateOrderForm inventoryItems={inventoryItems} fetchError={fetchError} />
    </div>
  );
}

export const metadata = {
  title: 'Create New Order | Showroom Manager',
  description: 'Create a new customer order.',
};

// Ensure dynamic rendering because inventory data is fetched
export const dynamic = 'force-dynamic';
