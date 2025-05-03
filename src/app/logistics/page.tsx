import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Filter, Search, Truck, Navigation, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Placeholder data - replace with actual data fetching
const shipments = [
  { id: 'SHP-101', orderId: 'ORD-002', carrier: 'FastFreight', trackingNumber: 'FF123456789', status: 'In Transit', origin: 'Warehouse A', destination: '123 Main St', estimatedDelivery: '2024-07-25' },
  { id: 'SHP-102', orderId: 'ORD-004', carrier: 'QuickShip', trackingNumber: 'QS987654321', status: 'Out for Delivery', origin: 'Warehouse B', destination: '456 Oak Ave', estimatedDelivery: '2024-07-22' },
  { id: 'SHP-103', orderId: 'ORD-001', carrier: 'ReliableTrans', trackingNumber: 'RT112233445', status: 'Label Created', origin: 'Showroom', destination: '789 Pine Ln', estimatedDelivery: '2024-07-26' },
  { id: 'SHP-104', orderId: 'ORD-003', carrier: 'FastFreight', trackingNumber: 'FF998877665', status: 'Delivered', origin: 'Warehouse A', destination: '101 Maple Dr', estimatedDelivery: '2024-07-20' },
];

const getShipmentStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  switch (status.toLowerCase()) {
    case 'label created':
      return 'secondary'; // Soft blue/green for initial state
    case 'in transit':
      return 'default'; // Gold for active transit
     case 'out for delivery':
       return 'default'; // Gold for active delivery attempt
    case 'delivered':
      return 'outline'; // Outline for completed
    case 'exception':
      return 'destructive'; // Destructive for issues
    default:
      return 'secondary';
  }
};


export default function LogisticsPage() {
  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Logistics</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Schedule New Shipment
        </Button>
      </div>

       {/* Filters and Search */}
       <div className="mb-6 flex flex-col md:flex-row gap-4">
         <div className="relative flex-grow">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <Input placeholder="Search by Shipment ID, Order ID, or Tracking..." className="pl-10" />
         </div>
         <Select>
           <SelectTrigger className="w-full md:w-[180px]">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
             <SelectValue placeholder="Filter by Status" />
           </SelectTrigger>
           <SelectContent>
             <SelectItem value="all">All Statuses</SelectItem>
             <SelectItem value="label created">Label Created</SelectItem>
             <SelectItem value="in transit">In Transit</SelectItem>
             <SelectItem value="out for delivery">Out for Delivery</SelectItem>
             <SelectItem value="delivered">Delivered</SelectItem>
             <SelectItem value="exception">Exception</SelectItem>
           </SelectContent>
         </Select>
         <Select>
           <SelectTrigger className="w-full md:w-[180px]">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
             <SelectValue placeholder="Filter by Carrier" />
           </SelectTrigger>
           <SelectContent>
             <SelectItem value="all">All Carriers</SelectItem>
             <SelectItem value="fastfreight">FastFreight</SelectItem>
             <SelectItem value="quickship">QuickShip</SelectItem>
             <SelectItem value="reliabletrans">ReliableTrans</SelectItem>
             {/* Add more carriers */}
           </SelectContent>
         </Select>
       </div>

      {/* Shipments Table */}
       <Card>
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
                   <TableCell className="font-medium">{shipment.id}</TableCell>
                   <TableCell>{shipment.orderId}</TableCell>
                   <TableCell>{shipment.carrier}</TableCell>
                   <TableCell>
                      <a href="#" className="text-primary hover:underline" title="Track package (external link placeholder)">
                         {shipment.trackingNumber} <Navigation className="inline h-3 w-3 ml-1" />
                      </a>
                    </TableCell>
                    <TableCell>{shipment.destination}</TableCell>
                    <TableCell>{shipment.estimatedDelivery}</TableCell>
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
                         <DropdownMenuItem>View Details</DropdownMenuItem>
                         <DropdownMenuItem>Update Status</DropdownMenuItem>
                         <DropdownMenuItem>Print Label</DropdownMenuItem>
                         <DropdownMenuSeparator />
                          <DropdownMenuItem>Track Package</DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
         </CardContent>
       </Card>

        {/* Placeholder for when no shipments match filter/search */}
       {shipments.length === 0 && (
         <div className="text-center py-12 text-muted-foreground mt-8">
           <Truck className="mx-auto h-12 w-12 mb-4" />
           <p>No shipments found matching your criteria.</p>
         </div>
       )}

      {/* Potential Future Section: Delivery Schedule */}
      {/* <Card className="mt-8">
          <CardHeader>
            <CardTitle>Upcoming Deliveries</CardTitle>
            <CardDescription>View scheduled customer deliveries.</CardDescription>
          </CardHeader>
          <CardContent>
             <p className="text-muted-foreground">Delivery schedule will appear here.</p>
          </CardContent>
        </Card> */}
    </div>
  );
}
