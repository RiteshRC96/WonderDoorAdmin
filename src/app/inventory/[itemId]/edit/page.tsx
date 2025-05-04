
import { EditItemForm } from "@/components/inventory/edit-item-form";
import { ArrowLeft, Home, ChevronRight, AlertTriangle } from "lucide-react";
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
import { db, doc, getDoc, Timestamp } from '@/lib/firebase/firebase';
import type { AddItemInput } from '@/schemas/inventory';
import { notFound } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define the structure of an inventory item including its ID and serializable timestamps
// Removed imageHint from AddItemInput Omit
interface InventoryItem extends Omit<AddItemInput, 'imageHint'> {
  id: string;
  createdAt?: string; // Expect ISO string
  updatedAt?: string; // Expect ISO string
  imageUrl?: string; // Keep imageUrl explicitly
  name: string; // Ensure required fields
  sku: string;
  style: string;
  material: string;
  dimensions: string;
  stock: number;
  price: number;
}

// Fetch item details, similar to the detail page but without related data
async function getItemForEdit(itemId: string): Promise<{ item: InventoryItem | null; error?: string }> {
  if (!db) {
    const errorMessage = "Database initialization failed. Please check configuration.";
    console.error(errorMessage);
    return { item: null, error: errorMessage };
  }

  try {
    const itemDocRef = doc(db, 'inventory', itemId);
    const docSnap = await getDoc(itemDocRef);

    if (!docSnap.exists()) {
      return { item: null }; // Not found
    }

    // Cast data including optional imageUrl, exclude imageHint
    const data = docSnap.data() as Omit<AddItemInput, 'imageHint'> & { createdAt?: Timestamp, updatedAt?: Timestamp };


    // Convert Timestamps to ISO strings for serialization
    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined;
    const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined;

    // Exclude timestamps before spreading
    const { createdAt: _, updatedAt: __, ...restData } = data;

    const itemData: InventoryItem = {
      id: docSnap.id,
      ...restData, // Spread the rest of the data (without imageHint)
      createdAt,
      updatedAt,
    };

    return { item: itemData };

  } catch (error) {
    const errorMessage = `Error fetching item for edit (ID ${itemId}): ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return { item: null, error: "Failed to load item data for editing." };
  }
}

export default async function EditInventoryItemPage({ params }: { params: { itemId: string } }) {
  const { item, error: fetchError } = await getItemForEdit(params.itemId);

  // Handle fetch error first
  if (fetchError) {
     return (
       <div className="container mx-auto py-6 space-y-6">
         {/* Breadcrumbs for Error Page */}
         <Breadcrumb>
           <BreadcrumbList>
             <BreadcrumbItem><BreadcrumbLink asChild><Link href="/"><Home className="h-4 w-4"/></Link></BreadcrumbLink></BreadcrumbItem>
             <BreadcrumbSeparator />
             <BreadcrumbItem><BreadcrumbLink asChild><Link href="/inventory">Inventory</Link></BreadcrumbLink></BreadcrumbItem>
             <BreadcrumbSeparator />
             <BreadcrumbItem><BreadcrumbPage>Error</BreadcrumbPage></BreadcrumbItem>
           </BreadcrumbList>
         </Breadcrumb>
         <Alert variant="destructive">
           <AlertTriangle className="h-4 w-4" />
           <AlertTitle>Error Loading Item Data</AlertTitle>
           <AlertDescription>
             {fetchError}
              {fetchError.includes("initialization failed") && (
                <span className="block mt-2 text-xs">
                  Please verify your Firebase setup in `.env.local` and restart the application.
                </span>
              )}
            </AlertDescription>
         </Alert>
       </div>
     );
  }

  // If no error but item is null, then it's not found
  if (!item) {
    notFound();
  }

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
               <BreadcrumbLink asChild><Link href="/inventory">Inventory</Link></BreadcrumbLink>
             </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                    {/* Link back to the item detail page */}
                   <Link href={`/inventory/${item.id}`} className="truncate max-w-xs">{item.name}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
             <BreadcrumbSeparator />
             <BreadcrumbItem>
               <BreadcrumbPage>Edit</BreadcrumbPage>
             </BreadcrumbItem>
           </BreadcrumbList>
         </Breadcrumb>

       {/* Back Button */}
       <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" asChild>
            {/* Link back to the specific item detail page */}
           <Link href={`/inventory/${item.id}`}>
             <ArrowLeft className="mr-2 h-4 w-4" />
             Back to Item Details
           </Link>
         </Button>
          <h1 className="text-2xl font-semibold text-foreground hidden md:block">Edit Inventory Item</h1>
       </div>

       {/* Edit Form Component - Pass the fetched item data */}
       <EditItemForm item={item} />
    </div>
  );
}

// Generate dynamic metadata
export async function generateMetadata({ params }: { params: { itemId: string } }) {
  const { item } = await getItemForEdit(params.itemId);
  return {
    title: item ? `Edit ${item.name} | Showroom Manager` : 'Edit Item | Showroom Manager',
    description: `Edit details for inventory item ${item?.name || params.itemId}.`,
  };
}

// Ensure dynamic rendering because data is fetched on each request
export const dynamic = 'force-dynamic';
