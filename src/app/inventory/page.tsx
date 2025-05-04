
"use client"; // Make this a Client Component

import * as React from 'react'; // Import React
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Filter, Search, Box, AlertTriangle, PackageSearch } from "lucide-react"; // Added PackageSearch icon
import Link from 'next/link';
import { db, collection, getDocs, Timestamp, query, orderBy } from '@/lib/firebase/firebase'; // Import Firestore instance and functions, including Timestamp and query utilities
import type { AddItemInput } from '@/schemas/inventory'; // Import the type for structure
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import { InventoryItemCard } from "@/components/inventory/inventory-item-card"; // Import the client component
import { Card, CardContent, CardFooter } from "@/components/ui/card"; // Import Card, CardContent, CardFooter
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton for loading state

// Define the structure of an inventory item including its ID and serializable timestamps
interface InventoryItem extends Omit<AddItemInput, 'createdAt' | 'updatedAt'> {
  id: string;
  createdAt?: string; // Store as ISO string for serialization
  updatedAt?: string; // Store as ISO string for serialization
}

// Function to fetch inventory items from Firestore (can be called from client or server)
async function getInventoryItems(): Promise<{ items: InventoryItem[]; error?: string }> {
  if (!db) {
    const errorMessage = "Firestore database is not initialized. Cannot fetch inventory. Please check Firebase configuration in .env.local and restart the server.";
    console.error(errorMessage);
    return { items: [], error: "Database initialization failed. Please check configuration." };
  }

  try {
    console.log("Attempting to fetch inventory items from Firestore...");
    const inventoryCollectionRef = collection(db, 'inventory');
    // Query ordered by creation date, descending
    const q = query(inventoryCollectionRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const items: InventoryItem[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data() as AddItemInput & { createdAt?: Timestamp, updatedAt?: Timestamp };
      // Ensure timestamps are converted to ISO strings for serialization
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(); // Fallback if no timestamp
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined;
      // Exclude the original Timestamp objects before spreading the rest of the data
      const { createdAt: originalTimestamp, updatedAt: originalUpdatedAt, ...restData } = data;
      items.push({ id: doc.id, ...restData, createdAt, updatedAt });
    });
    console.log(`Fetched ${items.length} inventory items.`);
    return { items };
  } catch (error) {
     let errorMessage = `Error fetching inventory items from Firestore: ${error instanceof Error ? error.message : String(error)}`;
      // Provide a more specific error message if it's likely an index issue
      if (error instanceof Error && error.message.toLowerCase().includes("index")) {
         errorMessage = "Firestore query failed: A required index is missing. Please create the index in the Firebase console (Firestore Database > Indexes) for the 'inventory' collection, ordered by 'createdAt' descending.";
         console.warn(errorMessage); // Log as warning as it's a configuration issue
       }
    console.error(errorMessage); // Log the full error for debugging
    // Return a user-friendly error message
    return { items: [], error: errorMessage };
  }
}

export default function InventoryPage() {
  const [inventoryItems, setInventoryItems] = React.useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedStyle, setSelectedStyle] = React.useState("all");
  const [selectedMaterial, setSelectedMaterial] = React.useState("all");

  // Fetch data on component mount
  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null); // Clear previous errors
      const { items, error } = await getInventoryItems();
      if (error) {
        setFetchError(error);
      } else {
        setInventoryItems(items);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []); // Empty dependency array ensures this runs once on mount

  // Calculate unique styles and materials from fetched items
  const uniqueStyles = React.useMemo(() => Array.from(new Set(inventoryItems.map(item => item.style))).filter(Boolean), [inventoryItems]);
  const uniqueMaterials = React.useMemo(() => Array.from(new Set(inventoryItems.map(item => item.material))).filter(Boolean), [inventoryItems]);

  // Filter items based on search and select filters
  const filteredItems = React.useMemo(() => {
    return inventoryItems.filter(item => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === "" ||
        (item.name && item.name.toLowerCase().includes(searchLower)) ||
        (item.sku && item.sku.toLowerCase().includes(searchLower));
      const matchesStyle = selectedStyle === "all" || item.style === selectedStyle;
      const matchesMaterial = selectedMaterial === "all" || item.material === selectedMaterial;
      return matchesSearch && matchesStyle && matchesMaterial;
    });
  }, [inventoryItems, searchQuery, selectedStyle, selectedMaterial]);

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-8">
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
              {/* Specific guidance for common errors */}
              {fetchError.includes("initialization failed") && (
                <span className="block mt-2 text-xs">
                  Please verify your Firebase setup in `.env.local` and restart the application.
                </span>
              )}
               {fetchError.includes("index") && (
                 <span className="block mt-2 text-xs">
                    A Firestore index might be required. Please check the Firebase console under Firestore Database &gt; Indexes. Create an index on the 'inventory' collection for the 'createdAt' field (descending).
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
            <Input
              placeholder="Search by name or SKU..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoading} // Disable while loading initial data
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <Select
                value={selectedStyle}
                onValueChange={setSelectedStyle}
                disabled={isLoading || uniqueStyles.length === 0} // Disable if no styles
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
                  <SelectValue placeholder="Filter by Style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Styles</SelectItem>
                  {uniqueStyles.map(style => (
                    <SelectItem key={style} value={style}>{style}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedMaterial}
                onValueChange={setSelectedMaterial}
                disabled={isLoading || uniqueMaterials.length === 0} // Disable if no materials
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                   <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
                  <SelectValue placeholder="Filter by Material" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Materials</SelectItem>
                  {uniqueMaterials.map(material => (
                     <SelectItem key={material} value={material}>{material}</SelectItem>
                   ))}
                </SelectContent>
              </Select>
          </div>
           {/* Remove Apply Filters button as filtering is now instant */}
        </div>
      </Card>

      {/* Inventory Grid or Loading Skeletons */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
           {Array.from({ length: 8 }).map((_, index) => ( // Show 8 skeletons
              <Card key={index} className="overflow-hidden flex flex-col h-full">
                 <Skeleton className="h-52 w-full" />
                 <CardContent className="p-4 pb-2 flex-grow">
                    <Skeleton className="h-6 w-3/4 mb-1" />
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-4 w-full" />
                    <div className="mt-2">
                       <Skeleton className="h-5 w-1/3" />
                    </div>
                 </CardContent>
                 <CardFooter className="p-4 pt-2 flex justify-between items-center border-t mt-auto">
                    <Skeleton className="h-8 w-1/4" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                 </CardFooter>
              </Card>
           ))}
        </div>
      ) : !fetchError && filteredItems.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((item) => (
             // Use the client component for each card
             // Pass the item with the serialized date
             <InventoryItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : !fetchError && filteredItems.length === 0 ? ( // Show "No Results" if filters applied and no items match
         <Card className="col-span-full shadow-sm">
            <div className="text-center py-16 text-muted-foreground">
              <PackageSearch className="mx-auto h-16 w-16 mb-4" /> {/* Icon for no results */}
               <p className="text-lg font-medium">No items match your criteria.</p>
              <p className="text-sm mt-2">
                {searchQuery || selectedStyle !== 'all' || selectedMaterial !== 'all'
                   ? "Try adjusting your search or filters."
                   : "Use the 'Add New Item' button to populate your inventory."}
               </p>
            </div>
         </Card>
       ) : null /* Don't show placeholder if there was a fetch error */}
    </div>
  );
}

// Keep metadata static or remove if not needed in Client Component
// export const metadata = {
//   title: 'Inventory | Showroom Manager',
//   description: 'Browse and manage inventory items.',
// };

// Dynamic rendering is inherent with client-side fetching/filtering
// export const dynamic = 'force-dynamic';

