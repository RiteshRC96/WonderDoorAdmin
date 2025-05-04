
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from 'next/image';
import { ArrowLeft, Edit, Printer, Truck, Package, User, Calendar, Hash, DollarSign, Home, ChevronRight, AlertTriangle, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { db, doc, getDoc, Timestamp } from '@/lib/firebase/firebase';
import type { Order, OrderItemSchema, ShippingInfoSchema, PaymentInfoSchema, TrackingInfoSchema } from '@/schemas/order'; // Import updated Order type
import { notFound } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from 'date-fns';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { OrderStatusUpdater } from "@/components/orders/order-status-updater"; // Assuming this component needs updates too

// Function to fetch a single order's details from Firestore (new structure)
async function getOrderDetails(orderId: string): Promise<{ order: Order | null; error?: string }> {
  if (!db) {
    const errorMessage = "Database configuration error. Unable to fetch order details.";
    console.error("Firestore database is not initialized.");
    return { order: null, error: "Database initialization failed. Please check configuration." };
  }

  try {
    console.log(`Attempting to fetch order details for ID: ${orderId}`);
    const orderDocRef = doc(db, 'orders', orderId);
    const docSnap = await getDoc(orderDocRef);

    if (docSnap.exists()) {
      console.log("Order found in Firestore.");
      const data = docSnap.data();

        // Map Firestore data to the Order interface
        const orderData: Order = {
            id: docSnap.id,
            items: (data.items || []).map((item: any) => ({ // Map items explicitly
                 cartItemId: item.cartItemId,
                 doorId: item.doorId,
                 name: item.name,
                 sku: item.sku,
                 quantity: item.quantity,
                 finalPrice: item.finalPrice,
                 imageUrl: item.imageUrl,
                 customizations: item.customizations,
            })),
            // Convert Firestore Timestamp to ISO string
            orderDate: data.orderDate instanceof Timestamp ? data.orderDate.toDate().toISOString() : new Date().toISOString(), // Fallback
            paymentInfo: data.paymentInfo as z.infer<typeof PaymentInfoSchema>,
            shippingInfo: data.shippingInfo as z.infer<typeof ShippingInfoSchema>,
            status: data.status as string,
            totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
            trackingInfo: data.trackingInfo as z.infer<typeof TrackingInfoSchema> | undefined,
            userId: data.userId as string,
             // --- Compatibility mappings ---
             createdAt: data.orderDate instanceof Timestamp ? data.orderDate.toDate().toISOString() : new Date().toISOString(),
             total: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
             customer: { // Map from shippingInfo
                 name: data.shippingInfo?.name || 'N/A',
                 email: data.shippingInfo?.email,
                 phone: data.shippingInfo?.phone,
                 address: data.shippingInfo?.address || 'N/A',
             },
             paymentStatus: data.paymentInfo?.paymentMethod || data.status,
             shipmentId: data.trackingInfo?.trackingNumber, // Use tracking number
        };

      return { order: orderData };
    } else {
      console.log("No such document found for order ID:", orderId);
      return { order: null };
    }
  } catch (error) {
    const errorMessage = `Error fetching order details from Firestore for ID ${orderId}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return { order: null, error: "Failed to load order details due to a database error." };
  }
}

// Reuse status variant logic - adjust as needed for new statuses
const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (status?.toLowerCase()) {
     case 'processing':
     case 'shipment information received':
       return 'default';
     case 'shipped':
     case 'in transit':
       return 'secondary';
     case 'delivered':
     case 'paid': // Assuming 'Paid' aligns with completed states
       return 'outline';
     case 'cancelled':
     case 'failed':
     case 'refunded':
       return 'destructive';
     case 'pending payment':
     case 'cod': // If COD is treated as pending/secondary
       return 'secondary';
     default:
       return 'secondary';
   }
 };

export default async function OrderDetailPage({ params }: { params: { orderId: string } }) {
  const { order, error: fetchError } = await getOrderDetails(params.orderId);

   if (fetchError) {
      return (
        <div className="container mx-auto py-6 space-y-6">
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

   if (!order) {
     notFound();
   }

   const displayTotal = order.totalAmount;

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-6">
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
            <Button variant="outline" size="sm" disabled>
              <Printer className="mr-2 h-4 w-4" />
              Print Invoice (soon)
            </Button>
            {/* Link to edit page (assuming it needs update for new structure) */}
           <Button size="sm" asChild disabled>
             <Link href={`/orders/${order.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Order (soon)
             </Link>
           </Button>
         </div>
       </div>

       <Card className="shadow-md">
          <CardHeader className="flex flex-row items-start justify-between pb-4 gap-4">
             <div>
              <CardTitle className="text-2xl lg:text-3xl font-bold">Order #{order.id}</CardTitle>
              <CardDescription className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                 <Calendar className="h-4 w-4"/> Placed on {format(new Date(order.orderDate), 'PPP p')}
               </CardDescription>
                {/* Add updatedAt if available in your data */}
                {/* {order.updatedAt && order.updatedAt !== order.createdAt && (
                     <CardDescription className="flex items-center gap-2 text-xs text-muted-foreground/80 mt-1">
                      Last updated: {format(new Date(order.updatedAt), 'PP p')}
                    </CardDescription>
                )} */}
             </div>
             {/* Display Main Status */}
             <div>
                 <Badge variant={getStatusVariant(order.status)} className="text-lg px-3 py-1 whitespace-nowrap shrink-0">
                     {order.status}
                 </Badge>
             </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6 grid md:grid-cols-3 gap-6">
             {/* Customer/Shipping Info */}
            <div className="space-y-2">
               <h3 className="text-lg font-semibold flex items-center gap-2"><User className="h-5 w-5 text-muted-foreground" /> Shipping Details</h3>
               <p className="text-sm font-medium">{order.shippingInfo.name}</p>
               {order.shippingInfo.email && <p className="text-sm text-muted-foreground">{order.shippingInfo.email}</p>}
               {order.shippingInfo.phone && <p className="text-sm text-muted-foreground">{order.shippingInfo.phone}</p>}
               <p className="text-sm text-muted-foreground">{order.shippingInfo.address}</p>
               <p className="text-sm text-muted-foreground">{order.shippingInfo.city}, {order.shippingInfo.state} {order.shippingInfo.zipCode}</p>
            </div>

             {/* Order Summary */}
             <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Hash className="h-5 w-5 text-muted-foreground" /> Order Summary</h3>
                 {/* Payment Info */}
                 <div className="text-sm"><span className="text-muted-foreground">Payment Method:</span> <Badge variant={getStatusVariant(order.paymentInfo.paymentMethod)}>{order.paymentInfo.paymentMethod}</Badge></div>
                 {/* Tracking Info */}
                 {order.trackingInfo?.trackingNumber ? (
                    <>
                        <p className="text-sm"><span className="text-muted-foreground">Carrier:</span> {order.trackingInfo.carrier || 'N/A'}</p>
                        <p className="text-sm"><span className="text-muted-foreground">Tracking #:</span>
                           {/* Add link to logistics page if applicable, might need Shipment ID */}
                            <span className="ml-1">{order.trackingInfo.trackingNumber}</span>
                            {/* <Link href={`/logistics/${order.trackingInfo.trackingNumber}`} className="text-primary hover:underline flex items-center gap-1">
                                <Truck className="h-4 w-4"/>{order.trackingInfo.trackingNumber}
                            </Link> */}
                        </p>
                         <p className="text-sm"><span className="text-muted-foreground">Shipment Status:</span> <Badge variant={getStatusVariant(order.trackingInfo.status || 'N/A')}>{order.trackingInfo.status || 'N/A'}</Badge></p>
                    </>
                 ) : (
                     <p className="text-sm italic text-muted-foreground">No shipment information available yet.</p>
                 )}
                 <p className="text-sm"><span className="text-muted-foreground">Total Items:</span> {order.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
                 <p className="text-sm"><span className="text-muted-foreground">User ID:</span> {order.userId.substring(0, 10)}...</p>
             </div>

              {/* Totals */}
             <div className="space-y-2 md:text-right">
                 <h3 className="text-lg font-semibold flex items-center gap-2 md:justify-end"><DollarSign className="h-5 w-5 text-muted-foreground" /> Order Total</h3>
                 <p className="text-2xl font-bold text-primary">₹{displayTotal.toFixed(2)}</p>
                 <p className="text-xs text-muted-foreground md:text-right">(Includes items, shipping, taxes)</p>
             </div>
          </CardContent>
       </Card>

        {/* Order Status Updater Card - Needs update to handle new status logic */}
        {/* <OrderStatusUpdater orderId={order.id} currentStatus={order.status} /> */}
        <Card>
             <CardHeader><CardTitle>Status Management (Placeholder)</CardTitle></CardHeader>
             <CardContent><p className="text-muted-foreground italic">Order status update component needs refinement for the new data structure.</p></CardContent>
        </Card>


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
               {order.items.map((item) => (
                 <TableRow key={item.cartItemId}> {/* Use cartItemId as key */}
                   <TableCell>
                     <Image
                        src={item.imageUrl || `https://picsum.photos/seed/${item.doorId}/100/100`} // Use doorId for placeholder seed
                        alt={item.name}
                        width={64} height={64}
                        className="rounded-md aspect-square object-cover border"
                        data-ai-hint={item.name || 'product item'}
                      />
                   </TableCell>
                   <TableCell className="font-medium">
                      {/* Link to the inventory item using doorId */}
                      <Link href={`/inventory/${item.doorId}`} className="hover:underline" title={`View ${item.name}`}>
                        {item.name}
                      </Link>
                      {/* Display customizations if they exist */}
                       {item.customizations && (
                           <div className="text-xs text-muted-foreground mt-1">
                               {item.customizations.material && <span>Mat: {item.customizations.material}</span>}
                               {item.customizations.size && <span> | Size: {item.customizations.size.width}x{item.customizations.size.height}</span>}
                           </div>
                       )}
                    </TableCell>
                   <TableCell>{item.sku}</TableCell>
                   <TableCell className="text-center">{item.quantity}</TableCell>
                   <TableCell className="text-right">₹{item.finalPrice.toFixed(2)}</TableCell>
                   <TableCell className="text-right font-medium">₹{(item.finalPrice * item.quantity).toFixed(2)}</TableCell>
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
    description: order ? `Details for order placed by ${order.shippingInfo.name}.` : 'View order details.',
  };
}

// Ensure dynamic rendering because data is fetched on each request
export const dynamic = 'force-dynamic';
