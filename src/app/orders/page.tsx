
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
import type { Order } from '@/schemas/order';
import { OrderSchema } from '@/schemas/order';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

// Function to fetch orders from Firestore (can be called from client or server)
async function getOrders(): Promise<{ orders: Order[]; error?: string }> {
  if (!db) {
    const errorMessage = "Firestore database is not initialized. Cannot fetch orders. Please check Firebase configuration.";
    console.error(errorMessage);
    return { orders: [], error: "Database initialization failed. Please check configuration." };
  }

  try {
    console.log("Attempting to fetch orders from Firestore...");
    const ordersCollectionRef = collection(db, 'orders');
    const q = query(ordersCollectionRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const orders: Order[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data() as Omit<Order, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: Timestamp, updatedAt?: Timestamp };
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString();
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined;
      orders.push({
        id: doc.id,
        ...data,
        createdAt,
        updatedAt,
        items: data.items || [],
        total: typeof data.total === 'number' ? data.total : 0,
      });
    });
    console.log(`Fetched ${orders.length} orders.`);
    return { orders };
  } catch (error) {
     let errorMessage = `Error fetching orders from Firestore: ${error instanceof Error ? error.message : String(error)}`;
       if (error instanceof Error && error.message.toLowerCase().includes("index")) {
          errorMessage = "Firestore query failed: A required index is missing. Please create the index in the Firebase console (Firestore Database > Indexes) for the 'orders' collection, ordered by 'createdAt' descending.";
          console.warn(errorMessage);
        }
    console.error(errorMessage);
    return { orders: [], error: errorMessage };
  }
}

const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
   switch (status?.toLowerCase()) {
    case 'processing':
    case 'pending payment':
      return 'default';
    case 'shipped':
      return 'secondary';
    case 'delivered':
    case 'paid':
      return 'outline';
    case 'cancelled':
    case 'failed':
    case 'refunded':
      return 'destructive';
    case 'pending': // Payment pending
      return 'secondary';
    default:
      return 'secondary';
  }
};

export default function OrdersPage() {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedStatus, setSelectedStatus] = React.useState("all");

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
      }
      setIsLoading(false);
    };
    fetchData();
  }, []); // Empty dependency array ensures this runs once on mount

  // Filter orders based on search and status
  const filteredOrders = React.useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = searchQuery === "" ||
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = selectedStatus === "all" || order.status.toLowerCase() === selectedStatus.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, selectedStatus]);

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-4xl font-bold text-foreground">Orders</h1>
        <Button asChild className="btn-primary-gradient">
           <Link href="/orders/new">
             <PlusCircle className="mr-2 h-4 w-4" /> Create New Order
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
                     A Firestore index might be required. Please check the Firebase console under Firestore Database &gt; Indexes. Create an index on the 'orders' collection for the 'createdAt' field (descending).
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
                placeholder="Search by Order ID or Customer Name..."
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
                 disabled={isLoading}
               >
                 <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
                   <SelectValue placeholder="Filter by Status" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Statuses</SelectItem>
                   {OrderSchema.shape.status.options.map(status => (
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
                   <TableCell>{order.customer.name}</TableCell>
                    <TableCell>{format(new Date(order.createdAt), 'PP')}</TableCell>
                   <TableCell className="text-right">₹{order.total.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</TableCell>
                   <TableCell className="text-center">
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
                          <DropdownMenuItem asChild>
                             <Link href={`/orders/${order.id}/edit`}>Edit Order</Link>
                          </DropdownMenuItem>
                         <DropdownMenuSeparator />
                          {order.shipmentId && (
                             <DropdownMenuItem asChild>
                                 <Link href={`/logistics/${order.shipmentId}`}>View Shipment</Link>
                              </DropdownMenuItem>
                          )}
                          {/* Placeholder for Cancel action */}
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
                   : "Create a new order to get started."}
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
