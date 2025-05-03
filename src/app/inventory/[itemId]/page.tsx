import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import { ArrowLeft, Edit, Package, Truck } from 'lucide-react';
import Link from 'next/link';

// Placeholder data fetching function - replace with actual data logic
async function getItemDetails(itemId: string) {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay

  // --- IMPORTANT NOTE ---
  // This items array is static placeholder data used to simulate fetching item details.
  // In a real application, this data would come from a database.
  // The item added via the form won't be found here unless its ID matches one below.
  // --- END NOTE ---
  const items = [
    { id: "1", name: "Modern Oak Door", style: "Modern", material: "Oak", dimensions: "36x80", stock: 15, price: 450, image: "https://picsum.photos/seed/1/600/400", hint: "modern oak door", description: "A sleek and sturdy modern oak door, perfect for contemporary homes. Features clean lines and a natural finish.", sku: "MOD-OAK-3680", weight: "55 lbs", leadTime: "2 weeks", relatedOrders: [{id: 'ORD-001', date: '2024-07-20'}, {id: 'ORD-007', date: '2024-07-21'}], relatedShipments: [{id: 'SHP-103', status: 'Label Created'}]},
    { id: "2", name: "Classic Walnut Panel", style: "Classic", material: "Walnut", dimensions: "32x80", stock: 8, price: 620, image: "https://picsum.photos/seed/2/600/400", hint: "classic walnut door", description: "Elegant classic door with raised panels, crafted from rich walnut wood. Adds timeless sophistication.", sku: "CLS-WAL-3280", weight: "65 lbs", leadTime: "3 weeks", relatedOrders: [{id: 'ORD-002', date: '2024-07-19'}], relatedShipments: [{id: 'SHP-101', status: 'In Transit'}]},
    { id: "3", name: "Minimalist Pine Door", style: "Minimalist", material: "Pine", dimensions: "30x78", stock: 22, price: 300, image: "https://picsum.photos/seed/3/600/400", hint: "minimalist pine door", description: "Simple yet stylish pine door with a smooth surface, ideal for minimalist interiors. Ready for paint or stain.", sku: "MIN-PIN-3078", weight: "40 lbs", leadTime: "1 week", relatedOrders: [], relatedShipments: []},
    { id: "4", name: "Mid-Century Sofa", style: "Mid-Century", material: "Fabric", dimensions: "84x35x32", stock: 5, price: 1200, image: "https://picsum.photos/seed/4/600/400", hint: "mid century sofa", description: "Iconic mid-century modern sofa with tapered legs and comfortable upholstery. A statement piece.", sku: "SOF-MCM-FAB-84", weight: "150 lbs", leadTime: "4 weeks", relatedOrders: [{id: 'ORD-004', date: '2024-07-17'}], relatedShipments: [{id: 'SHP-102', status: 'Out for Delivery'}]},
    { id: "5", name: "Industrial Coffee Table", style: "Industrial", material: "Metal, Wood", dimensions: "48x24x18", stock: 12, price: 350, image: "https://picsum.photos/seed/5/600/400", hint: "industrial coffee table", description: "Robust industrial-style coffee table featuring a solid wood top and sturdy metal frame.", sku: "TBL-IND-MW-48", weight: "70 lbs", leadTime: "2 weeks", relatedOrders: [{id: 'ORD-003', date: '2024-07-18'}], relatedShipments: [{id: 'SHP-104', status: 'Delivered'}]},
    // Removed static placeholder: { id: "ITEM-XYZ123", name: "Newly Added Item", style: "Test Style", material: "Test Material", dimensions: "1x1", stock: 10, price: 99.99, image: "https://picsum.photos/600/400", hint: "test item", description: "This is a test item added via the form.", sku: "TEST-SKU-001", weight: "10 lbs", leadTime: "1 week", relatedOrders: [], relatedShipments: [] },
  ];
  return items.find(item => item.id === itemId || item.sku === itemId.toUpperCase()); // Allow lookup by SKU as well potentially
}

// Reusable Status Badge Component for Orders/Shipments
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
    // Consider redirecting or showing a more specific not found component
     // redirect('/inventory?error=notfound'); // Example redirect
    return <div className="container mx-auto py-6 text-center text-destructive">Item not found (ID/SKU: {params.itemId}). <Link href="/inventory" className="underline">Return to Inventory</Link></div>;
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
         <Button size="sm">
           <Edit className="mr-2 h-4 w-4" />
           Edit Item
         </Button>
      </div>

      <Card className="overflow-hidden">
         <div className="grid md:grid-cols-3 gap-0">
           {/* Image Column */}
           <div className="md:col-span-1 p-4">
             <div className="relative aspect-square w-full rounded-lg overflow-hidden shadow-md">
               <Image
                 src={item.image || `https://picsum.photos/seed/${item.id}/600/400`} // Fallback image using consistent seed
                 alt={item.name}
                 layout="fill"
                 objectFit="cover"
                 data-ai-hint={item.hint || 'product image'} // Fallback hint
               />
             </div>
           </div>

            {/* Details Column */}
           <div className="md:col-span-2 p-6">
             <CardHeader className="p-0 mb-4">
               <CardTitle className="text-3xl font-bold mb-1">{item.name}</CardTitle>
                {/* Use CardDescription component correctly */}
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
                      ${item.price.toFixed(2)}
                    </div>
                </div>

                <Separator />

                 {/* Related Orders & Shipments */}
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

// Optional: Add dynamic metadata generation
export async function generateMetadata({ params }: { params: { itemId: string } }) {
  const item = await getItemDetails(params.itemId);
  return {
    title: item ? `${item.name} | Showroom Manager` : 'Item Details | Showroom Manager',
  };
}
