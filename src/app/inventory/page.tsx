import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Filter, Search, Box, AlertTriangle } from "lucide-react";
import Link from 'next/link';
import { db, collection, getDocs, Timestamp } from '@/lib/firebase/firebase'; // Import Firestore instance and functions, including Timestamp
import type { AddItemInput } from '@/schemas/inventory'; // Import the type for structure
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import { InventoryItemCard } from "@/components/inventory/inventory-item-card"; // Import the new client component
import { Card } from "@/components/ui/card"; // Import Card for filter section

// Define the structure of an inventory item including its ID and serializable createdAt
interface InventoryItem extends Omit<AddItemInput, 'createdAt'> { // Omit potential createdAt from schema if it exists
  id: string;
  createdAt?: string; // Store as ISO string for serialization
}

// Function to fetch inventory items from Firestore
async function getInventoryItems(): Promise<{ items: InventoryItem[]; error?: string }> {
  // Explicitly check if db is null, indicating initialization failure
  if (db === null) {
    const errorMessage = "Firestore database is not initialized. Cannot fetch inventory. Please check Firebase configuration in .env.local and restart the server.";
    console.error(errorMessage);
    // Return a specific error message related to configuration/initialization
    return { items: [], error: "Database initialization failed. Please check configuration." };
  }

  try {
    console.log("Attempting to fetch inventory items from Firestore...");
    const inventoryCollectionRef = collection(db, 'inventory');
    const querySnapshot = await getDocs(inventoryCollectionRef);
    const items: InventoryItem[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data() as AddItemInput & { createdAt?: Timestamp }; // Expect potential Timestamp
      // Convert Timestamp to ISO string for serialization
      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : undefined;

      // Remove the original createdAt from data if it exists before spreading
      const { createdAt: _, ...restData } = data;

      items.push({
        id: doc.id,
        ...restData, // Spread the rest of the data
        createdAt, // Add the serialized date string
      });
    });
    console.log(`Fetched ${items.length} inventory items.`);
     // Sort items by creation date string, newest first
     items.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB.getTime() - dateA.getTime(); // Sort descending
      });
    return { items };
  } catch (error) {
    const errorMessage = `Error fetching inventory items from Firestore: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    // Return a generic error for actual database query errors
    return { items: [], error: "Failed to load inventory data due to a database error." };
  }
}


export default async function InventoryPage() {
  // Fetch items directly in the Server Component
  const { items: inventoryItems, error: fetchError } = await getInventoryItems();

  // Extract unique styles and materials for filters
  const uniqueStyles = Array.from(new Set(inventoryItems.map(item => item.style))).filter(Boolean);
  const uniqueMaterials = Array.from(new Set(inventoryItems.map(item => item.material))).filter(Boolean);

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-8"> {/* Added spacing */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-4xl font-bold text-foreground">Inventory</h1>
        <Button asChild>
          <Link href="/inventory/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
          </Link>
        </Button>
      </div>

      {/* Display Error if fetching failed */}
      {fetchError && (
         <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Inventory</AlertTitle>
            <AlertDescription>
              {fetchError}
              {/* Add a hint if the error is about initialization */}
              {fetchError.includes("initialization failed") && (
                <span className="block mt-2 text-xs">
                  Please verify your Firebase setup in `.env.local` and restart the application.
                </span>
              )}
            </AlertDescription>
          </Alert>
      )}

      {/* Filters and Search Section */}
      <Card className="p-4 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-grow w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or SKU..." className="pl-10" />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <Select>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
                  <SelectValue placeholder="Filter by Style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Styles</SelectItem>
                  {uniqueStyles.map(style => (
                    <SelectItem key={style} value={style.toLowerCase()}>{style}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="w-full sm:w-[180px]">
                   <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
                  <SelectValue placeholder="Filter by Material" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Materials</SelectItem>
                  {uniqueMaterials.map(material => (
                     <SelectItem key={material} value={material.toLowerCase()}>{material}</SelectItem>
                   ))}
                </SelectContent>
              </Select>
          </div>
        </div>
      </Card>


      {/* Inventory Grid */}
      {!fetchError && ( // Only show grid if no error occurred
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {inventoryItems.map((item) => (
             // Use the client component for each card
             // Pass the item with the serialized date
             <InventoryItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

       {/* Placeholder for when no items are found (and no error) */}
       {!fetchError && inventoryItems.length === 0 && (
         <Card className="col-span-full shadow-sm">
            <div className="text-center py-16 text-muted-foreground">
              <Box className="mx-auto h-16 w-16 mb-4" /> {/* Larger Icon */}
              <p className="text-lg font-medium">No inventory items found.</p>
              <p className="text-sm mt-2">Use the 'Add New Item' button to populate your inventory.</p>
            </div>
         </Card>
       )}
    </div>
  );
}

export const metadata = {
  title: 'Inventory | Showroom Manager',
  description: 'Browse and manage inventory items.',
};

// Ensure dynamic rendering because data is fetched on each request
// This is important to reflect Firestore changes immediately
export const dynamic = 'force-dynamic';
// Optional: Could consider 'force-static' with revalidation if data changes less frequently
// export const revalidate = 60; // Revalidate every 60 seconds

