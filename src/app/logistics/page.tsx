
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
import { db, collection, getDocs, Timestamp, query, orderBy } from '@/lib/firebase/firebase';
import type { Shipment } from '@/schemas/shipment';
import { ShipmentSchema } from '@/schemas/shipment';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

// Function to fetch shipments from Firestore (can be called from client or server)
async function getShipments(): Promise<{ shipments: Shipment[]; error?: string }> {
   if (!db) {
     const errorMessage = "Firestore database is not initialized. Cannot fetch shipments.";
     console.error(errorMessage);
     return { shipments: [], error: "Database initialization failed. Please check configuration." };
   }

   try {
     console.log("Attempting to fetch shipments from Firestore...");
     const shipmentsCollectionRef = collection(db, 'shipments');
     const q = query(shipmentsCollectionRef, orderBy('createdAt', 'desc'));
     const querySnapshot = await getDocs(q);

     const shipments: Shipment[] = [];
     querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<Shipment, 'id' | 'createdAt' | 'updatedAt' | 'actualDelivery' | 'history'> & {
             createdAt?: Timestamp,
             updatedAt?: Timestamp,
             actualDelivery?: Timestamp,
             history?: { timestamp: Timestamp | string }[]
           };
       const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString();
       const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined;
       const actualDelivery = data.actualDelivery instanceof Timestamp ? data.actualDelivery.toDate().toISOString() : undefined;
       const history = (data.history || []).map(event => ({
           ...event,
           timestamp: event.timestamp instanceof Timestamp
               ? event.timestamp.toDate().toISOString()
               : typeof event.timestamp === 'string' ? event.timestamp : new Date().toISOString()
       }));

       shipments.push({
         id: doc.id,
         ...(data as Shipment),
         createdAt,
         updatedAt,
         actualDelivery,
         history,
       });
     });
     console.log(`Fetched ${shipments.length} shipments.`);
     return { shipments };
   } catch (error) {
     let errorMessage = `Error fetching shipments from Firestore: ${error instanceof Error ? error.message : String(error)}`;
        if (error instanceof Error && error.message.toLowerCase().includes("index")) {
            errorMessage = "Firestore query failed: A required index is missing. Please create the index in the Firebase console (Firestore Database > Indexes) for the 'shipments' collection, ordered by 'createdAt' descending.";
            console.warn(errorMessage);
        }
     console.error(errorMessage);
     return { shipments: [], error: errorMessage };
   }
}

const getShipmentStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  switch (status?.toLowerCase()) {
    case 'label created':
      return 'secondary';
    case 'picked up':
    case 'in transit':
    case 'out for delivery':
      return 'default';
    case 'delivered':
      return 'outline';
    case 'exception':
    case 'delayed':
      return 'destructive';
    default:
      return 'secondary';
  }
};

export default function LogisticsPage() {
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedStatus, setSelectedStatus] = React.useState("all");
  const [selectedCarrier, setSelectedCarrier] = React.useState("all");

  // Fetch data on component mount
  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError(null);
      const { shipments: fetchedShipments, error } = await getShipments();
      if (error) {
        setFetchError(error);
      } else {
        setShipments(fetchedShipments);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []); // Empty dependency array

  // Calculate unique carriers
  const uniqueCarriers = React.useMemo(() => Array.from(new Set(shipments.map(s => s.carrier))).filter(Boolean), [shipments]);

  // Filter shipments
  const filteredShipments = React.useMemo(() => {
    return shipments.filter(shipment => {
      const matchesSearch = searchQuery === "" ||
        shipment.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.customerName.toLowerCase().includes(searchQuery.toLowerCase()); // Add customer name search
      const matchesStatus = selectedStatus === "all" || shipment.status.toLowerCase() === selectedStatus.toLowerCase();
      const matchesCarrier = selectedCarrier === "all" || shipment.carrier === selectedCarrier;
      return matchesSearch && matchesStatus && matchesCarrier;
    });
  }, [shipments, searchQuery, selectedStatus, selectedCarrier]);

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-4xl font-bold text-foreground">Logistics</h1>
        <Button disabled> {/* Disabled until implemented */}
          <PlusCircle className="mr-2 h-4 w-4" /> Schedule New Shipment (soon)
        </Button>
      </div>

      {/* Display Error if fetching failed */}
       {fetchError && (
          <Alert variant="destructive" className="mb-6">
             <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Error Loading Shipments</AlertTitle>
             <AlertDescription>
               {fetchError}
               {fetchError.includes("initialization failed") && (
                 <span className="block mt-2 text-xs">
                   Please verify your Firebase setup in `.env.local` and restart the application.
                 </span>
               )}
                {fetchError.includes("index") && (
                 <span className="block mt-2 text-xs">
                    A Firestore index might be required. Please check the Firebase console under Firestore Database &gt; Indexes. Create an index on the 'shipments' collection for the 'createdAt' field (descending).
                 </span>
                )}
             </AlertDescription>
           </Alert>
       )}

       {/* Filters and Search Section */}
        <Card className="p-4 md:p-6 shadow-sm">
         <div className="flex flex-col md:flex-row gap-4 items-center">
           <div className="relative flex-grow w-full md:w-auto">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Search by ID, Tracking, Customer..."
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
                    {ShipmentSchema.shape.status.options.map(status => (
                        <SelectItem key={status} value={status.toLowerCase()}>{status}</SelectItem>
                    ))}
                 </SelectContent>
               </Select>
               <Select
                  value={selectedCarrier}
                  onValueChange={setSelectedCarrier}
                  disabled={isLoading}
               >
                 <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
                   <SelectValue placeholder="Filter by Carrier" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Carriers</SelectItem>
                   {uniqueCarriers.map(carrier => (
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
                   <TableHead><Skeleton className="h-5 w-20" /></TableHead>
                   <TableHead><Skeleton className="h-5 w-20" /></TableHead>
                   <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                   <TableHead><Skeleton className="h-5 w-32" /></TableHead>
                   <TableHead><Skeleton className="h-5 w-40" /></TableHead>
                   <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                   <TableHead className="text-center"><Skeleton className="h-5 w-24" /></TableHead>
                   <TableHead><Skeleton className="h-5 w-8" /></TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {Array.from({ length: 5 }).map((_, index) => (
                   <TableRow key={index}>
                     <TableCell><Skeleton className="h-5 w-20" /></TableCell>
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
       ) : !fetchError && filteredShipments.length > 0 ? (
       <Card className="shadow-md">
         <CardHeader>
           <CardTitle>Shipment Tracking</CardTitle>
           <CardDescription>Monitor incoming and outgoing shipments.</CardDescription>
         </CardHeader>
         <CardContent>
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Shipment ID</TableHead>
                 <TableHead>Order ID</TableHead>
                 <TableHead>Carrier</TableHead>
                 <TableHead>Tracking #</TableHead>
                 <TableHead>Destination</TableHead>
                 <TableHead>Est. Delivery</TableHead>
                 <TableHead className="text-center">Status</TableHead>
                  <TableHead>
                   <span className="sr-only">Actions</span>
                 </TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {filteredShipments.map((shipment) => (
                 <TableRow key={shipment.id}>
                   <TableCell className="font-medium">
                     <Link href={`/logistics/${shipment.id}`} className="text-primary hover:underline">
                        {shipment.id.substring(0, 8)}...
                     </Link>
                    </TableCell>
                   <TableCell>
                      <Link href={`/orders/${shipment.orderId}`} className="text-primary hover:underline">
                         {shipment.orderId.substring(0, 8)}...
                       </Link>
                    </TableCell>
                   <TableCell>{shipment.carrier}</TableCell>
                   <TableCell>
                      <span title={shipment.trackingNumber} className="flex items-center gap-1">
                         {shipment.trackingNumber.substring(0, 10)}...
                          <Navigation className="inline h-3 w-3 ml-1 text-muted-foreground" />
                      </span>
                    </TableCell>
                    <TableCell className="truncate max-w-xs" title={shipment.destination}>{shipment.destination}</TableCell>
                    <TableCell>{shipment.estimatedDelivery ? format(new Date(shipment.estimatedDelivery), 'PP') : 'N/A'}</TableCell>
                   <TableCell className="text-center">
                     <Badge variant={getShipmentStatusVariant(shipment.status)}>{shipment.status}</Badge>
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
                            <Link href={`/logistics/${shipment.id}`}>View Details</Link>
                        </DropdownMenuItem>
                         <DropdownMenuItem disabled>Update Status (soon)</DropdownMenuItem>
                         <DropdownMenuItem disabled>Print Label (soon)</DropdownMenuItem>
                         <DropdownMenuSeparator />
                          <DropdownMenuItem disabled>Track Package (soon)</DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
         </CardContent>
       </Card>
      ) : !fetchError && filteredShipments.length === 0 ? (
         <Card className="col-span-full shadow-sm">
            <div className="text-center py-16 text-muted-foreground">
              <Truck className="mx-auto h-16 w-16 mb-4" />
               <p className="text-lg font-medium">No shipments match your criteria.</p>
              <p className="text-sm mt-2">
                 {searchQuery || selectedStatus !== 'all' || selectedCarrier !== 'all'
                   ? "Try adjusting your search or filters."
                   : "Shipments will appear here once created."}
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
