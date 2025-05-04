
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from 'next/image';
import { ArrowLeft, Edit, Printer, Truck, Package, User, Calendar, Hash, DollarSign, Home, ChevronRight, AlertTriangle, PlusCircle } from 'lucide-react'; // Added icons
import Link from 'next/link';
import { db, doc, getDoc, Timestamp } from '@/lib/firebase/firebase'; // Import Firestore functions
import type { Order } from '@/schemas/order'; // Import Order type
import { notFound } from 'next/navigation'; // For 404
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import { format } from 'date-fns'; // For formatting dates
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"; // Import Breadcrumb
import { OrderStatusUpdater } from "@/components/orders/order-status-updater"; // Import the new component

// Function to fetch a single order's details from Firestore
async function getOrderDetails(orderId: string): Promise<{ order: Order | null; error?: string }> {
  if (!db) {
    const errorMessage = "Database configuration error. Unable to fetch order details.";
    console.error("Firestore database is not initialized. Cannot fetch order details.");
    return { order: null, error: "Database initialization failed. Please check configuration." };
  }

  try {
    console.log(`Attempting to fetch order details for ID: ${orderId}`);
    const orderDocRef = doc(db, 'orders', orderId);
    const docSnap = await getDoc(orderDocRef);

    if (docSnap.exists()) {
      console.log("Order found in Firestore.");
       // Type cast data, expecting it to conform to Order structure (now without imageHint in items)
       const data = docSnap.data() as Omit<Order, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: Timestamp, updatedAt?: Timestamp };

       // Convert Timestamps to ISO strings for serialization
       const createdAt = data.createdAt instanceof Timestamp
         ? data.createdAt.toDate().toISOString()
         : new Date().toISOString(); // Fallback
       const updatedAt = data.updatedAt instanceof Timestamp
         ? data.updatedAt.toDate().toISOString()
         : undefined;

      const orderData: Order = {
        id: docSnap.id,
        ...(data as Order), // Assume data matches Order structure after timestamp conversion
        createdAt,
        updatedAt,
         items: data.items?.map(item => ({ // Ensure items array exists and map to remove potential imageHint
             itemId: item.itemId,
             name: item.name,
             sku: item.sku,
             quantity: item.quantity,
             price: item.price,
             image: item.image || '',
             // imageHint is removed here explicitly if it somehow existed in DB
         })) || [],
         total: typeof data.total === 'number' ? data.total : 0,
      };
      return { order: orderData };
    } else {
      console.log("No such document found for order ID:", orderId);
      return { order: null }; // Not found is handled by notFound()
    }
  } catch (error) {
    const errorMessage = `Error fetching order details from Firestore for ID ${orderId}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return { order: null, error: "Failed to load order details due to a database error." };
  }
}

// Re-use status variant logic from the list page
const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
   switch (status?.toLowerCase()) {
    case 'processing':
    case 'pending payment':
      return 'default';
    case 'shipped':
      return 'secondary';
    case 'delivered':
      return 'outline';
    case 'cancelled':
    case 'failed': // Added failed payment
      return 'destructive';
    case 'paid':
        return 'outline';
    case 'pending': // Payment pending
        return 'secondary';
    case 'refunded':
        return 'destructive';
    default:
      return 'secondary';
  }
};

export default async function OrderDetailPage({ params }: { params: { orderId: string } }) {
  const { order, error: fetchError } = await getOrderDetails(params.orderId);

   // Handle fetch error first
   if (fetchError) {
      return (
        <div className="container mx-auto py-6 space-y-6">
          {/* Breadcrumbs for Error Page */}
         <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink asChild><Link href="/"><Home className="h-4 w-4"/></Link></BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbLink asChild><Link href="/orders">Orders</Link></BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Error</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Order Details</AlertTitle>
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

   // If no error but order is null, then it's not found
   if (!order) {
     notFound(); // Use Next.js notFound utility for 404 page
   }

   const displayTotal = order.total;

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-6">
       {/* Breadcrumbs */}
        <Breadcrumb>
           <BreadcrumbList>
             <BreadcrumbItem><BreadcrumbLink asChild><Link href="/"><Home className="h-4 w-4"/></Link></BreadcrumbLink></BreadcrumbItem>
             <BreadcrumbSeparator />
             <BreadcrumbItem><BreadcrumbLink asChild><Link href="/orders">Orders</Link></BreadcrumbLink></BreadcrumbItem>
             <BreadcrumbSeparator />
             <BreadcrumbItem><BreadcrumbPage>Order {order.id.substring(0, 8)}...</BreadcrumbPage></BreadcrumbItem>
           </BreadcrumbList>
         </Breadcrumb>

       <div className="flex items-center justify-between">
         <Button variant="outline" size="sm" asChild>
           <Link href="/orders">
             <ArrowLeft className="mr-2 h-4 w-4" />
             Back to Orders
           </Link>
         </Button>
         <div className="flex gap-2">
            {/* Disabled Print Button */}
            <Button variant="outline" size="sm" disabled>
              <Printer className="mr-2 h-4 w-4" />
              Print Invoice (soon)
            </Button>
            {/* Create Shipment Button (Placeholder) */}
             <Button variant="outline" size="sm" disabled>
               <PlusCircle className="mr-2 h-4 w-4" />
               Create Shipment (soon)
             </Button>
           {/* Enabled Edit Button */}
           <Button size="sm" asChild>
             <Link href={`/orders/${order.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Order
             </Link>
           </Button>
         </div>
       </div>

       <Card className="shadow-md">
          <CardHeader className="flex flex-row items-start justify-between pb-4 gap-4"> {/* Allow wrapping */}
             <div>
              <CardTitle className="text-2xl lg:text-3xl font-bold">Order #{order.id}</CardTitle>
              <CardDescription className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                 <Calendar className="h-4 w-4"/> Placed on {format(new Date(order.createdAt), 'PPP p')} {/* More detailed date */}
               </CardDescription>
                {order.updatedAt && order.updatedAt !== order.createdAt && (
                     <CardDescription className="flex items-center gap-2 text-xs text-muted-foreground/80 mt-1">
                      Last updated: {format(new Date(order.updatedAt), 'PP p')}
                    </CardDescription>
                )}
             </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6 grid md:grid-cols-3 gap-6">
             {/* Customer Info */}
            <div className="space-y-2">
               <h3 className="text-lg font-semibold flex items-center gap-2"><User className="h-5 w-5 text-muted-foreground" /> Customer Details</h3>
               <p className="text-sm font-medium">{order.customer.name}</p>
               {order.customer.email && <p className="text-sm text-muted-foreground">{order.customer.email}</p>}
               {order.customer.phone && <p className="text-sm text-muted-foreground">{order.customer.phone}</p>}
               <p className="text-sm text-muted-foreground">{order.customer.address}</p>
            </div>

             {/* Order Summary */}
             <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Hash className="h-5 w-5 text-muted-foreground" /> Order Summary</h3>
                 {/* Changed <p> to <div> to fix hydration error */}
                <div className="text-sm"><span className="text-muted-foreground">Payment Status:</span> <Badge variant={getStatusVariant(order.paymentStatus)}>{order.paymentStatus}</Badge></div>
                 <p className="text-sm"><span className="text-muted-foreground">Shipping Method:</span> {order.shippingMethod || 'N/A'}</p>
                 {order.shipmentId ? (
                     <p className="text-sm"><span className="text-muted-foreground">Shipment:</span> <Link href={`/logistics/${order.shipmentId}`} className="text-primary hover:underline flex items-center gap-1"><Truck className="h-4 w-4"/>{order.shipmentId.substring(0,8)}...</Link></p>
                 ) : (
                     <p className="text-sm italic text-muted-foreground">No shipment linked yet.</p>
                 )}
                 <p className="text-sm"><span className="text-muted-foreground">Total Items:</span> {order.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
             </div>

              {/* Totals */}
             <div className="space-y-2 md:text-right">
                 <h3 className="text-lg font-semibold flex items-center gap-2 md:justify-end"><DollarSign className="h-5 w-5 text-muted-foreground" /> Order Total</h3>
                 <p className="text-2xl font-bold text-primary">₹{displayTotal.toFixed(2)}</p>
                 <p className="text-xs text-muted-foreground md:text-right">(Includes items, shipping, taxes)</p>
             </div>
          </CardContent>
       </Card>

        {/* Order Status Updater Card */}
        <OrderStatusUpdater orderId={order.id} currentStatus={order.status} />

        <Card className="shadow-md">
         <CardHeader>
           <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-muted-foreground"/> Items Ordered</CardTitle>
         </CardHeader>
         <CardContent>
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead className="w-[80px]">Image</TableHead>
                 <TableHead>Product</TableHead>
                 <TableHead>SKU</TableHead>
                 <TableHead className="text-center">Quantity</TableHead>
                 <TableHead className="text-right">Unit Price</TableHead>
                 <TableHead className="text-right">Line Total</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {order.items.map((item, index) => ( // Use index for key if item IDs aren't unique within order
                 <TableRow key={`${item.itemId}-${index}`}>
                   <TableCell>
                     <Image
                        src={item.image || `https://picsum.photos/seed/${item.itemId}/100/100`}
                        alt={item.name}
                        width={64} height={64}
                        className="rounded-md aspect-square object-cover border"
                        // Use item name as fallback for data-ai-hint
                        data-ai-hint={item.name || 'product item'}
                      />
                   </TableCell>
                   <TableCell className="font-medium">
                      {/* Link to the actual inventory item */}
                      <Link href={`/inventory/${item.itemId}`} className="hover:underline" title={`View ${item.name}`}>
                        {item.name}
                      </Link>
                    </TableCell>
                   <TableCell>{item.sku}</TableCell>
                   <TableCell className="text-center">{item.quantity}</TableCell>
                   <TableCell className="text-right">₹{item.price.toFixed(2)}</TableCell>
                   <TableCell className="text-right font-medium">₹{(item.price * item.quantity).toFixed(2)}</TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
         </CardContent>
       </Card>

    </div>
  );
}

// Generate dynamic metadata
export async function generateMetadata({ params }: { params: { orderId: string } }) {
  const { order } = await getOrderDetails(params.orderId);
  return {
    title: order ? `Order #${order.id.substring(0,8)}... | Showroom Manager` : 'Order Not Found | Showroom Manager',
    description: order ? `Details for order placed by ${order.customer.name}.` : 'View order details.',
  };
}

// Ensure dynamic rendering because data is fetched on each request
export const dynamic = 'force-dynamic';
