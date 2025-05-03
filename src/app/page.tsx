import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Box, Package, Truck, TrendingUp, AlertCircle, PackageSearch } from 'lucide-react'; // Added new icons

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-8"> {/* Increased spacing */}
      <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Inventory Items
            </CardTitle>
            <Box className="h-5 w-5 text-muted-foreground" /> {/* Slightly larger icon */}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1,234</div> {/* Larger font */}
            <p className="text-xs text-muted-foreground pt-1">
              +5 since last month
            </p>
          </CardContent>
        </Card>
         <Card className="shadow hover:shadow-md transition-shadow duration-200">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">
               Open Orders
             </CardTitle>
             <Package className="h-5 w-5 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-bold">56</div>
             <p className="text-xs text-muted-foreground pt-1">
               3 new orders today
             </p>
           </CardContent>
         </Card>
         <Card className="shadow hover:shadow-md transition-shadow duration-200">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">
               In Transit Shipments
             </CardTitle>
             <Truck className="h-5 w-5 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-bold">12</div>
             <p className="text-xs text-muted-foreground pt-1">
               2 shipped yesterday
             </p>
           </CardContent>
         </Card>
         <Card className="shadow hover:shadow-md transition-shadow duration-200">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">
               Monthly Sales Trend
             </CardTitle>
             <TrendingUp className="h-5 w-5 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-bold text-green-600">+8.5%</div> {/* Use color for trend */}
             <p className="text-xs text-muted-foreground pt-1">
               Compared to last month
             </p>
           </CardContent>
         </Card>
      </div>

      {/* Info Sections */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card className="shadow hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageSearch className="h-5 w-5 text-primary"/> {/* Icon */}
              Recent Orders
            </CardTitle>
             <CardDescription>A quick view of the latest customer orders.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Order list placeholder - Improved styling */}
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                <div>
                  <p className="font-medium">ORD-006</p>
                  <p className="text-xs text-muted-foreground">Customer: Jane Doe</p>
                </div>
                <p className="text-sm font-semibold">$850.00</p>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                <div>
                  <p className="font-medium">ORD-005</p>
                  <p className="text-xs text-muted-foreground">Customer: Ethan Hunt</p>
                </div>
                <p className="text-sm font-semibold text-destructive">(Cancelled)</p>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                <div>
                  <p className="font-medium">ORD-004</p>
                  <p className="text-xs text-muted-foreground">Customer: Diana Prince</p>
                </div>
                <p className="text-sm font-semibold">$620.00</p>
              </div>
            </div>
             {/* <p className="text-muted-foreground text-center pt-4">Order data will appear here.</p> */}
          </CardContent>
        </Card>
         <Card className="shadow hover:shadow-md transition-shadow duration-200">
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive"/> {/* Icon */}
                Low Stock Items
             </CardTitle>
             <CardDescription>Items needing attention or reordering.</CardDescription>
           </CardHeader>
           <CardContent>
             {/* Low stock list placeholder - Improved styling */}
             <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-destructive/10 rounded-md">
                    <div>
                        <p className="font-medium">Minimalist Pine Door (MIN-PIN-3078)</p>
                        <p className="text-xs text-muted-foreground">Style: Minimalist / Material: Pine</p>
                    </div>
                    <p className="text-sm font-semibold text-destructive">2 units left</p>
                </div>
                <div className="flex justify-between items-center p-3 bg-destructive/10 rounded-md">
                    <div>
                        <p className="font-medium">Modern Oak Door (MOD-OAK-3680)</p>
                        <p className="text-xs text-muted-foreground">Style: Modern / Material: Oak</p>
                    </div>
                     <p className="text-sm font-semibold text-destructive">5 units left</p>
                </div>
             </div>
             {/* <p className="text-muted-foreground text-center pt-4">Low stock alerts will appear here.</p> */}
           </CardContent>
         </Card>
      </div>
    </div>
  );
}
