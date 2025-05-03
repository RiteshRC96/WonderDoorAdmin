import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Printer, Package, User, MapPin, Calendar, Hash, Navigation } from 'lucide-react';
import Link from 'next/link';

// Placeholder data fetching function - replace with actual data logic
async function getShipmentDetails(shipmentId: string) {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 50));
  const shipments = [
     { id: 'SHP-101', orderId: 'ORD-002', customer: 'Bob Johnson', carrier: 'FastFreight', trackingNumber: 'FF123456789', status: 'In Transit', origin: 'Warehouse A, 10 Industrial Way', destination: '123 Main St, Sometown, USA 67890', estimatedDelivery: '2024-07-25', actualDelivery: null, pieces: 1, weight: '150 lbs', dimensions: '86x37x34', notes: 'Handle with care.', history: [ {timestamp: '2024-07-20 10:00', status: 'Picked Up', location: 'Warehouse A'}, {timestamp: '2024-07-21 08:30', status: 'Departed Hub', location: 'Central Hub'}, {timestamp: '2024-07-22 05:15', status: 'Arrived at Destination Hub', location: 'Sometown Hub'} ] },
    { id: 'SHP-102', orderId: 'ORD-004', customer: 'Diana Prince', carrier: 'QuickShip', trackingNumber: 'QS987654321', status: 'Out for Delivery', origin: 'Warehouse B, 20 Commerce Dr', destination: '456 Oak Ave, Cityville, USA 44556', estimatedDelivery: '2024-07-22', actualDelivery: null, pieces: 1, weight: '65 lbs', dimensions: '34x82x4', notes: 'Signature required.', history: [ {timestamp: '2024-07-18 14:00', status: 'Label Created', location: 'Warehouse B'}, {timestamp: '2024-07-19 09:00', status: 'Picked Up', location: 'Warehouse B'}, {timestamp: '2024-07-21 18:00', status: 'Arrived at Local Facility', location: 'Cityville Post'}, {timestamp: '2024-07-22 07:00', status: 'Out for Delivery', location: 'Cityville Post'} ] },
    { id: 'SHP-103', orderId: 'ORD-001', customer: 'Alice Smith', carrier: 'ReliableTrans', trackingNumber: 'RT112233445', status: 'Label Created', origin: 'Showroom, 5 Main Plaza', destination: '789 Pine Ln, Anytown, USA 12345', estimatedDelivery: '2024-07-26', actualDelivery: null, pieces: 1, weight: '55 lbs', dimensions: '38x82x3', notes: '', history: [ {timestamp: '2024-07-21 16:30', status: 'Label Created', location: 'Showroom'} ] },
    { id: 'SHP-104', orderId: 'ORD-003', customer: 'Charlie Brown', carrier: 'FastFreight', trackingNumber: 'FF998877665', status: 'Delivered', origin: 'Warehouse A, 10 Industrial Way', destination: '101 Maple Dr, Villagetown, USA 11223', estimatedDelivery: '2024-07-20', actualDelivery: '2024-07-20 11:45', pieces: 1, weight: '70 lbs', dimensions: '50x26x20', notes: 'Left at front porch.', history: [ {timestamp: '2024-07-19 11:00', status: 'Picked Up', location: 'Warehouse A'}, {timestamp: '2024-07-20 08:00', status: 'Out for Delivery', location: 'Villagetown Hub'}, {timestamp: '2024-07-20 11:45', status: 'Delivered', location: '101 Maple Dr'} ] },
  ];
  return shipments.find(ship => ship.id === shipmentId);
}

const getShipmentStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  switch (status.toLowerCase()) {
    case 'label created':
      return 'secondary';
    case 'picked up':
    case 'departed hub':
    case 'arrived at destination hub':
    case 'arrived at local facility':
    case 'in transit':
    case 'out for delivery':
      return 'default'; // Gold for active states
    case 'delivered':
      return 'outline'; // Outline for completed
    case 'exception':
      return 'destructive';
    default:
      return 'secondary';
  }
};


export default async function ShipmentDetailPage({ params }: { params: { shipmentId: string } }) {
  const shipment = await getShipmentDetails(params.shipmentId);

  if (!shipment) {
    return <div className="container mx-auto py-6 text-center text-destructive">Shipment not found.</div>;
  }

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-6">
       <div className="flex items-center justify-between">
         <Button variant="outline" size="sm" asChild>
           <Link href="/logistics">
             <ArrowLeft className="mr-2 h-4 w-4" />
             Back to Logistics
           </Link>
         </Button>
          <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                 <a href="#" target="_blank" rel="noopener noreferrer" title="Track on carrier website (placeholder)"> {/* Replace # with actual tracking URL builder */}
                     <Navigation className="mr-2 h-4 w-4" />
                     Track Externally
                 </a>
              </Button>
             <Button size="sm">
                 <Edit className="mr-2 h-4 w-4" />
                 Update Shipment
             </Button>
          </div>
       </div>

       <Card>
         <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
               <CardTitle className="text-2xl font-bold">Shipment {shipment.id}</CardTitle>
                <CardDescription className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4"/> For Order <Link href={`/orders/${shipment.orderId}`} className="text-primary hover:underline">{shipment.orderId}</Link>
                </CardDescription>
            </div>
            <Badge variant={getShipmentStatusVariant(shipment.status)} className="text-lg px-4 py-1">{shipment.status}</Badge>
         </CardHeader>
          <Separator />
          <CardContent className="pt-6 grid md:grid-cols-3 gap-6">
             {/* Shipment Info */}
             <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Hash className="h-5 w-5 text-muted-foreground" /> Shipment Details</h3>
                <p className="text-sm"><span className="text-muted-foreground">Carrier:</span> {shipment.carrier}</p>
                <p className="text-sm"><span className="text-muted-foreground">Tracking #:</span> {shipment.trackingNumber}</p>
                 <p className="text-sm"><span className="text-muted-foreground">Pieces:</span> {shipment.pieces}</p>
                 <p className="text-sm"><span className="text-muted-foreground">Weight:</span> {shipment.weight}</p>
                 <p className="text-sm"><span className="text-muted-foreground">Dimensions:</span> {shipment.dimensions}</p>
                 {shipment.notes && <p className="text-sm pt-1"><span className="text-muted-foreground">Notes:</span> {shipment.notes}</p>}
             </div>

              {/* Origin/Destination */}
             <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2"><MapPin className="h-5 w-5 text-muted-foreground" /> Origin & Destination</h3>
                <p className="text-sm font-medium">From:</p>
                <p className="text-sm text-muted-foreground">{shipment.origin}</p>
                <p className="text-sm font-medium mt-2">To:</p>
                <p className="text-sm text-muted-foreground">{shipment.destination}</p>
                 <p className="text-sm text-muted-foreground">Customer: {shipment.customer}</p>
             </div>

              {/* Dates */}
             <div className="space-y-2">
                 <h3 className="text-lg font-semibold flex items-center gap-2"><Calendar className="h-5 w-5 text-muted-foreground" /> Dates</h3>
                 <p className="text-sm"><span className="text-muted-foreground">Estimated Delivery:</span> {shipment.estimatedDelivery}</p>
                 {shipment.actualDelivery ? (
                     <p className="text-sm"><span className="text-muted-foreground">Actual Delivery:</span> {shipment.actualDelivery}</p>
                 ) : (
                    <p className="text-sm text-muted-foreground">Not yet delivered.</p>
                 )}
             </div>
          </CardContent>
       </Card>


       <Card>
         <CardHeader>
           <CardTitle>Shipment History</CardTitle>
         </CardHeader>
         <CardContent>
            {shipment.history && shipment.history.length > 0 ? (
             <div className="relative pl-6 before:absolute before:left-[0.6875rem] before:top-0 before:h-full before:w-px before:bg-border">
                 {shipment.history.slice().reverse().map((event, index) => ( // Reverse to show latest first
                   <div key={index} className="relative mb-6 last:mb-0">
                     <div className="absolute left-[-0.5rem] top-[0.125rem] z-10 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                        <div className="h-2 w-2 rounded-full bg-primary-foreground"></div>
                      </div>
                     <div className="ml-6">
                       <p className="text-sm font-medium">
                         <Badge variant={getShipmentStatusVariant(event.status)} className="mr-2">{event.status}</Badge>
                         at {event.location}
                       </p>
                       <p className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</p>
                     </div>
                   </div>
                 ))}
             </div>
            ) : (
                <p className="text-sm text-muted-foreground">No tracking history available yet.</p>
            )}
         </CardContent>
       </Card>

    </div>
  );
}

// Optional: Add dynamic metadata generation
// export async function generateMetadata({ params }: { params: { shipmentId: string } }) {
//   const shipment = await getShipmentDetails(params.shipmentId);
//   return {
//     title: shipment ? `Shipment ${shipment.id} | Showroom Manager` : 'Shipment Details | Showroom Manager',
//   };
// }
