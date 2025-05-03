
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Filter, Search, Package, MoreHorizontal, AlertTriangle, PackageSearch } from "lucide-react"; // Added icons
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { db, collection, getDocs, Timestamp, query, orderBy } from '@/lib/firebase/firebase'; // Import Firestore functions
import type { Order } from '@/schemas/order'; // Import the Order type
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import { format } from 'date-fns'; // For formatting dates

// Function to fetch orders from Firestore
async function getOrders(): Promise<{ orders: Order[]; error?: string }> {
  if (!db) {
    const errorMessage = "Firestore database is not initialized. Cannot fetch orders. Please check Firebase configuration.";
    console.error(errorMessage);
    return { orders: [], error: "Database initialization failed. Please check configuration." };
  }

  try {
    console.log("Attempting to fetch orders from Firestore...");
    const ordersCollectionRef = collection(db, 'orders');
    // Add ordering by creation date, newest first
    const q = query(ordersCollectionRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const orders: Order[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data() as Omit<Order, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: Timestamp, updatedAt?: Timestamp };

      // Convert Timestamps to ISO strings for serialization
      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString(); // Fallback, should ideally not happen
       const updatedAt = data.updatedAt instanceof Timestamp
         ? data.updatedAt.toDate().toISOString()
         : undefined;

      orders.push({
        id: doc.id,
        ...data,
        createdAt, // Serialized date string
        updatedAt, // Serialized date string or undefined
        // Ensure items array exists, even if empty (though schema enforces min 1)
        items: data.items || [],
        // Ensure total is a number, default to 0 if missing/invalid
        total: typeof data.total === 'number' ? data.total : 0,
      });
    });
    console.log(`Fetched ${orders.length} orders.`);
    return { orders };
  } catch (error) {
     let errorMessage = `Error fetching orders from Firestore: ${error instanceof Error ? error.message : String(error)}`;
       // Check for specific Firestore index error
       if (error instanceof Error && error.message.toLowerCase().includes("index")) { // More robust check for index errors
          errorMessage = "Firestore query failed: A required index is missing. Please create the index in the Firebase console (Firestore Database > Indexes) for the 'orders' collection, ordered by 'createdAt' descending.";
          console.warn(errorMessage);
        }
    console.error(errorMessage);
    return { orders: [], error: errorMessage }; // Pass the potentially specific error message
  }
}


const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
   // Keep original variants for consistency
   switch (status?.toLowerCase()) {
    case 'processing':
    case 'pending payment': // Added pending payment
      return 'default'; // Using primary (gold)
    case 'shipped':
      return 'secondary'; // Using soft blue/green
    case 'delivered':
      return 'outline'; // Simple outline for completed
    case 'cancelled':
    case 'failed': // Added failed payment
      return 'destructive';
    // Add payment statuses if needed, or handle separately
    case 'paid':
        return 'outline'; // Example: Outline for paid
    case 'pending': // Payment pending
        return 'secondary'; // Example: Secondary for pending payment
    case 'refunded':
        return 'destructive'; // Example: Destructive for refunded
    default:
      return 'secondary';
  }
};

export default async function OrdersPage() {
  const { orders, error: fetchError } = await getOrders();

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-8"> {/* Added spacing */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-4xl font-bold text-foreground">Orders</h1>
        <Button asChild>
            {/* Link to a future "create order" page */}
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
               {/* Specific guidance for common errors */}
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


       {/* Filters and Search Section - Keep placeholders for now */}
       <Card className="p-4 md:p-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-grow w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by Order ID or Customer Name..." className="pl-10" />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
               <Select>
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
               {/* Potential Date Range Filter */}
               {/* <Button variant="outline" disabled>Date Range</Button> */}
            </div>
          </div>
        </Card>


      {/* Orders Table */}
      {!fetchError && (
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
               {orders.map((order) => (
                 <TableRow key={order.id}>
                   <TableCell className="font-medium">
                     <Link href={`/orders/${order.id}`} className="text-primary hover:underline">
                         {order.id.substring(0, 8)}... {/* Shorten ID for display */}
                      </Link>
                    </TableCell>
                   <TableCell>{order.customer.name}</TableCell>
                   {/* Format date nicely */}
                    <TableCell>{format(new Date(order.createdAt), 'PP')}</TableCell>
                   <TableCell className="text-right">${order.total.toFixed(2)}</TableCell>
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
                         <DropdownMenuItem disabled>Update Status (soon)</DropdownMenuItem>
                          <DropdownMenuItem disabled>Edit Order (soon)</DropdownMenuItem>
                         <DropdownMenuSeparator />
                          {order.shipmentId && (
                             <DropdownMenuItem asChild>
                                 <Link href={`/logistics/${order.shipmentId}`}>View Shipment</Link>
                              </DropdownMenuItem>
                          )}
                          {/* Add Cancel action using a client component later */}
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
       )}

        {/* Placeholder for when no orders are found (and no error) */}
       {!fetchError && orders.length === 0 && (
         <Card className="col-span-full shadow-sm">
            <div className="text-center py-16 text-muted-foreground">
              <PackageSearch className="mx-auto h-16 w-16 mb-4" /> {/* Changed Icon */}
              <p className="text-lg font-medium">No orders found.</p>
              <p className="text-sm mt-2">Create a new order to get started.</p>
            </div>
         </Card>
       )}
    </div>
  );
}

export const metadata = {
  title: 'Orders | Showroom Manager',
  description: 'View and manage customer orders.',
};

// Ensure dynamic rendering because data is fetched on each request
export const dynamic = 'force-dynamic';
