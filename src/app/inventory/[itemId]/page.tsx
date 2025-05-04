
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import { ArrowLeft, Edit, Package, Truck, AlertTriangle, Home, Box, ChevronRight, Tag, Ruler, Weight, Clock, Info } from 'lucide-react'; // Added more icons
import Link from 'next/link';
import { db, doc, getDoc, collection, query, where, getDocs, Timestamp } from '@/lib/firebase/firebase'; // Import Firestore instance and functions
import type { AddItemInput } from '@/schemas/inventory'; // Import the type for structure
import type { Order } from '@/schemas/order'; // Import order type
import type { Shipment } from '@/schemas/shipment'; // Import shipment type
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
import { format, formatDistanceToNow } from 'date-fns'; // For formatting dates

// Define the structure of an inventory item including its ID and related data
// Removed imageHint from AddItemInput Omit
interface InventoryItem extends Omit<AddItemInput, 'imageHint'> {
  id: string;
  createdAt?: string; // Keep serialized date
  updatedAt?: string; // Keep serialized date for last update
  relatedOrders?: { id: string; date: string; status: Order['status'] }[];
  relatedShipments?: { id: string; status: Shipment['status']; trackingNumber: string }[];
  imageUrl?: string; // Keep imageUrl explicit
  name: string; // Ensure required fields
  sku: string;
  style: string;
  material: string;
  dimensions: string;
  stock: number;
  price: number;
  // Removed imageHint property from interface
}


// Function to fetch a single item's details from Firestore
async function getItemDetails(itemId: string): Promise<{ item: InventoryItem | null; error?: string }> {
  if (!db) {
    const errorMessage = "Database initialization failed. Please check configuration.";
    console.error(errorMessage);
    return { item: null, error: errorMessage };
  }

  try {
    console.log(`Attempting to fetch item details for ID: ${itemId}`);
    const itemDocRef = doc(db, 'inventory', itemId);
    const docSnap = await getDoc(itemDocRef);

    if (!docSnap.exists()) {
      console.log("No such document found for item ID:", itemId);
      return { item: null };
    }

    console.log("Item found in Firestore.");
    // Cast data including optional imageUrl, exclude imageHint
    const data = docSnap.data() as Omit<AddItemInput, 'imageHint'> & { createdAt?: Timestamp, updatedAt?: Timestamp };


    // Convert Timestamps to ISO strings
    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined;
    const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined;

    // Exclude original timestamps before spreading
    const { createdAt: _, updatedAt: __, ...restData } = data;

    // --- Fetch Related Orders ---
    let relatedOrders: InventoryItem['relatedOrders'] = [];
    try {
        const ordersRef = collection(db, 'orders');
        console.warn("Fetching all orders to find related ones - this is not scalable for production.");
        const ordersSnapshot = await getDocs(collection(db, 'orders'));
        ordersSnapshot.forEach(orderDoc => {
            const orderData = orderDoc.data() as Order;
            if (orderData.items?.some(item => item.itemId === itemId)) {
                relatedOrders.push({
                    id: orderDoc.id,
                    date: orderData.createdAt ? format(new Date(orderData.createdAt), 'PP') : 'N/A',
                    status: orderData.status,
                });
            }
        });
         console.log(`Found ${relatedOrders.length} related orders for item ${itemId}.`);

    } catch (orderError) {
        console.error(`Error fetching related orders for item ${itemId}:`, orderError);
    }

     // --- Fetch Related Shipments ---
     let relatedShipments: InventoryItem['relatedShipments'] = [];
     if (relatedOrders.length > 0) {
        const relatedOrderIds = relatedOrders.map(o => o.id);
        try {
            const shipmentsRef = collection(db, 'shipments');
            if (relatedOrderIds.length > 0 && relatedOrderIds.length <= 30) {
               const qShipments = query(shipmentsRef, where('orderId', 'in', relatedOrderIds));
               const shipmentsSnapshot = await getDocs(qShipments);
               shipmentsSnapshot.forEach(shipmentDoc => {
                 const shipmentData = shipmentDoc.data() as Shipment;
                 relatedShipments.push({
                   id: shipmentDoc.id,
                   status: shipmentData.status,
                   trackingNumber: shipmentData.trackingNumber,
                 });
               });
               console.log(`Found ${relatedShipments.length} related shipments for item ${itemId}.`);
            } else if (relatedOrderIds.length > 30) {
                console.warn(`Too many related orders (${relatedOrderIds.length}) to query shipments efficiently with 'in' operator.`);
            }
        } catch (shipmentError) {
             console.error(`Error fetching related shipments for item ${itemId}:`, shipmentError);
        }
     }


    const itemData: InventoryItem = {
      id: docSnap.id,
      ...(restData as Omit<AddItemInput, 'imageHint'>), // Cast restData appropriately, ensure imageHint is omitted
      imageUrl: data.imageUrl, // Keep imageUrl
      createdAt,
      updatedAt, // Add updatedAt here
      relatedOrders,
      relatedShipments,
    };

    return { item: itemData };

  } catch (error) {
    const errorMessage = `Error fetching item details from Firestore for ID ${itemId}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return { item: null, error: "Failed to load item details due to a database error." };
  }
}

// Consistent Status Badge component
const StatusBadge = ({ status }: { status: string }) => {
   const getVariant = (): "default" | "secondary" | "outline" | "destructive" => {
     switch (status?.toLowerCase()) {
       // Order Statuses
       case 'processing':
       case 'pending payment':
         return 'default';
       case 'shipped':
         return 'secondary';
       case 'delivered':
       case 'paid':
         return 'outline';
       case 'cancelled':
       case 'refunded':
       case 'failed':
         return 'destructive';
       // Shipment Statuses
       case 'label created':
       case 'pending':
         return 'secondary';
       case 'picked up':
       case 'in transit':
       case 'out for delivery':
         return 'default';
       case 'exception':
       case 'delayed':
         return 'destructive';
       default:
         return 'secondary';
     }
   };
   return <Badge variant={getVariant()} className="capitalize">{status || 'Unknown'}</Badge>;
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
             <BreadcrumbItem><BreadcrumbLink asChild><Link href="/"><Home className="h-4 w-4"/></Link></BreadcrumbLink></BreadcrumbItem>
             <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbLink asChild><Link href="/inventory">Inventory</Link></BreadcrumbLink></BreadcrumbItem>
             <BreadcrumbSeparator />
             <BreadcrumbItem><BreadcrumbPage>Error</BreadcrumbPage></BreadcrumbItem>
           </BreadcrumbList>
         </Breadcrumb>
         <Alert variant="destructive">
           <AlertTriangle className="h-4 w-4" />
           <AlertTitle>Error Loading Item Details</AlertTitle>
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
    notFound(); // Use Next.js notFound utility for 404 page
  }

  // If item exists and no error, render the page
  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumb>
           <BreadcrumbList>
             <BreadcrumbItem><BreadcrumbLink asChild><Link href="/"><Home className="h-4 w-4"/></Link></BreadcrumbLink></BreadcrumbItem>
             <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbLink asChild><Link href="/inventory">Inventory</Link></BreadcrumbLink></BreadcrumbItem>
             <BreadcrumbSeparator />
             <BreadcrumbItem><BreadcrumbPage className="truncate max-w-xs">{item.name}</BreadcrumbPage></BreadcrumbItem>
           </BreadcrumbList>
         </Breadcrumb>

       {/* Back Button & Edit Button */}
       <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" asChild>
          <Link href="/inventory">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Inventory
          </Link>
        </Button>
         {/* Enable Edit Button and link to edit page */}
         <Button size="sm" asChild>
           <Link href={`/inventory/${item.id}/edit`}>
             <Edit className="mr-2 h-4 w-4" />
             Edit Item
           </Link>
         </Button>
      </div>

      <Card className="overflow-hidden shadow-md">
         <div className="grid md:grid-cols-3 gap-0">
           {/* Image Column */}
           <div className="md:col-span-1 bg-muted/40 p-4 flex items-center justify-center">
             <div className="relative aspect-square w-full max-w-md rounded-lg overflow-hidden shadow-inner">
               <Image
                 src={item.imageUrl || `https://picsum.photos/seed/${item.id}/800/800`}
                 alt={item.name}
                 layout="fill"
                 objectFit="cover"
                 // Use item name or style as fallback hint if imageHint was removed/absent
                 data-ai-hint={item.name || item.style || 'product image'}
                 className="bg-white"
               />
             </div>
           </div>

            {/* Details Column */}
           <div className="md:col-span-2 p-6 md:p-8">
             <CardHeader className="p-0 mb-4">
               <CardTitle className="text-3xl lg:text-4xl font-bold mb-1">{item.name}</CardTitle>
                <CardDescription className="text-lg text-muted-foreground space-x-2">
                  <Badge variant="secondary">{item.style}</Badge>
                  <Badge variant="secondary">{item.material}</Badge>
                </CardDescription>
             </CardHeader>

             <CardContent className="p-0 space-y-6">
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
                         <div className="flex items-center gap-2">
                             <span className="font-medium">Stock Level:</span>
                            <Badge variant={isLowStock ? "destructive" : "secondary"}>
                               {item.stock} units {isLowStock ? '(Low Stock)' : ''}
                            </Badge>
                        </div>
                        <div className="text-2xl font-bold text-primary col-span-2 mt-2 flex items-baseline gap-2">
                         <span>Price:</span> <span>₹{item.price?.toFixed(2) || 'N/A'}</span>
                        </div>
                    </div>
                     {/* Timestamps */}
                     <div className="text-xs text-muted-foreground pt-2 space-y-1">
                         {item.createdAt && (
                             <p>Added: {format(new Date(item.createdAt), 'PP p')}</p>
                         )}
                         {item.updatedAt && item.updatedAt !== item.createdAt && ( // Show updated only if different from created
                            <p>Last updated: {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}</p>
                         )}
                     </div>
                </div>

                <Separator />

                 {/* Related Orders & Shipments */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                   <div>
                     <h3 className="text-md font-semibold mb-3 flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground"/> Related Orders</h3>
                     {item.relatedOrders && item.relatedOrders.length > 0 ? (
                       <ul className="space-y-2 text-sm max-h-48 overflow-y-auto pr-2">
                         {item.relatedOrders.map(order => (
                           <li key={order.id} className="flex justify-between items-center p-2 rounded hover:bg-muted/50">
                               <div className="flex flex-col">
                                   <Link href={`/orders/${order.id}`} className="text-primary hover:underline font-medium">{order.id.substring(0, 8)}...</Link>
                                   <span className="text-xs text-muted-foreground">{order.date}</span>
                               </div>
                               <StatusBadge status={order.status} />
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
                       <ul className="space-y-2 text-sm max-h-48 overflow-y-auto pr-2">
                         {item.relatedShipments.map(shipment => (
                           <li key={shipment.id} className="flex justify-between items-center p-2 rounded hover:bg-muted/50">
                               <div className="flex flex-col">
                                   <Link href={`/logistics/${shipment.id}`} className="text-primary hover:underline font-medium">{shipment.id.substring(0, 8)}...</Link>
                                   <span className="text-xs text-muted-foreground truncate" title={shipment.trackingNumber}>Track: {shipment.trackingNumber.substring(0,10)}...</span>
                               </div>
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
    description: item ? `Details for inventory item ${item.name}. SKU: ${item.sku}.` : 'Inventory item details.',
  };
}

// Ensure dynamic rendering because data is fetched on each request
export const dynamic = 'force-dynamic';
