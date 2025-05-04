
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Box, Package, Truck, TrendingUp, AlertCircle, PackageSearch, AlertTriangle } from 'lucide-react'; // Added new icons
import { db, collection, getDocs, Timestamp, query, where, orderBy, limit, getCountFromServer } from '@/lib/firebase/firebase'; // Import Firestore functions
import Link from 'next/link';
import type { AddItemInput } from '@/schemas/inventory'; // Import item type
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components

interface InventoryItemSummary {
  id: string;
  name: string;
  sku: string;
  stock: number;
  style: string;
  material: string;
}

// Function to fetch dashboard data
async function getDashboardData() {
  let totalItems = 0;
  let lowStockItems: InventoryItemSummary[] = [];
  let error: string | null = null;

  if (!db) {
    const errorMessage = "Database initialization failed. Cannot fetch dashboard data.";
    console.error(errorMessage);
    return { totalItems, lowStockItems, error: errorMessage };
  }

  try {
    const inventoryCollectionRef = collection(db, 'inventory');

    // 1. Get total item count
    const countSnapshot = await getCountFromServer(inventoryCollectionRef);
    totalItems = countSnapshot.data().count;

    // 2. Get low stock items (e.g., stock < 10)
    const lowStockQuery = query(
      inventoryCollectionRef,
      where('stock', '<', 10),
      orderBy('stock', 'asc'), // Show lowest stock first
      limit(5) // Limit to 5 items
    );
    const lowStockSnapshot = await getDocs(lowStockQuery);
    lowStockSnapshot.forEach((doc) => {
      const data = doc.data() as AddItemInput; // Assuming AddItemInput has the necessary fields
      lowStockItems.push({
        id: doc.id,
        name: data.name,
        sku: data.sku,
        stock: data.stock,
        style: data.style,
        material: data.material,
      });
    });

  } catch (fetchError) {
    const errorMessage = `Error fetching dashboard data: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`;
    console.error(errorMessage);
    error = "Failed to load some dashboard data due to a database error.";
     if (fetchError instanceof Error && fetchError.message.toLowerCase().includes("index")) { // More robust check for index errors
         error = "Firestore query failed: A required index is missing. Please create the necessary index in the Firebase console (Firestore Database > Indexes).";
         console.warn(error);
     }
  }

  // Placeholder data for other cards until integrated
  const openOrdersCount = 56; // Placeholder
  const inTransitShipmentsCount = 12; // Placeholder
  const monthlySalesTrend = "+8.5%"; // Placeholder
  const recentOrders = [ // Placeholder
      { id: 'ORD-006', customer: 'Jane Doe', total: 850.00, status: 'Processing' },
      { id: 'ORD-005', customer: 'Ethan Hunt', total: 0, status: 'Cancelled' },
      { id: 'ORD-004', customer: 'Diana Prince', total: 620.00, status: 'Delivered' },
  ];


  return { totalItems, lowStockItems, openOrdersCount, inTransitShipmentsCount, monthlySalesTrend, recentOrders, error };
}


export default async function DashboardPage() {
  const {
      totalItems,
      lowStockItems,
      openOrdersCount, // Using placeholder
      inTransitShipmentsCount, // Using placeholder
      monthlySalesTrend, // Using placeholder
      recentOrders, // Using placeholder
      error: fetchError
    } = await getDashboardData();

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-8">
      <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>

       {/* Display Error if fetching failed */}
       {fetchError && (
          <Alert variant="destructive" className="mb-6">
             <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Error Loading Dashboard Data</AlertTitle>
             <AlertDescription>
               {fetchError}
               {fetchError.includes("initialization failed") && (
                 <span className="block mt-2 text-xs">
                   Please verify your Firebase setup in `.env.local` and restart the application.
                 </span>
               )}
               {fetchError.includes("index") && (
                 <span className="block mt-2 text-xs">
                   A Firestore index might be required for filtering/sorting low stock items. Check the console logs for details and create the index in Firebase.
                 </span>
               )}
             </AlertDescription>
           </Alert>
       )}

      {/* Stats Grid - Now includes dynamic Total Inventory */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Inventory Items
            </CardTitle>
            <Box className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalItems}</div>
            {/* Optional: Add comparison logic later */}
            {/* <p className="text-xs text-muted-foreground pt-1">+5 since last month</p> */}
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
             {/* Placeholder Value */}
             <div className="text-3xl font-bold">{openOrdersCount}</div>
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
             {/* Placeholder Value */}
             <div className="text-3xl font-bold">{inTransitShipmentsCount}</div>
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
             {/* Placeholder Value */}
             <div className="text-3xl font-bold text-green-600">{monthlySalesTrend}</div>
             <p className="text-xs text-muted-foreground pt-1">
               Compared to last month
             </p>
           </CardContent>
         </Card>
      </div>

      {/* Info Sections - Now includes dynamic Low Stock Items */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card className="shadow hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageSearch className="h-5 w-5 text-primary"/>
              Recent Orders (Placeholder)
            </CardTitle>
             <CardDescription>A quick view of the latest customer orders.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentOrders.map(order => (
                 <div key={order.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <div>
                      <p className="font-medium">{order.id}</p>
                      <p className="text-xs text-muted-foreground">Customer: {order.customer}</p>
                    </div>
                    {order.status === 'Cancelled' ? (
                         <p className="text-sm font-semibold text-destructive">({order.status})</p>
                    ) : (
                         <p className="text-sm font-semibold">${order.total.toFixed(2)}</p>
                    )}
                  </div>
              ))}
            </div>
          </CardContent>
        </Card>

         <Card className="shadow hover:shadow-md transition-shadow duration-200">
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive"/>
                Low Stock Items
             </CardTitle>
             <CardDescription>Items needing attention or reordering (Top 5).</CardDescription>
           </CardHeader>
           <CardContent>
             {lowStockItems.length > 0 ? (
               <div className="space-y-3">
                 {lowStockItems.map(item => (
                   <div key={item.id} className="flex justify-between items-center p-3 bg-destructive/10 rounded-md">
                       <div className="flex-1 overflow-hidden mr-2">
                           {/* Link to the inventory item page */}
                            <Link href={`/inventory/${item.id}`} className="font-medium hover:underline truncate" title={`${item.name} (${item.sku})`}>
                                {item.name} ({item.sku})
                           </Link>
                           <p className="text-xs text-muted-foreground truncate">{item.style} / {item.material}</p>
                       </div>
                       <p className="text-sm font-semibold text-destructive shrink-0">{item.stock} units left</p>
                   </div>
                 ))}
               </div>
              ) : (
                 <p className="text-muted-foreground text-center pt-4 italic">No items currently low on stock.</p>
              )}
           </CardContent>
         </Card>
      </div>
    </div>
  );
}

// Add metadata if needed
export const metadata = {
  title: 'Dashboard | Showroom Manager',
  description: 'Overview of inventory, orders, and logistics.',
};

// Ensure dynamic rendering because data is fetched on each request
export const dynamic = 'force-dynamic';
