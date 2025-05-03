
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Printer, Package, User, MapPin, Calendar, Hash, Navigation, Home, ChevronRight, AlertTriangle, Clock } from 'lucide-react'; // Added icons
import Link from 'next/link';
import { db, doc, getDoc, Timestamp } from '@/lib/firebase/firebase'; // Import Firestore functions
import type { Shipment, ShipmentInput } from '@/schemas/shipment'; // Import Shipment type
import { notFound } from 'next/navigation'; // For 404
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import { format, formatDistanceToNow } from 'date-fns'; // For formatting dates
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"; // Import Breadcrumb

// Function to fetch a single shipment's details from Firestore
async function getShipmentDetails(shipmentId: string): Promise<{ shipment: Shipment | null; error?: string }> {
  if (!db) {
    const errorMessage = "Database configuration error. Unable to fetch shipment details.";
    console.error("Firestore database is not initialized. Cannot fetch shipment details.");
    return { shipment: null, error: "Database initialization failed. Please check configuration." };
  }

  try {
    console.log(`Attempting to fetch shipment details for ID: ${shipmentId}`);
    const shipmentDocRef = doc(db, 'shipments', shipmentId);
    const docSnap = await getDoc(shipmentDocRef);

    if (docSnap.exists()) {
      console.log("Shipment found in Firestore.");
      const data = docSnap.data() as Omit<Shipment, 'id' | 'createdAt' | 'updatedAt' | 'actualDelivery' | 'history'> & {
           createdAt?: Timestamp,
           updatedAt?: Timestamp,
           actualDelivery?: Timestamp,
           history?: { timestamp: Timestamp | string }[] // Handle potential mixed types
         };


       // Convert Timestamps to ISO strings
       const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString();
       const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined;
       const actualDelivery = data.actualDelivery instanceof Timestamp ? data.actualDelivery.toDate().toISOString() : undefined;

       // Ensure history timestamps are strings and sort descending
        const history = (data.history || [])
         .map(event => ({
           ...event,
           timestamp: event.timestamp instanceof Timestamp
               ? event.timestamp.toDate().toISOString()
               : typeof event.timestamp === 'string' ? event.timestamp : new Date().toISOString()
         }))
         .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Sort newest first


      const shipmentData: Shipment = {
        id: docSnap.id,
        // Need to cast 'data' because TypeScript can't guarantee all fields exist after omit/pick
        ...(data as ShipmentInput),
        createdAt,
        updatedAt,
        actualDelivery,
        history,
      };

      return { shipment: shipmentData };
    } else {
      console.log("No such document found for shipment ID:", shipmentId);
      return { shipment: null }; // Not found
    }
  } catch (error) {
    const errorMessage = `Error fetching shipment details from Firestore for ID ${shipmentId}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return { shipment: null, error: "Failed to load shipment details due to a database error." };
  }
}

// Re-use status variant logic
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


export default async function ShipmentDetailPage({ params }: { params: { shipmentId: string } }) {
  const { shipment, error: fetchError } = await getShipmentDetails(params.shipmentId);

   // Handle fetch error first
   if (fetchError) {
       return (
        <div className="container mx-auto py-6 space-y-6">
          {/* Breadcrumbs for Error Page */}
         <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink asChild><Link href="/"><Home className="h-4 w-4"/></Link></BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbLink asChild><Link href="/logistics">Logistics</Link></BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Error</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Shipment Details</AlertTitle>
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

   // If no error but shipment is null, then it's not found
   if (!shipment) {
     notFound();
   }

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumb>
           <BreadcrumbList>
             <BreadcrumbItem><BreadcrumbLink asChild><Link href="/"><Home className="h-4 w-4"/></Link></BreadcrumbLink></BreadcrumbItem>
             <BreadcrumbSeparator />
             <BreadcrumbItem><BreadcrumbLink asChild><Link href="/logistics">Logistics</Link></BreadcrumbLink></BreadcrumbItem>
             <BreadcrumbSeparator />
             <BreadcrumbItem><BreadcrumbPage>Shipment {shipment.id.substring(0, 8)}...</BreadcrumbPage></BreadcrumbItem>
           </BreadcrumbList>
         </Breadcrumb>

       <div className="flex items-center justify-between">
         <Button variant="outline" size="sm" asChild>
           <Link href="/logistics">
             <ArrowLeft className="mr-2 h-4 w-4" />
             Back to Logistics
           </Link>
         </Button>
          <div className="flex gap-2">
               {/* Add actual tracking link builder later */}
              <Button variant="outline" size="sm" disabled>
                  <Navigation className="mr-2 h-4 w-4" />
                  Track Externally (soon)
              </Button>
             <Button size="sm" disabled>
                 <Edit className="mr-2 h-4 w-4" />
                 Update Shipment (soon)
             </Button>
          </div>
       </div>

       <Card className="shadow-md">
         <CardHeader className="flex flex-row items-start justify-between pb-4 gap-4"> {/* Allow wrap */}
            <div>
               <CardTitle className="text-2xl lg:text-3xl font-bold">Shipment #{shipment.id}</CardTitle>
                <CardDescription className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Package className="h-4 w-4"/> For Order <Link href={`/orders/${shipment.orderId}`} className="text-primary hover:underline">{shipment.orderId.substring(0,8)}...</Link>
                </CardDescription>
                 <CardDescription className="flex items-center gap-2 text-xs text-muted-foreground/80 mt-1">
                  Created: {format(new Date(shipment.createdAt), 'PP p')}
                </CardDescription>
                 {shipment.updatedAt && shipment.updatedAt !== shipment.createdAt && (
                     <CardDescription className="flex items-center gap-2 text-xs text-muted-foreground/80 mt-1">
                      Last updated: {format(new Date(shipment.updatedAt), 'PP p')}
                    </CardDescription>
                 )}
            </div>
            <Badge variant={getShipmentStatusVariant(shipment.status)} className="text-base md:text-lg px-3 py-1 md:px-4 md:py-1.5 whitespace-nowrap shrink-0">{shipment.status}</Badge>
         </CardHeader>
          <Separator />
          <CardContent className="pt-6 grid md:grid-cols-3 gap-6">
             {/* Shipment Info */}
             <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Hash className="h-5 w-5 text-muted-foreground" /> Shipment Details</h3>
                <p className="text-sm"><span className="font-medium text-muted-foreground">Carrier:</span> {shipment.carrier}</p>
                <p className="text-sm"><span className="font-medium text-muted-foreground">Tracking #:</span> {shipment.trackingNumber}</p>
                 <p className="text-sm"><span className="font-medium text-muted-foreground">Pieces:</span> {shipment.pieces || 'N/A'}</p>
                 <p className="text-sm"><span className="font-medium text-muted-foreground">Weight:</span> {shipment.weight || 'N/A'}</p>
                 <p className="text-sm"><span className="font-medium text-muted-foreground">Dimensions:</span> {shipment.dimensions || 'N/A'}</p>
                 {shipment.notes && <p className="text-sm pt-1"><span className="font-medium text-muted-foreground">Notes:</span> {shipment.notes}</p>}
             </div>

              {/* Origin/Destination */}
             <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2"><MapPin className="h-5 w-5 text-muted-foreground" /> Origin & Destination</h3>
                <p className="text-sm font-medium">From:</p>
                <p className="text-sm text-muted-foreground">{shipment.origin}</p>
                <p className="text-sm font-medium mt-2">To:</p>
                <p className="text-sm text-muted-foreground">{shipment.destination}</p>
                 <p className="text-sm text-muted-foreground"><span className="font-medium">Customer:</span> {shipment.customerName}</p>
             </div>

              {/* Dates */}
             <div className="space-y-2">
                 <h3 className="text-lg font-semibold flex items-center gap-2"><Calendar className="h-5 w-5 text-muted-foreground" /> Dates</h3>
                 <p className="text-sm"><span className="font-medium text-muted-foreground">Est. Delivery:</span> {shipment.estimatedDelivery ? format(new Date(shipment.estimatedDelivery), 'PP') : 'N/A'}</p>
                 {shipment.actualDelivery ? (
                     <p className="text-sm"><span className="font-medium text-muted-foreground">Actual Delivery:</span> {format(new Date(shipment.actualDelivery), 'PP p')}</p>
                 ) : (
                    <p className="text-sm text-muted-foreground italic">Not yet delivered.</p>
                 )}
             </div>
          </CardContent>
       </Card>


       <Card className="shadow-md">
         <CardHeader>
           <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-muted-foreground"/> Shipment History</CardTitle>
            <CardDescription>Latest updates appear first.</CardDescription>
         </CardHeader>
         <CardContent>
            {shipment.history && shipment.history.length > 0 ? (
             <div className="relative pl-6 before:absolute before:left-[0.6875rem] before:top-0 before:h-full before:w-px before:bg-border">
                 {/* History is already sorted newest first */}
                 {shipment.history.map((event, index) => (
                   <div key={index} className="relative mb-6 last:mb-0">
                     {/* Dot indicator */}
                     <div className={`absolute left-[-0.5rem] top-[0.125rem] z-10 flex h-4 w-4 items-center justify-center rounded-full ${index === 0 ? 'bg-primary' : 'bg-muted'}`}>
                       <div className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-primary-foreground' : 'bg-muted-foreground'}`}></div>
                     </div>
                     {/* Content */}
                     <div className="ml-6">
                       <p className="text-sm font-medium">
                         <Badge variant={getShipmentStatusVariant(event.status)} className="mr-2 align-middle">{event.status}</Badge>
                          {event.location && <span className="text-muted-foreground">at {event.location}</span>}
                       </p>
                       <p className="text-xs text-muted-foreground mt-0.5" title={format(new Date(event.timestamp), 'PPP p')}>
                          {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                        </p>
                        {event.notes && <p className="text-xs text-muted-foreground/80 mt-1 italic">Note: {event.notes}</p>}
                     </div>
                   </div>
                 ))}
             </div>
            ) : (
                <p className="text-sm text-muted-foreground italic text-center py-4">No tracking history available yet.</p>
            )}
         </CardContent>
       </Card>

    </div>
  );
}

// Generate dynamic metadata
export async function generateMetadata({ params }: { params: { shipmentId: string } }) {
  const { shipment } = await getShipmentDetails(params.shipmentId);
  return {
    title: shipment ? `Shipment #${shipment.id} | Showroom Manager` : 'Shipment Not Found | Showroom Manager',
  };
}

// Ensure dynamic rendering because data is fetched on each request
export const dynamic = 'force-dynamic';
