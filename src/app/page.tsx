import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Box, Package, Truck, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Inventory Items
            </CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">
              +5 since last month
            </p>
          </CardContent>
        </Card>
         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">
               Open Orders
             </CardTitle>
             <Package className="h-4 w-4 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">56</div>
             <p className="text-xs text-muted-foreground">
               3 new orders today
             </p>
           </CardContent>
         </Card>
         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">
               In Transit Shipments
             </CardTitle>
             <Truck className="h-4 w-4 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">12</div>
             <p className="text-xs text-muted-foreground">
               2 shipped yesterday
             </p>
           </CardContent>
         </Card>
         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">
               Monthly Sales Trend
             </CardTitle>
             <TrendingUp className="h-4 w-4 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">+8.5%</div>
             <p className="text-xs text-muted-foreground">
               Compared to last month
             </p>
           </CardContent>
         </Card>
      </div>

      {/* Placeholder for more dashboard components like recent orders, charts, etc. */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
             <CardDescription>A quick view of the latest customer orders.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Order list placeholder */}
            <p className="text-muted-foreground">Order data will appear here.</p>
          </CardContent>
        </Card>
         <Card className="lg:col-span-1">
           <CardHeader>
             <CardTitle>Low Stock Items</CardTitle>
             <CardDescription>Items needing attention or reordering.</CardDescription>
           </CardHeader>
           <CardContent>
             {/* Low stock list placeholder */}
             <p className="text-muted-foreground">Low stock alerts will appear here.</p>
           </CardContent>
         </Card>
      </div>
    </div>
  );
}
