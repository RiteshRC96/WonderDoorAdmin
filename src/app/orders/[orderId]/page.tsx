import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from 'next/image';
import { ArrowLeft, Edit, Printer, Truck, Package, User, Calendar, Hash, DollarSign } from 'lucide-react';
import Link from 'next/link';

// Placeholder data fetching function - replace with actual data logic
async function getOrderDetails(orderId: string) {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 50));
  const orders = [
     {
      id: 'ORD-001', customer: { name: 'Alice Smith', email: 'alice.s@example.com', phone: '555-1234', address: '789 Pine Ln, Anytown, USA 12345'}, date: '2024-07-20', total: 450.00, status: 'Processing', items: [
        { id: 1, name: "Modern Oak Door", sku: "MOD-OAK-3680", quantity: 1, price: 450.00, image: "https://picsum.photos/100/100", hint: "modern door" }
      ], paymentStatus: 'Paid', shippingMethod: 'Standard Ground', shipmentId: 'SHP-103'
    },
    {
      id: 'ORD-002', customer: { name: 'Bob Johnson', email: 'b.johnson@example.com', phone: '555-5678', address: '123 Main St, Sometown, USA 67890' }, date: '2024-07-19', total: 1200.00, status: 'Shipped', items: [
        { id: 4, name: "Mid-Century Sofa", sku: "SOF-MCM-FAB-84", quantity: 1, price: 1200.00, image: "https://picsum.photos/100/100", hint: "retro sofa" }
      ], paymentStatus: 'Paid', shippingMethod: 'Freight', shipmentId: 'SHP-101'
    },
     {
      id: 'ORD-003', customer: { name: 'Charlie Brown', email: 'charlie@example.com', phone: '555-9012', address: '101 Maple Dr, Villagetown, USA 11223' }, date: '2024-07-18', total: 350.00, status: 'Delivered', items: [
        { id: 5, name: "Industrial Coffee Table", sku: "TBL-IND-MW-48", quantity: 1, price: 350.00, image: "https://picsum.photos/100/100", hint: "metal table" }
      ], paymentStatus: 'Paid', shippingMethod: 'Local Delivery', shipmentId: 'SHP-104'
    },
     {
      id: 'ORD-004', customer: { name: 'Diana Prince', email: 'diana.p@example.com', phone: '555-3456', address: '456 Oak Ave, Cityville, USA 44556' }, date: '2024-07-17', total: 620.00, status: 'Processing', items: [
        { id: 2, name: "Classic Walnut Panel", sku: "CLS-WAL-3280", quantity: 1, price: 620.00, image: "https://picsum.photos/100/100", hint: "classic door" }
      ], paymentStatus: 'Pending', shippingMethod: 'Standard Ground', shipmentId: 'SHP-102'
    },
     {
      id: 'ORD-005', customer: { name: 'Ethan Hunt', email: 'ethan.h@example.com', phone: '555-7890', address: 'Secret Location' }, date: '2024-07-16', total: 750.00, status: 'Cancelled', items: [
        { id: 3, name: "Minimalist Pine Door", sku: "MIN-PIN-3078", quantity: 1, price: 300.00, image: "https://picsum.photos/100/100", hint: "pine door" },
        { id: 1, name: "Modern Oak Door", sku: "MOD-OAK-3680", quantity: 1, price: 450.00, image: "https://picsum.photos/100/100", hint: "oak door" }
      ], paymentStatus: 'Refunded', shippingMethod: 'N/A', shipmentId: null
    },
  ];
  return orders.find(order => order.id === orderId);
}

const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  switch (status.toLowerCase()) {
    case 'processing':
      return 'default'; // Gold
    case 'shipped':
      return 'secondary'; // Blue/Green
    case 'delivered':
      return 'outline'; // Outline
    case 'cancelled':
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

export default async function OrderDetailPage({ params }: { params: { orderId: string } }) {
  const order = await getOrderDetails(params.orderId);

  if (!order) {
    return <div className="container mx-auto py-6 text-center text-destructive">Order not found.</div>;
  }

  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // Assuming flat $50 shipping and 7% tax for demonstration
  const shippingCost = order.status !== 'Cancelled' ? 50.00 : 0;
  const tax = order.status !== 'Cancelled' ? subtotal * 0.07 : 0;
  const total = subtotal + shippingCost + tax;

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-6">
       <div className="flex items-center justify-between">
         <Button variant="outline" size="sm" asChild>
           <Link href="/orders">
             <ArrowLeft className="mr-2 h-4 w-4" />
             Back to Orders
           </Link>
         </Button>
         <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" />
              Print Invoice
            </Button>
           <Button size="sm">
             <Edit className="mr-2 h-4 w-4" />
             Edit Order
           </Button>
         </div>
       </div>

       <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
             <div>
              <CardTitle className="text-2xl font-bold">Order {order.id}</CardTitle>
              <CardDescription className="flex items-center gap-2 text-sm text-muted-foreground">
                 <Calendar className="h-4 w-4"/> Placed on {order.date}
               </CardDescription>
             </div>
              <Badge variant={getStatusVariant(order.status)} className="text-lg px-4 py-1">{order.status}</Badge>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6 grid md:grid-cols-3 gap-6">
             {/* Customer Info */}
            <div className="space-y-2">
               <h3 className="text-lg font-semibold flex items-center gap-2"><User className="h-5 w-5 text-muted-foreground" /> Customer Details</h3>
               <p className="text-sm font-medium">{order.customer.name}</p>
               <p className="text-sm text-muted-foreground">{order.customer.email}</p>
               <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
               <p className="text-sm text-muted-foreground">{order.customer.address}</p>
            </div>

             {/* Order Summary */}
             <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Hash className="h-5 w-5 text-muted-foreground" /> Order Summary</h3>
                <p className="text-sm"><span className="text-muted-foreground">Payment Status:</span> <Badge variant={getStatusVariant(order.paymentStatus)}>{order.paymentStatus}</Badge></p>
                 <p className="text-sm"><span className="text-muted-foreground">Shipping Method:</span> {order.shippingMethod}</p>
                 {order.shipmentId && (
                    <p className="text-sm"><span className="text-muted-foreground">Shipment:</span> <Link href={`/logistics/${order.shipmentId}`} className="text-primary hover:underline flex items-center gap-1"><Truck className="h-4 w-4"/>{order.shipmentId}</Link></p>
                 )}
                 <p className="text-sm"><span className="text-muted-foreground">Total Items:</span> {order.items.length}</p>
             </div>

              {/* Totals */}
             <div className="space-y-2 md:text-right">
                 <h3 className="text-lg font-semibold flex items-center gap-2 md:justify-end"><DollarSign className="h-5 w-5 text-muted-foreground" /> Totals</h3>
                 <p className="text-sm"><span className="text-muted-foreground">Subtotal:</span> ${subtotal.toFixed(2)}</p>
                 <p className="text-sm"><span className="text-muted-foreground">Shipping:</span> ${shippingCost.toFixed(2)}</p>
                 <p className="text-sm"><span className="text-muted-foreground">Tax (7%):</span> ${tax.toFixed(2)}</p>
                 <Separator className="my-1"/>
                 <p className="text-lg font-bold"><span className="text-muted-foreground">Total:</span> ${total.toFixed(2)}</p>
             </div>
          </CardContent>
       </Card>

        <Card>
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
                 <TableHead className="text-right">Price</TableHead>
                 <TableHead className="text-right">Line Total</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {order.items.map((item) => (
                 <TableRow key={item.id}>
                   <TableCell>
                     <Image src={item.image} alt={item.name} width={64} height={64} className="rounded-md aspect-square object-cover" data-ai-hint={item.hint} />
                   </TableCell>
                   <TableCell className="font-medium">
                      <Link href={`/inventory/${item.id}`} className="hover:underline">{item.name}</Link>
                    </TableCell>
                   <TableCell>{item.sku}</TableCell>
                   <TableCell className="text-center">{item.quantity}</TableCell>
                   <TableCell className="text-right">${item.price.toFixed(2)}</TableCell>
                   <TableCell className="text-right">${(item.price * item.quantity).toFixed(2)}</TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
         </CardContent>
       </Card>

       {/* Potential Future Section: Order History/Timeline */}
       {/* <Card>
          <CardHeader><CardTitle>Order Timeline</CardTitle></CardHeader>
          <CardContent>
             <p className="text-muted-foreground">Order status updates and history will appear here.</p>
          </CardContent>
        </Card> */}
    </div>
  );
}

// Optional: Add dynamic metadata generation
// export async function generateMetadata({ params }: { params: { orderId: string } }) {
//   const order = await getOrderDetails(params.orderId);
//   return {
//     title: order ? `Order ${order.id} | Showroom Manager` : 'Order Details | Showroom Manager',
//   };
// }
