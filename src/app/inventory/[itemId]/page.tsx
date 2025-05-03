
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import { ArrowLeft, Edit, Package, Truck, AlertTriangle, Home, Box, ChevronRight, Tag, Ruler, Weight, Clock, Info } from 'lucide-react'; // Added more icons
import Link from 'next/link';
import { db, doc, getDoc } from '@/lib/firebase/firebase'; // Import Firestore instance and functions
import type { AddItemInput } from '@/schemas/inventory'; // Import the type for structure
import { notFound } from 'next/navigation'; // Import notFound for handling missing items
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb" // Import Breadcrumb components


// Define the structure of an inventory item including its ID
interface InventoryItem extends AddItemInput {
  id: string;
  // Add placeholder related data structure - replace with actual relations later
  relatedOrders?: {id: string, date: string}[];
  relatedShipments?: {id: string, status: string}[];
}


// Function to fetch a single item's details from Firestore
async function getItemDetails(itemId: string): Promise<{ item: InventoryItem | null; error?: string }> {
  // Explicitly check if db is null, indicating initialization failure
  if (db === null) {
    const errorMessage = "Firestore database is not initialized. Cannot fetch item details. Please check Firebase configuration in .env.local and restart the server.";
    console.error(errorMessage);
    // Return a specific error message related to configuration/initialization
    return { item: null, error: "Database initialization failed. Please check configuration." };
  }

  try {
    console.log(`Attempting to fetch item details for ID: ${itemId}`);
    const itemDocRef = doc(db, 'inventory', itemId);
    const docSnap = await getDoc(itemDocRef);

    if (docSnap.exists()) {
       console.log("Item found in Firestore.");
       const data = docSnap.data() as AddItemInput;
       const itemData = {
           id: docSnap.id,
           ...data,
           // --- Placeholder Related Data ---
           // Example: Link item 'MOD-OAK-3680' to specific orders/shipments
           relatedOrders: data.sku === 'MOD-OAK-3680' ? [{id: 'ORD-001', date: '2024-07-20'}] : [],
           relatedShipments: data.sku === 'MOD-OAK-3680' ? [{id: 'SHP-103', status: 'Label Created'}] : [],
           // --- End Placeholder ---
       };
        return { item: itemData };
    } else {
      console.log("No such document found for item ID:", itemId);
      return { item: null }; // Item not found is not an error state here, handled by notFound() later
    }
  } catch (error) {
    const errorMessage = `Error fetching item details from Firestore for ID ${itemId}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    // Return generic error for actual database query errors
    return { item: null, error: "Failed to load item details due to a database error." };
  }
}

// Consistent Status Badge component
const StatusBadge = ({ status }: { status: string }) => {
  const getVariant = (): "default" | "secondary" | "outline" | "destructive" => {
      switch (status.toLowerCase()) {
          case 'processing':
          case 'in transit':
          case 'out for delivery':
          case 'label created':
              return 'default'; // Gold
          case 'shipped':
              return 'secondary'; // Blue/Green
          case 'delivered':
              return 'outline'; // Outline
          case 'cancelled':
          case 'exception':
          case 'refunded':
              return 'destructive'; // Red
          case 'paid':
              return 'outline';
          case 'pending':
              return 'secondary';
          default:
              return 'secondary';
      }
  };
  return <Badge variant={getVariant()}>{status}</Badge>;
};


export default async function InventoryItemPage({ params }: { params: { itemId: string } }) {
  const { item, error: fetchError } = await getItemDetails(params.itemId);
  const isLowStock = item ? item.stock < 10 : false;

  // Handle fetch error first
  if (fetchError) {
     return (
       <div className="container mx-auto py-6 space-y-6">
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
               <BreadcrumbPage>Error</BreadcrumbPage>
             </BreadcrumbItem>
           </BreadcrumbList>
         </Breadcrumb>
         <Alert variant="destructive">
           <AlertTriangle className="h-4 w-4" />
           <AlertTitle>Error Loading Item Details</AlertTitle>
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
       </div>
     );
  }

  // If no error but item is null, then it's not found
  if (!item) {
    notFound(); // Use Next.js notFound utility for 404 page
  }

  // If item exists and no error, render the page
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
               <BreadcrumbPage className="truncate max-w-xs">{item.name}</BreadcrumbPage> {/* Truncate long names */}
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
         {/* Add link to edit page later */}
         <Button size="sm" disabled>
           <Edit className="mr-2 h-4 w-4" />
           Edit Item (soon)
         </Button>
      </div>

      <Card className="overflow-hidden shadow-md">
         <div className="grid md:grid-cols-3 gap-0"> {/* Removed gap */}
           {/* Image Column */}
           <div className="md:col-span-1 bg-muted/40 p-4"> {/* Added background and padding */}
             <div className="relative aspect-square w-full rounded-lg overflow-hidden shadow-inner"> {/* Inner shadow */}
               <Image
                 src={item.imageUrl || `https://picsum.photos/seed/${item.id}/800/800`} // Larger fallback
                 alt={item.name}
                 layout="fill"
                 objectFit="cover"
                 data-ai-hint={item.imageHint || 'product image'}
               />
             </div>
           </div>

            {/* Details Column */}
           <div className="md:col-span-2 p-6 md:p-8"> {/* Increased padding */}
             <CardHeader className="p-0 mb-4">
               <CardTitle className="text-3xl lg:text-4xl font-bold mb-1">{item.name}</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                  <Badge variant="outline" className="mr-2">{item.style}</Badge>
                  <Badge variant="outline">{item.material}</Badge>
               </CardDescription>
             </CardHeader>

             <CardContent className="p-0 space-y-6"> {/* Increased spacing */}
                {/* Description */}
                {item.description && (
                    <div className="space-y-2">
                        <h3 className="text-md font-semibold flex items-center gap-2"><Info className="h-4 w-4 text-muted-foreground"/> Description</h3>
                        <p className="text-base leading-relaxed text-muted-foreground">{item.description}</p>
                         <Separator />
                    </div>
                )}


                {/* Key Details Section */}
                <div className="space-y-3">
                    <h3 className="text-md font-semibold flex items-center gap-2"><Box className="h-4 w-4 text-muted-foreground"/> Key Details</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-muted-foreground/70"/> <span className="font-medium">SKU:</span> {item.sku}</div>
                        <div className="flex items-center gap-2"><Ruler className="h-4 w-4 text-muted-foreground/70"/> <span className="font-medium">Dimensions:</span> {item.dimensions}</div>
                        <div className="flex items-center gap-2"><Weight className="h-4 w-4 text-muted-foreground/70"/> <span className="font-medium">Weight:</span> {item.weight || 'N/A'}</div>
                        <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground/70"/> <span className="font-medium">Lead Time:</span> {item.leadTime || 'N/A'}</div>
                         <div>
                            <span className="font-medium">Stock Level:</span>{' '}
                            <Badge variant={isLowStock ? "destructive" : "secondary"}>
                               {item.stock} units {isLowStock ? '(Low Stock)' : ''}
                            </Badge>
                        </div>
                        <div className="text-2xl font-bold text-primary col-span-2 mt-2">
                         Price: ${item.price?.toFixed(2) || 'N/A'}
                        </div>
                    </div>
                </div>


                <Separator />

                 {/* Related Orders & Shipments */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                   <div>
                     <h3 className="text-md font-semibold mb-3 flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground"/> Related Orders</h3>
                     {item.relatedOrders && item.relatedOrders.length > 0 ? (
                       <ul className="space-y-2 text-sm">
                         {item.relatedOrders.map(order => (
                           <li key={order.id} className="flex justify-between items-center p-2 rounded hover:bg-muted/50">
                              <Link href={`/orders/${order.id}`} className="text-primary hover:underline font-medium">{order.id}</Link>
                             <span className="text-xs text-muted-foreground">{order.date}</span>
                           </li>
                         ))}
                       </ul>
                     ) : (
                       <p className="text-sm text-muted-foreground italic">No related orders found.</p>
                     )}
                   </div>
                    <div>
                     <h3 className="text-md font-semibold mb-3 flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground"/> Related Shipments</h3>
                     {item.relatedShipments && item.relatedShipments.length > 0 ? (
                       <ul className="space-y-2 text-sm">
                         {item.relatedShipments.map(shipment => (
                           <li key={shipment.id} className="flex justify-between items-center p-2 rounded hover:bg-muted/50">
                              <Link href={`/logistics/${shipment.id}`} className="text-primary hover:underline font-medium">{shipment.id}</Link>
                             <StatusBadge status={shipment.status} />
                           </li>
                         ))}
                       </ul>
                     ) : (
                       <p className="text-sm text-muted-foreground italic">No related shipments found.</p>
                     )}
                   </div>
                 </div>

             </CardContent>
           </div>
         </div>
       </Card>

    </div>
  );
}

// Generate dynamic metadata
export async function generateMetadata({ params }: { params: { itemId: string } }) {
  const { item } = await getItemDetails(params.itemId); // Fetch item data for metadata
  return {
    title: item ? `${item.name} | Showroom Manager` : 'Item Not Found | Showroom Manager',
  };
}

// Ensure dynamic rendering because data is fetched on each request
export const dynamic = 'force-dynamic';
