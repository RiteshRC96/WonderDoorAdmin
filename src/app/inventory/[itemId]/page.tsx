
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import { ArrowLeft, Edit, Package, Truck } from 'lucide-react';
import Link from 'next/link';
import { db, doc, getDoc } from '@/lib/firebase/firebase'; // Import Firestore instance and functions
import type { AddItemInput } from '@/schemas/inventory'; // Import the type for structure
import { notFound } from 'next/navigation'; // Import notFound for handling missing items

// Define the structure of an inventory item including its ID
interface InventoryItem extends AddItemInput {
  id: string;
  // Add placeholder related data structure - replace with actual relations later
  relatedOrders?: {id: string, date: string}[];
  relatedShipments?: {id: string, status: string}[];
}


// Function to fetch a single item's details from Firestore
async function getItemDetails(itemId: string): Promise<InventoryItem | null> {
  if (!db) {
    console.error("Firestore database is not initialized. Cannot fetch item details.");
    return null;
  }

  try {
    const itemDocRef = doc(db, 'inventory', itemId);
    const docSnap = await getDoc(itemDocRef);

    if (docSnap.exists()) {
       // Combine document ID with document data
       // Add dummy related data for now - replace with real logic later
       const data = docSnap.data() as AddItemInput;
       return {
           id: docSnap.id,
           ...data,
           // --- Placeholder Related Data ---
           relatedOrders: data.sku === 'MOD-OAK-3680' ? [{id: 'ORD-001', date: '2024-07-20'}] : [],
           relatedShipments: data.sku === 'MOD-OAK-3680' ? [{id: 'SHP-103', status: 'Label Created'}] : [],
           // --- End Placeholder ---
       };
    } else {
      console.log("No such document!");
      return null; // Item not found
    }
  } catch (error) {
    console.error("Error fetching item details from Firestore:", error);
    return null; // Return null on error
  }
}

// Reusable Status Badge Component for Orders/Shipments (assuming kept from previous state)
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
              return 'destructive'; // Red
          default:
              return 'secondary';
      }
  };
  return <Badge variant={getVariant()}>{status}</Badge>;
};


export default async function InventoryItemPage({ params }: { params: { itemId: string } }) {
  const item = await getItemDetails(params.itemId);

  if (!item) {
    notFound(); // Use Next.js notFound utility for 404 page
  }

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in">
       <div className="mb-6 flex items-center justify-between">
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

      <Card className="overflow-hidden">
         <div className="grid md:grid-cols-3 gap-0">
           {/* Image Column */}
           <div className="md:col-span-1 p-4">
             <div className="relative aspect-square w-full rounded-lg overflow-hidden shadow-md">
               <Image
                 src={item.imageUrl || `https://picsum.photos/seed/${item.id}/600/400`} // Fallback image
                 alt={item.name}
                 layout="fill"
                 objectFit="cover"
                 data-ai-hint={item.imageHint || 'product image'}
               />
             </div>
           </div>

            {/* Details Column */}
           <div className="md:col-span-2 p-6">
             <CardHeader className="p-0 mb-4">
               <CardTitle className="text-3xl font-bold mb-1">{item.name}</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                 {item.style} / {item.material}
               </CardDescription>
             </CardHeader>

             <CardContent className="p-0 space-y-4">
                <p className="text-lg leading-relaxed">{item.description || "No description available."}</p>

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-sm">
                   <div><span className="font-medium text-muted-foreground">SKU:</span> {item.sku}</div>
                   <div><span className="font-medium text-muted-foreground">Dimensions:</span> {item.dimensions}</div>
                   <div><span className="font-medium text-muted-foreground">Weight:</span> {item.weight || 'N/A'}</div>
                   <div><span className="font-medium text-muted-foreground">Lead Time:</span> {item.leadTime || 'N/A'}</div>
                    <div>
                     <span className="font-medium text-muted-foreground">Stock Level:</span>{' '}
                     <span className={`font-semibold ${item.stock < 10 ? 'text-destructive' : 'text-foreground'}`}>
                       {item.stock} units
                     </span>
                   </div>
                    <div className="text-2xl font-bold text-primary col-span-2 mt-2">
                      ${item.price?.toFixed(2) || 'N/A'}
                    </div>
                </div>

                <Separator />

                 {/* Related Orders & Shipments (Using Placeholder Data) */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                   <div>
                     <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground"/> Related Orders</h3>
                     {item.relatedOrders && item.relatedOrders.length > 0 ? (
                       <ul className="space-y-1 text-sm">
                         {item.relatedOrders.map(order => (
                           <li key={order.id} className="flex justify-between items-center">
                              <Link href={`/orders/${order.id}`} className="text-primary hover:underline">{order.id}</Link>
                             <span className="text-muted-foreground">{order.date}</span>
                           </li>
                         ))}
                       </ul>
                     ) : (
                       <p className="text-sm text-muted-foreground">No related orders.</p>
                     )}
                   </div>
                    <div>
                     <h3 className="text-md font-semibold mb-2 flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground"/> Related Shipments</h3>
                     {item.relatedShipments && item.relatedShipments.length > 0 ? (
                       <ul className="space-y-1 text-sm">
                         {item.relatedShipments.map(shipment => (
                           <li key={shipment.id} className="flex justify-between items-center">
                              <Link href={`/logistics/${shipment.id}`} className="text-primary hover:underline">{shipment.id}</Link>
                             <StatusBadge status={shipment.status} />
                           </li>
                         ))}
                       </ul>
                     ) : (
                       <p className="text-sm text-muted-foreground">No related shipments.</p>
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
  const item = await getItemDetails(params.itemId);
  return {
    title: item ? `${item.name} | Showroom Manager` : 'Item Not Found | Showroom Manager',
  };
}

// Ensure dynamic rendering because data is fetched on each request
export const dynamic = 'force-dynamic';
