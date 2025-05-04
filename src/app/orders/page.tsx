
"use client"; // Make this a Client Component

import * as React from 'react'; // Import React
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Filter, Search, Package, MoreHorizontal, AlertTriangle, PackageSearch } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { db, collection, getDocs, Timestamp, query, orderBy } from '@/lib/firebase/firebase';
import type { Order, OrderItemSchema, ShippingInfoSchema, PaymentInfoSchema, TrackingInfoSchema } from '@/schemas/order'; // Import updated Order type
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

// Function to fetch orders from Firestore based on the new structure
async function getOrders(): Promise<{ orders: Order[]; error?: string }> {
  if (!db) {
    const errorMessage = "Firestore database is not initialized. Cannot fetch orders. Please check Firebase configuration.";
    console.error(errorMessage);
    return { orders: [], error: "Database initialization failed. Please check configuration." };
  }

  try {
    console.log("Attempting to fetch orders from Firestore (new structure)...");
    const ordersCollectionRef = collection(db, 'orders');
    // Assuming 'orderDate' is the field to sort by, descending
    const q = query(ordersCollectionRef, orderBy('orderDate', 'desc'));
    const querySnapshot = await getDocs(q);

    const orders: Order[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();

      // Map Firestore data to the Order interface
      const orderData: Order = {
        id: doc.id,
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
         // --- Compatibility mappings (optional, based on UI needs) ---
         createdAt: data.orderDate instanceof Timestamp ? data.orderDate.toDate().toISOString() : new Date().toISOString(),
         total: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
         customer: { // Map from shippingInfo
             name: data.shippingInfo?.name || 'N/A',
             email: data.shippingInfo?.email,
             phone: data.shippingInfo?.phone,
             address: data.shippingInfo?.address || 'N/A',
         },
          paymentStatus: data.paymentInfo?.paymentMethod || data.status, // Map payment method or fallback to main status
         shipmentId: data.trackingInfo?.trackingNumber, // Use tracking number as shipment identifier for links
      };
      orders.push(orderData);
    });
    console.log(`Fetched ${orders.length} orders.`);
    return { orders };
  } catch (error) {
     let errorMessage = `Error fetching orders from Firestore: ${error instanceof Error ? error.message : String(error)}`;
       if (error instanceof Error && error.message.toLowerCase().includes("index")) {
          errorMessage = "Firestore query failed: A required index is missing. Please create the index in the Firebase console (Firestore Database > Indexes) for the 'orders' collection, ordered by 'orderDate' descending.";
          console.warn(errorMessage);
        }
    console.error(errorMessage);
    return { orders: [], error: errorMessage };
  }
}

// Status badge logic - may need adjustment based on Firestore status values
const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
   switch (status?.toLowerCase()) {
    case 'processing':
    case 'shipment information received': // Example shipment status mapping
      return 'default';
    case 'shipped': // Assuming Shipped exists
    case 'in transit': // Example shipment status mapping
      return 'secondary';
    case 'delivered': // Assuming Delivered exists
      return 'outline';
    case 'pending payment': // Main order status
      return 'secondary'; // Or 'default' based on preference
    case 'cancelled':
    case 'failed': // Potential payment status
    case 'refunded': // Potential payment status
      return 'destructive';
    case 'paid': // Potential payment status
        return 'outline';
    default: // Fallback for unknown or other statuses
      return 'secondary';
  }
};

// Get distinct statuses from fetched orders for filtering
const getDistinctStatuses = (orders: Order[]): string[] => {
    const statuses = new Set<string>();
    orders.forEach(order => {
        statuses.add(order.status); // Add main status
        if (order.trackingInfo?.status) {
            statuses.add(order.trackingInfo.status); // Add tracking status if available
        }
         if (order.paymentInfo?.paymentMethod) { // Add payment method if relevant
            statuses.add(order.paymentInfo.paymentMethod);
         }
    });
    return Array.from(statuses).sort();
};


export default function OrdersPage() {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedStatus, setSelectedStatus] = React.useState("all");
  const [availableStatuses, setAvailableStatuses] = React.useState<string[]>([]);

  // Fetch data on component mount
  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      const { orders: fetchedOrders, error } = await getOrders();
      if (error) {
        setFetchError(error);
      } else {
        setOrders(fetchedOrders);
        setAvailableStatuses(getDistinctStatuses(fetchedOrders)); // Update available statuses for filter
      }
      setIsLoading(false);
    };
    fetchData();
  }, []); // Empty dependency array ensures this runs once on mount

  // Filter orders based on search and status (now includes more comprehensive check)
  const filteredOrders = React.useMemo(() => {
    return orders.filter(order => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === "" ||
        order.id.toLowerCase().includes(searchLower) ||
        order.shippingInfo.name.toLowerCase().includes(searchLower) ||
        (order.shippingInfo.email && order.shippingInfo.email.toLowerCase().includes(searchLower)) ||
        (order.trackingInfo?.trackingNumber && order.trackingInfo.trackingNumber.toLowerCase().includes(searchLower)); // Search tracking number

      // Check against main status, tracking status, or payment method if relevant
      const matchesStatus = selectedStatus === "all" ||
                            order.status.toLowerCase() === selectedStatus.toLowerCase() ||
                            (order.trackingInfo?.status && order.trackingInfo.status.toLowerCase() === selectedStatus.toLowerCase()) ||
                             (order.paymentInfo?.paymentMethod && order.paymentInfo.paymentMethod.toLowerCase() === selectedStatus.toLowerCase());

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, selectedStatus]);

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-4xl font-bold text-foreground">Orders</h1>
        {/* Link to create order page (assuming it exists or needs update) */}
        <Button asChild className="btn-primary-gradient" disabled>
           <Link href="/orders/new">
             <PlusCircle className="mr-2 h-4 w-4" /> Create New Order (soon)
           </Link>
         </Button>
      </div>

       {/* Display Error if fetching failed */}
       {fetchError && (
          <Alert variant="destructive" className="mb-6">
             <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Error Loading Orders</AlertTitle>
             <AlertDescription>
               {fetchError}
               {fetchError.includes("initialization failed") && (
                 <span className="block mt-2 text-xs">
                   Please verify your Firebase setup in `.env.local` and restart the application.
                 </span>
               )}
                {fetchError.includes("index") && (
                  <span className="block mt-2 text-xs">
                     A Firestore index might be required. Please check the Firebase console under Firestore Database &gt; Indexes. Create an index on the 'orders' collection for the 'orderDate' field (descending).
                  </span>
                 )}
             </AlertDescription>
           </Alert>
       )}

       {/* Filters and Search Section */}
       <Card className="p-4 md:p-6 shadow-sm card-header-gradient border-none">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-grow w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ID, Customer, Email, Tracking..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
               <Select
                 value={selectedStatus}
                 onValueChange={setSelectedStatus}
                 disabled={isLoading || availableStatuses.length === 0}
               >
                 <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
                   <SelectValue placeholder="Filter by Status" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Statuses</SelectItem>
                   {/* Use dynamically generated statuses */}
                   {availableStatuses.map(status => (
                        <SelectItem key={status} value={status.toLowerCase()}>{status}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
            </div>
          </div>
        </Card>

      {/* Orders Table or Loading Skeletons */}
      {isLoading ? (
        <Card className="shadow-md">
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-1/2 mt-1" />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                   {/* Define number of columns for skeleton */}
                  <TableHead><Skeleton className="h-5 w-20" /></TableHead>
                  <TableHead><Skeleton className="h-5 w-32" /></TableHead>
                  <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                  <TableHead className="text-right"><Skeleton className="h-5 w-20" /></TableHead>
                  <TableHead className="text-center"><Skeleton className="h-5 w-16" /></TableHead>
                  <TableHead className="text-center"><Skeleton className="h-5 w-24" /></TableHead>
                  <TableHead><Skeleton className="h-5 w-8" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : !fetchError && filteredOrders.length > 0 ? (
       <Card className="shadow-md">
         <CardHeader>
           <CardTitle>Order History</CardTitle>
           <CardDescription>Manage and view customer orders.</CardDescription>
         </CardHeader>
         <CardContent>
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Order ID</TableHead>
                 <TableHead>Customer</TableHead>
                 <TableHead>Date</TableHead>
                 <TableHead className="text-right">Total</TableHead>
                 <TableHead className="text-center">Items</TableHead>
                 <TableHead className="text-center">Status</TableHead>
                 <TableHead>
                   <span className="sr-only">Actions</span>
                 </TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {filteredOrders.map((order) => (
                 <TableRow key={order.id}>
                   <TableCell className="font-medium">
                     <Link href={`/orders/${order.id}`} className="text-primary hover:underline">
                         {order.id.substring(0, 8)}...
                      </Link>
                    </TableCell>
                   <TableCell>{order.shippingInfo.name}</TableCell>
                    <TableCell>{format(new Date(order.orderDate), 'PP')}</TableCell>
                   <TableCell className="text-right">₹{order.totalAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</TableCell>
                   <TableCell className="text-center">
                     {/* Display main status, consider adding tracking status badge too if needed */}
                     <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                   </TableCell>
                    <TableCell>
                     <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                         <Button aria-haspopup="true" size="icon" variant="ghost">
                           <MoreHorizontal className="h-4 w-4" />
                           <span className="sr-only">Toggle menu</span>
                         </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="end">
                         <DropdownMenuLabel>Actions</DropdownMenuLabel>
                         <DropdownMenuItem asChild>
                            <Link href={`/orders/${order.id}`}>View Details</Link>
                        </DropdownMenuItem>
                         {/* Enable Edit when implemented */}
                          <DropdownMenuItem asChild disabled>
                             <Link href={`/orders/${order.id}/edit`}>Edit Order (soon)</Link>
                          </DropdownMenuItem>
                         <DropdownMenuSeparator />
                          {order.trackingInfo?.trackingNumber && (
                             <DropdownMenuItem asChild disabled>
                                 {/* Assuming logistics page uses tracking number or a shipment ID */}
                                 <Link href={`/logistics/${order.trackingInfo.trackingNumber}`}>View Shipment (soon)</Link>
                              </DropdownMenuItem>
                          )}
                          {/* Placeholder for Cancel action - Needs update */}
                         <DropdownMenuItem className="text-destructive" disabled>Cancel Order (soon)</DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
         </CardContent>
       </Card>
       ) : !fetchError && filteredOrders.length === 0 ? (
         <Card className="col-span-full shadow-sm">
            <div className="text-center py-16 text-muted-foreground">
              <PackageSearch className="mx-auto h-16 w-16 mb-4" />
              <p className="text-lg font-medium">No orders match your criteria.</p>
              <p className="text-sm mt-2">
                 {searchQuery || selectedStatus !== 'all'
                   ? "Try adjusting your search or filters."
                   : "No orders found in the database."}
              </p>
            </div>
         </Card>
       ) : null /* Don't show placeholder if there was a fetch error */}
    </div>
  );
}

// export const metadata = {
//   title: 'Orders | Showroom Manager',
//   description: 'View and manage customer orders.',
// };

// export const dynamic = 'force-dynamic';
