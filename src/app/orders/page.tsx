import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Filter, Search, Package, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Placeholder data - replace with actual data fetching
const orders = [
  { id: 'ORD-001', customer: 'Alice Smith', date: '2024-07-20', total: 450.00, status: 'Processing', items: 1 },
  { id: 'ORD-002', customer: 'Bob Johnson', date: '2024-07-19', total: 1200.00, status: 'Shipped', items: 1 },
  { id: 'ORD-003', customer: 'Charlie Brown', date: '2024-07-18', total: 350.00, status: 'Delivered', items: 1 },
  { id: 'ORD-004', customer: 'Diana Prince', date: '2024-07-17', total: 620.00, status: 'Processing', items: 1 },
  { id: 'ORD-005', customer: 'Ethan Hunt', date: '2024-07-16', total: 750.00, status: 'Cancelled', items: 2 },
];

const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  switch (status.toLowerCase()) {
    case 'processing':
      return 'default'; // Using primary (gold) for processing
    case 'shipped':
      return 'secondary'; // Using soft blue/green
    case 'delivered':
      return 'outline'; // Simple outline for completed
    case 'cancelled':
      return 'destructive';
    default:
      return 'secondary';
  }
};

export default function OrdersPage() {
  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Orders</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Order
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
         <div className="relative flex-grow">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <Input placeholder="Search by Order ID or Customer..." className="pl-10" />
         </div>
        <Select>
          <SelectTrigger className="w-full md:w-[180px]">
             <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {/* Add Date Range Filter if needed */}
      </div>

      {/* Orders Table */}
       <Card>
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
                   <TableCell className="font-medium">{order.id}</TableCell>
                   <TableCell>{order.customer}</TableCell>
                   <TableCell>{order.date}</TableCell>
                   <TableCell className="text-right">${order.total.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{order.items}</TableCell>
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
                         <DropdownMenuItem>View Details</DropdownMenuItem>
                         <DropdownMenuItem>Update Status</DropdownMenuItem>
                         <DropdownMenuSeparator />
                         <DropdownMenuItem className="text-destructive">Cancel Order</DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
         </CardContent>
       </Card>

       {/* Placeholder for when no orders match filter/search */}
       {orders.length === 0 && (
         <div className="text-center py-12 text-muted-foreground mt-8">
           <Package className="mx-auto h-12 w-12 mb-4" />
           <p>No orders found matching your criteria.</p>
         </div>
       )}
    </div>
  );
}
