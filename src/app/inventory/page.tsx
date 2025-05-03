
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Filter, Search, Box, Info } from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';
import { db, collection, getDocs } from '@/lib/firebase/firebase'; // Import Firestore instance and functions
import type { AddItemInput } from '@/schemas/inventory'; // Import the type for structure

// Define the structure of an inventory item including its ID
interface InventoryItem extends AddItemInput {
  id: string;
}

// Function to fetch inventory items from Firestore
async function getInventoryItems(): Promise<InventoryItem[]> {
  if (!db) {
    console.error("Firestore database is not initialized. Cannot fetch inventory.");
    return []; // Return empty array if DB is not available
  }

  try {
    const inventoryCollectionRef = collection(db, 'inventory');
    const querySnapshot = await getDocs(inventoryCollectionRef);
    const items: InventoryItem[] = [];
    querySnapshot.forEach((doc) => {
      // Combine document ID with document data
      items.push({ id: doc.id, ...(doc.data() as AddItemInput) });
    });
    return items;
  } catch (error) {
    console.error("Error fetching inventory items from Firestore:", error);
    return []; // Return empty array on error
  }
}


export default async function InventoryPage() {
  // Fetch items directly in the Server Component
  const inventoryItems = await getInventoryItems();

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
        <Button asChild>
          <Link href="/inventory/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
          </Link>
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or SKU..." className="pl-10" />
        </div>
        <Select>
          <SelectTrigger className="w-full md:w-[180px]">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
            <SelectValue placeholder="Filter by Style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Styles</SelectItem>
            {/* Dynamically generate options based on fetched data if needed */}
             <SelectItem value="modern">Modern</SelectItem>
             <SelectItem value="classic">Classic</SelectItem>
             <SelectItem value="minimalist">Minimalist</SelectItem>
             <SelectItem value="mid-century">Mid-Century</SelectItem>
             <SelectItem value="industrial">Industrial</SelectItem>
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger className="w-full md:w-[180px]">
             <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
            <SelectValue placeholder="Filter by Material" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Materials</SelectItem>
             {/* Dynamically generate options based on fetched data if needed */}
             <SelectItem value="oak">Oak</SelectItem>
             <SelectItem value="walnut">Walnut</SelectItem>
             <SelectItem value="pine">Pine</SelectItem>
             <SelectItem value="fabric">Fabric</SelectItem>
             <SelectItem value="metal">Metal</SelectItem>
             <SelectItem value="wood">Wood</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inventory Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {inventoryItems.map((item) => (
          <Card key={item.id} className="overflow-hidden transition-shadow duration-200 hover:shadow-lg group">
            <Link href={`/inventory/${item.id}`} className="block">
              <CardHeader className="p-0">
                <div className="relative h-48 w-full">
                  <Image
                    src={item.imageUrl || `https://picsum.photos/seed/${item.id}/300/200`} // Fallback image
                    alt={item.name}
                    layout="fill"
                    objectFit="cover"
                    data-ai-hint={item.imageHint || 'product item'}
                    className="transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <CardTitle className="text-lg mb-1">{item.name}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground mb-2">
                  {item.style} / {item.material}
                </CardDescription>
                <p className="text-sm">Dimensions: {item.dimensions}</p>
                <p className="text-sm">Stock: <span className={item.stock < 10 ? 'text-destructive font-medium' : ''}>{item.stock}</span></p>
                <p className="text-lg font-semibold mt-2">${item.price?.toFixed(2) || 'N/A'}</p>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
       {/* Placeholder for when no items are found */}
       {inventoryItems.length === 0 && (
         <div className="text-center py-12 text-muted-foreground col-span-full">
           <Box className="mx-auto h-12 w-12 mb-4" />
           <p>No inventory items found.</p>
            <p className="text-sm mt-2">Add items using the 'Add New Item' button.</p>
         </div>
       )}
    </div>
  );
}

export const metadata = {
  title: 'Inventory | Showroom Manager',
  description: 'Browse and manage inventory items.',
};

// Ensure dynamic rendering because data is fetched on each request
export const dynamic = 'force-dynamic';
