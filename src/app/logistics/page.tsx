
"use client"; // Make this a Client Component

import * as React from 'react'; // Import React
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Filter, Search, Truck, Navigation, MoreHorizontal, AlertTriangle, PackageSearch } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { db, collection, getDocs, Timestamp, query, orderBy, where } from '@/lib/firebase/firebase';
// Import Order type as logistics data now comes from the Order collection's trackingInfo
import type { Order, TrackingInfoSchema } from '@/schemas/order';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

// Define a structure for displaying logistics data derived from orders
interface LogisticsDisplayItem {
    id: string; // Order ID
    orderId: string; // Order ID again for clarity
    customerName: string; // From shippingInfo
    carrier?: string; // From trackingInfo
    trackingNumber?: string; // From trackingInfo
    destination: string; // From shippingInfo address (simplified)
    estimatedDelivery?: string; // Not directly available in new structure, maybe add later
    status?: string; // From trackingInfo
    createdAt: string; // Order creation date
}

// Function to fetch logistics data derived from orders
async function getLogisticsData(): Promise<{ items: LogisticsDisplayItem[]; error?: string }> {
   if (!db) {
     const errorMessage = "Firestore database is not initialized. Cannot fetch logistics data.";
     console.error(errorMessage);
     return { items: [], error: "Database initialization failed. Please check configuration." };
   }

   try {
     console.log("Attempting to fetch logistics data from orders...");
     const ordersCollectionRef = collection(db, 'orders');
     // Fetch orders that have tracking information (or all orders if tracking is optional)
     // const q = query(ordersCollectionRef, where('trackingInfo', '!=', null), orderBy('orderDate', 'desc'));
     const q = query(ordersCollectionRef, orderBy('orderDate', 'desc')); // Fetch all for now
     const querySnapshot = await getDocs(q);

     const logisticsItems: LogisticsDisplayItem[] = [];
     querySnapshot.forEach((doc) => {
        const data = doc.data() as Order; // Use the Order type

        // Only include orders that have some form of tracking info or are relevant for logistics view
        // if (data.trackingInfo) { // Can filter here if needed
             logisticsItems.push({
                 id: doc.id,
                 orderId: doc.id,
                 customerName: data.shippingInfo?.name || 'N/A',
                 carrier: data.trackingInfo?.carrier,
                 trackingNumber: data.trackingInfo?.trackingNumber,
                 // Simplify destination display
                 destination: `${data.shippingInfo?.city || ''}, ${data.shippingInfo?.state || ''}`,
                 status: data.trackingInfo?.status || data.status, // Fallback to main order status if tracking status missing
                 createdAt: data.orderDate, // Use order date
             });
        // }
     });
     console.log(`Fetched ${logisticsItems.length} logistics-relevant orders.`);
     return { items: logisticsItems };
   } catch (error) {
     let errorMessage = `Error fetching logistics data from orders: ${error instanceof Error ? error.message : String(error)}`;
        if (error instanceof Error && error.message.toLowerCase().includes("index")) {
            errorMessage = "Firestore query failed: A required index is missing. Please check the Firebase console (Firestore Database > Indexes) for the 'orders' collection, ordered by 'orderDate' descending.";
            console.warn(errorMessage);
        }
     console.error(errorMessage);
     return { items: [], error: errorMessage };
   }
}

// Reuse status variant logic from orders page - adjust as necessary
const getLogisticsStatusVariant = (status?: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (status?.toLowerCase()) {
     case 'processing':
     case 'shipment information received':
       return 'default';
     case 'shipped':
     case 'in transit':
       return 'secondary';
     case 'delivered':
       return 'outline';
     case 'pending payment':
       return 'secondary';
     case 'cancelled':
     case 'failed':
     case 'exception': // Example tracking status
     case 'delayed':   // Example tracking status
       return 'destructive';
     default:
       return 'secondary';
   }
 };

// Get distinct statuses from fetched data
const getDistinctLogisticsStatuses = (items: LogisticsDisplayItem[]): string[] => {
    const statuses = new Set<string>();
    items.forEach(item => {
        if(item.status) statuses.add(item.status);
    });
    return Array.from(statuses).sort();
};


export default function LogisticsPage() {
  const [logisticsItems, setLogisticsItems] = React.useState<LogisticsDisplayItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedStatus, setSelectedStatus] = React.useState("all");
  const [selectedCarrier, setSelectedCarrier] = React.useState("all"); // Keep carrier filter if needed
  const [availableStatuses, setAvailableStatuses] = React.useState<string[]>([]);
  const [availableCarriers, setAvailableCarriers] = React.useState<string[]>([]);


  // Fetch data on component mount
  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      const { items: fetchedItems, error } = await getLogisticsData();
      if (error) {
        setFetchError(error);
      } else {
        setLogisticsItems(fetchedItems);
        setAvailableStatuses(getDistinctLogisticsStatuses(fetchedItems));
        // Calculate unique carriers
        const carriers = new Set<string>();
        fetchedItems.forEach(item => {
            if(item.carrier) carriers.add(item.carrier);
        });
        setAvailableCarriers(Array.from(carriers).sort());
      }
      setIsLoading(false);
    };
    fetchData();
  }, []); // Empty dependency array

  // Filter logistics items
  const filteredItems = React.useMemo(() => {
    return logisticsItems.filter(item => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === "" ||
        (item.orderId && item.orderId.toLowerCase().includes(searchLower)) ||
        (item.trackingNumber && item.trackingNumber.toLowerCase().includes(searchLower)) ||
        (item.customerName && item.customerName.toLowerCase().includes(searchLower)) ||
        (item.destination && item.destination.toLowerCase().includes(searchLower));

      const matchesStatus = selectedStatus === "all" || (item.status && item.status.toLowerCase() === selectedStatus.toLowerCase());
      const matchesCarrier = selectedCarrier === "all" || item.carrier === selectedCarrier;
      return matchesSearch && matchesStatus && matchesCarrier;
    });
  }, [logisticsItems, searchQuery, selectedStatus, selectedCarrier]);

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-4xl font-bold text-foreground">Logistics</h1>
        {/* Shipment creation is now tied to order creation */}
        <Button disabled className="btn-primary-gradient">
          <PlusCircle className="mr-2 h-4 w-4" /> Schedule Shipment (Auto via Order)
        </Button>
      </div>

      {/* Display Error if fetching failed */}
       {fetchError && (
          <Alert variant="destructive" className="mb-6">
             <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Error Loading Logistics Data</AlertTitle>
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
               placeholder="Search Order ID, Tracking, Customer, Dest..."
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
               <Select
                  value={selectedCarrier}
                  onValueChange={setSelectedCarrier}
                  disabled={isLoading || availableCarriers.length === 0}
               >
                 <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
                   <SelectValue placeholder="Filter by Carrier" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Carriers</SelectItem>
                   {availableCarriers.map(carrier => (
                     <SelectItem key={carrier} value={carrier}>{carrier}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
           </div>
         </div>
        </Card>

      {/* Shipments Table or Loading Skeletons */}
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
                   <TableHead><Skeleton className="h-5 w-20" /></TableHead> {/* Order ID */}
                   <TableHead><Skeleton className="h-5 w-24" /></TableHead> {/* Carrier */}
                   <TableHead><Skeleton className="h-5 w-32" /></TableHead> {/* Tracking */}
                   <TableHead><Skeleton className="h-5 w-40" /></TableHead> {/* Destination */}
                   <TableHead><Skeleton className="h-5 w-24" /></TableHead> {/* Customer */}
                   <TableHead className="text-center"><Skeleton className="h-5 w-24" /></TableHead> {/* Status */}
                   <TableHead><Skeleton className="h-5 w-8" /></TableHead> {/* Actions */}
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {Array.from({ length: 5 }).map((_, index) => (
                   <TableRow key={index}>
                     <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                     <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                     <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                     <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                     <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                     <TableCell className="text-center"><Skeleton className="h-5 w-24" /></TableCell>
                     <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </CardContent>
         </Card>
       ) : !fetchError && filteredItems.length > 0 ? (
       <Card className="shadow-md">
         <CardHeader>
           <CardTitle>Shipment Tracking</CardTitle>
           <CardDescription>Monitor shipment status based on order tracking information.</CardDescription>
         </CardHeader>
         <CardContent>
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Order ID</TableHead>
                 <TableHead>Carrier</TableHead>
                 <TableHead>Tracking #</TableHead>
                 <TableHead>Destination</TableHead>
                 <TableHead>Customer</TableHead>
                 <TableHead className="text-center">Status</TableHead>
                  <TableHead>
                   <span className="sr-only">Actions</span>
                 </TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {filteredItems.map((item) => (
                 <TableRow key={item.id}>
                   <TableCell className="font-medium">
                     {/* Link to the order detail page */}
                     <Link href={`/orders/${item.orderId}`} className="text-primary hover:underline">
                        {item.orderId.substring(0, 8)}...
                     </Link>
                    </TableCell>
                   <TableCell>{item.carrier || 'N/A'}</TableCell>
                   <TableCell>
                      <span title={item.trackingNumber || 'N/A'} className="flex items-center gap-1">
                         {item.trackingNumber?.substring(0, 10)}...
                          {/* Add condition to show icon only if tracking number exists */}
                          {item.trackingNumber && item.trackingNumber !== 'Pending' && <Navigation className="inline h-3 w-3 ml-1 text-muted-foreground" />}
                      </span>
                    </TableCell>
                    <TableCell className="truncate max-w-xs" title={item.destination}>{item.destination}</TableCell>
                    <TableCell>{item.customerName}</TableCell>
                    {/* Use estimatedDelivery if available, otherwise maybe order date? */}
                    {/* <TableCell>{item.estimatedDelivery ? format(new Date(item.estimatedDelivery), 'PP') : 'N/A'}</TableCell> */}
                   <TableCell className="text-center">
                     <Badge variant={getLogisticsStatusVariant(item.status)}>{item.status || 'N/A'}</Badge>
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
                         {/* Link to order details instead of non-existent logistics detail */}
                         <DropdownMenuItem asChild>
                            <Link href={`/orders/${item.orderId}`}>View Order Details</Link>
                        </DropdownMenuItem>
                         {/* Logistics detail page needs rework or removal */}
                         <DropdownMenuItem disabled>View Shipment Details (soon)</DropdownMenuItem>
                         <DropdownMenuItem disabled>Update Status (soon)</DropdownMenuItem>
                         <DropdownMenuItem disabled>Print Label (soon)</DropdownMenuItem>
                         <DropdownMenuSeparator />
                          <DropdownMenuItem disabled={!item.trackingNumber || item.trackingNumber === 'Pending'}>
                              Track Package (soon)
                          </DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
         </CardContent>
       </Card>
      ) : !fetchError && filteredItems.length === 0 ? (
         <Card className="col-span-full shadow-sm">
            <div className="text-center py-16 text-muted-foreground">
              <Truck className="mx-auto h-16 w-16 mb-4" />
               <p className="text-lg font-medium">No shipments match your criteria.</p>
              <p className="text-sm mt-2">
                 {searchQuery || selectedStatus !== 'all' || selectedCarrier !== 'all'
                   ? "Try adjusting your search or filters."
                   : "Shipment information is linked to orders."}
              </p>
            </div>
         </Card>
       ) : null /* Don't show placeholder if there was a fetch error */}
    </div>
  );
}

// export const metadata = {
//   title: 'Logistics | Showroom Manager',
//   description: 'Track and manage shipments.',
// };

// export const dynamic = 'force-dynamic';
