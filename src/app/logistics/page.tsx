
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Filter, Search, Truck, Navigation, MoreHorizontal, AlertTriangle, PackageSearch } from "lucide-react"; // Added icons
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { db, collection, getDocs, Timestamp, query, orderBy } from '@/lib/firebase/firebase'; // Import Firestore functions
import type { Shipment } from '@/schemas/shipment'; // Import the Shipment type
import { ShipmentSchema } from '@/schemas/shipment'; // Import ShipmentSchema for status options
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import { format } from 'date-fns'; // For formatting dates


// Function to fetch shipments from Firestore
async function getShipments(): Promise<{ shipments: Shipment[]; error?: string }> {
   if (!db) {
     const errorMessage = "Firestore database is not initialized. Cannot fetch shipments.";
     console.error(errorMessage);
     return { shipments: [], error: "Database initialization failed. Please check configuration." };
   }

   try {
     console.log("Attempting to fetch shipments from Firestore...");
     const shipmentsCollectionRef = collection(db, 'shipments');
     // Add ordering by creation date, newest first
     const q = query(shipmentsCollectionRef, orderBy('createdAt', 'desc'));
     const querySnapshot = await getDocs(q);

     const shipments: Shipment[] = [];
     querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<Shipment, 'id' | 'createdAt' | 'updatedAt' | 'actualDelivery' | 'history'> & {
             createdAt?: Timestamp,
             updatedAt?: Timestamp,
             actualDelivery?: Timestamp,
             history?: { timestamp: Timestamp | string }[] // Handle potential mixed types during transition
           };

       // Convert Timestamps to ISO strings for serialization
       const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString();
       const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined;
       const actualDelivery = data.actualDelivery instanceof Timestamp ? data.actualDelivery.toDate().toISOString() : undefined;

        // Ensure history timestamps are strings
       const history = (data.history || []).map(event => ({
           ...event,
           timestamp: event.timestamp instanceof Timestamp
               ? event.timestamp.toDate().toISOString()
               : typeof event.timestamp === 'string' ? event.timestamp : new Date().toISOString() // Fallback
       }));


       shipments.push({
         id: doc.id,
         // Cast data to ShipmentInput after removing/converting timestamps
         ...(data as Shipment), // Adjust casting as needed if fields differ
         createdAt,
         updatedAt,
         actualDelivery,
         history, // Serialized history
       });
     });
     console.log(`Fetched ${shipments.length} shipments.`);
     return { shipments };
   } catch (error) {
     let errorMessage = `Error fetching shipments from Firestore: ${error instanceof Error ? error.message : String(error)}`;
        // Check for specific Firestore index error
        if (error instanceof Error && error.message.toLowerCase().includes("index")) { // More robust check for index errors
            errorMessage = "Firestore query failed: A required index is missing. Please create the index in the Firebase console (Firestore Database > Indexes) for the 'shipments' collection, ordered by 'createdAt' descending.";
            console.warn(errorMessage);
        }
     console.error(errorMessage);
     return { shipments: [], error: errorMessage }; // Pass the potentially specific error message
   }
}


const getShipmentStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  // Keep original variants
  switch (status?.toLowerCase()) {
    case 'label created':
      return 'secondary';
    case 'picked up': // Added Picked Up
    case 'in transit':
    case 'out for delivery':
      return 'default'; // Gold for active states
    case 'delivered':
      return 'outline'; // Outline for completed
    case 'exception':
    case 'delayed': // Added Delayed
      return 'destructive'; // Destructive for issues
    default:
      return 'secondary'; // Default for unknown/other states
  }
};


export default async function LogisticsPage() {
  const { shipments, error: fetchError } = await getShipments();

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-8"> {/* Added spacing */}
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
               {/* Specific guidance for common errors */}
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


       {/* Filters and Search Section - Keep placeholders */}
        <Card className="p-4 md:p-6 shadow-sm">
         <div className="flex flex-col md:flex-row gap-4 items-center">
           <div className="relative flex-grow w-full md:w-auto">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input placeholder="Search by Shipment ID, Order ID, or Tracking..." className="pl-10" />
           </div>
           <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
               <Select>
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
               <Select>
                 <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
                   <SelectValue placeholder="Filter by Carrier" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Carriers</SelectItem>
                   {/* Dynamically populate carriers if needed, or keep static */}
                   <SelectItem value="fastfreight">FastFreight</SelectItem>
                   <SelectItem value="quickship">QuickShip</SelectItem>
                   <SelectItem value="reliabletrans">ReliableTrans</SelectItem>
                 </SelectContent>
               </Select>
           </div>
         </div>
        </Card>

      {/* Shipments Table */}
      {!fetchError && (
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
               {shipments.map((shipment) => (
                 <TableRow key={shipment.id}>
                   <TableCell className="font-medium">
                     <Link href={`/logistics/${shipment.id}`} className="text-primary hover:underline">
                        {shipment.id.substring(0, 8)}... {/* Shorten ID */}
                     </Link>
                    </TableCell>
                   <TableCell>
                      <Link href={`/orders/${shipment.orderId}`} className="text-primary hover:underline">
                         {shipment.orderId.substring(0, 8)}... {/* Shorten ID */}
                       </Link>
                    </TableCell>
                   <TableCell>{shipment.carrier}</TableCell>
                   <TableCell>
                       {/* Add actual tracking link later */}
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
      )}

        {/* Placeholder for when no shipments match filter/search */}
       {!fetchError && shipments.length === 0 && (
         <Card className="col-span-full shadow-sm">
            <div className="text-center py-16 text-muted-foreground">
              <Truck className="mx-auto h-16 w-16 mb-4" />
              <p className="text-lg font-medium">No shipments found.</p>
              <p className="text-sm mt-2">Shipments will appear here once created.</p>
            </div>
         </Card>
       )}

      {/* Potential Future Section: Delivery Schedule */}
      {/* <Card className="mt-8"> ... </Card> */}
    </div>
  );
}

export const metadata = {
  title: 'Logistics | Showroom Manager',
  description: 'Track and manage shipments.',
};

// Ensure dynamic rendering because data is fetched on each request
export const dynamic = 'force-dynamic';
