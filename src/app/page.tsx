
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Box, Package, Truck, TrendingUp, AlertCircle, PackageSearch, AlertTriangle, BarChart, PieChart as PieChartIcon } from 'lucide-react'; // Added chart icons
import { db, collection, getDocs, Timestamp, query, where, orderBy, limit, getCountFromServer } from '@/lib/firebase/firebase'; // Import Firestore functions
import Link from 'next/link';
import type { AddItemInput } from '@/schemas/inventory'; // Import item type
import type { Order } from '@/schemas/order'; // Import order type
import type { Shipment } from '@/schemas/shipment'; // Import shipment type
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import { InventoryCategoryPieChart, type InventoryCategoryData } from '@/components/charts/inventory-category-pie-chart';
import { OrderStatusBarChart, type OrderStatusData } from '@/components/charts/order-status-bar-chart';
import { inventoryChartConfig, orderStatusChartConfig } from '@/components/charts/chart-configs';

interface InventoryItemSummary {
  id: string;
  name: string;
  sku: string;
  stock: number;
  style: string;
  material: string;
}

// Function to fetch dashboard data dynamically
async function getDashboardData() {
  let totalItems = 0;
  let lowStockItems: InventoryItemSummary[] = [];
  let openOrdersCount = 0;
  let inTransitShipmentsCount = 0;
  let inventoryByCategory: InventoryCategoryData[] = [];
  let ordersByStatus: OrderStatusData[] = [];
  let error: string | null = null;
  const monthlySalesTrend = "+0.0%"; // Placeholder - Complex to calculate accurately without historical aggregation
  let recentOrders: Order[] = []; // Placeholder - Can be implemented later if needed

  if (!db) {
    const errorMessage = "Database initialization failed. Cannot fetch dashboard data.";
    console.error(errorMessage);
    return {
      totalItems,
      lowStockItems,
      openOrdersCount,
      inTransitShipmentsCount,
      monthlySalesTrend,
      recentOrders,
      inventoryByCategory,
      ordersByStatus,
      error: errorMessage,
    };
  }

  try {
    // --- Inventory Data ---
    const inventoryCollectionRef = collection(db, 'inventory');
    // 1. Get total item count
    const countSnapshot = await getCountFromServer(inventoryCollectionRef);
    totalItems = countSnapshot.data().count;

    // 2. Get low stock items (stock < 10)
    const lowStockQuery = query(
      inventoryCollectionRef,
      where('stock', '<', 10),
      orderBy('stock', 'asc'),
      limit(5)
    );
    const lowStockSnapshot = await getDocs(lowStockQuery);
    lowStockSnapshot.forEach((doc) => {
      const data = doc.data() as AddItemInput;
      lowStockItems.push({
        id: doc.id,
        name: data.name,
        sku: data.sku,
        stock: data.stock,
        style: data.style,
        material: data.material,
      });
    });

    // 3. Aggregate inventory by category (style) for Pie Chart
    const allInventorySnapshot = await getDocs(inventoryCollectionRef);
    const categoryCounts: { [key: string]: number } = {};
    allInventorySnapshot.forEach(doc => {
        const item = doc.data() as AddItemInput;
        const category = item.style || 'Uncategorized';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    // Map to chart data format, limiting categories for clarity
    const sortedCategories = Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a); // Sort descending by count
    const topCategories = sortedCategories.slice(0, 4);
    const otherCount = sortedCategories.slice(4).reduce((sum, [, count]) => sum + count, 0);

    inventoryByCategory = topCategories.map(([category, count], index) => ({
        category,
        count,
        fill: `var(--color-${inventoryChartConfig[category.toLowerCase() as keyof typeof inventoryChartConfig]?.label?.toLowerCase() || `chart-${index + 1}`})` // Map to config or default chart colors
    }));
     if (otherCount > 0) {
        inventoryByCategory.push({ category: 'Other', count: otherCount, fill: 'var(--color-other)' });
     }


    // --- Order Data ---
    const ordersCollectionRef = collection(db, 'orders');
    // 1. Get open orders count ('Processing' or 'Pending Payment')
    const openOrderQuery = query(ordersCollectionRef, where('status', 'in', ['Processing', 'Pending Payment']));
    const openOrderSnapshot = await getCountFromServer(openOrderQuery);
    openOrdersCount = openOrderSnapshot.data().count;

    // 2. Aggregate orders by status for Bar Chart
    const allOrdersSnapshot = await getDocs(ordersCollectionRef);
    const statusCounts: { [key: string]: number } = {};
     allOrdersSnapshot.forEach(doc => {
         const order = doc.data() as Order;
         const status = order.status;
         statusCounts[status] = (statusCounts[status] || 0) + 1;
     });

    ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        fill: `var(--color-${orderStatusChartConfig[status.toLowerCase() as keyof typeof orderStatusChartConfig]?.label?.toLowerCase() || 'other'})` // Map to config or fallback
    }));
    // Ensure all defined statuses in config are present, even if count is 0
    Object.keys(orderStatusChartConfig).forEach(key => {
        if (key !== 'count' && !ordersByStatus.some(s => s.status.toLowerCase() === key.toLowerCase())) {
            const configEntry = orderStatusChartConfig[key as keyof typeof orderStatusChartConfig];
            if(configEntry.label){
                ordersByStatus.push({ status: configEntry.label as string, count: 0, fill: `var(--color-${key})` });
            }
        }
    });


    // --- Shipment Data ---
    const shipmentsCollectionRef = collection(db, 'shipments');
    // 1. Get in-transit shipments count ('In Transit', 'Out for Delivery')
    const inTransitQuery = query(shipmentsCollectionRef, where('status', 'in', ['In Transit', 'Out for Delivery']));
    const inTransitSnapshot = await getCountFromServer(inTransitQuery);
    inTransitShipmentsCount = inTransitSnapshot.data().count;


  } catch (fetchError) {
    let specificErrorMessage = "Failed to load some dashboard data due to a database error.";
    if (fetchError instanceof Error) {
        specificErrorMessage = `Error fetching dashboard data: ${fetchError.message}`;
        if (fetchError.message.toLowerCase().includes("index")) {
            specificErrorMessage += " A required Firestore index might be missing. Please check the Firebase console (Firestore Database > Indexes).";
        } else if (fetchError.message.toLowerCase().includes("permission")) {
            specificErrorMessage += " Check Firestore security rules.";
        }
    }
    console.error(specificErrorMessage);
    error = specificErrorMessage;
  }


  return {
      totalItems,
      lowStockItems,
      openOrdersCount,
      inTransitShipmentsCount,
      monthlySalesTrend, // Still placeholder
      recentOrders, // Still placeholder
      inventoryByCategory,
      ordersByStatus,
      error
    };
}


export default async function DashboardPage() {
  const {
      totalItems,
      lowStockItems,
      openOrdersCount,
      inTransitShipmentsCount,
      monthlySalesTrend,
      recentOrders, // Placeholder usage
      error: fetchError,
      inventoryByCategory,
      ordersByStatus,
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
                   A Firestore index might be required. Check the error details and create the index in Firebase.
                 </span>
               )}
               {fetchError.includes("permission") && (
                 <span className="block mt-2 text-xs">
                   Check your Firestore security rules in the Firebase console.
                 </span>
               )}
             </AlertDescription>
           </Alert>
       )}

      {/* Stats Grid - Now includes dynamic counts */}
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
             <div className="text-3xl font-bold">{openOrdersCount}</div>
             {/* <p className="text-xs text-muted-foreground pt-1"> 3 new orders today </p> */}
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
             <div className="text-3xl font-bold">{inTransitShipmentsCount}</div>
             {/* <p className="text-xs text-muted-foreground pt-1"> 2 shipped yesterday </p> */}
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
             <div className="text-3xl font-bold text-green-600">{monthlySalesTrend}</div>
             <p className="text-xs text-muted-foreground pt-1">
               Compared to last month (Placeholder)
             </p>
           </CardContent>
         </Card>
      </div>

      {/* Chart Row */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
             <Card className="shadow hover:shadow-md transition-shadow duration-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <PieChartIcon className="h-5 w-5 text-primary"/>
                        Inventory by Category
                    </CardTitle>
                    <CardDescription>Distribution of items across different styles.</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                    {inventoryByCategory.length > 0 ? (
                         <InventoryCategoryPieChart data={inventoryByCategory} config={inventoryChartConfig} />
                    ) : (
                         <p className="text-muted-foreground text-center py-10 italic">No inventory data for chart.</p>
                    )}
                </CardContent>
             </Card>

             <Card className="shadow hover:shadow-md transition-shadow duration-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart className="h-5 w-5 text-primary"/>
                        Order Status Overview
                    </CardTitle>
                    <CardDescription>Current count of orders by status.</CardDescription>
                </CardHeader>
                <CardContent>
                     {ordersByStatus.length > 0 ? (
                        <OrderStatusBarChart data={ordersByStatus} config={orderStatusChartConfig} />
                    ) : (
                         <p className="text-muted-foreground text-center py-10 italic">No order data for chart.</p>
                    )}
                </CardContent>
            </Card>
        </div>


      {/* Info Sections - Low Stock & Recent Orders */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
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
               <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                 {lowStockItems.map(item => (
                   <div key={item.id} className="flex justify-between items-center p-3 bg-destructive/10 rounded-md">
                       <div className="flex-1 overflow-hidden mr-2">
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

         <Card className="shadow hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageSearch className="h-5 w-5 text-primary"/>
              Recent Orders (Placeholder)
            </CardTitle>
             <CardDescription>A quick view of the latest customer orders.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
              {/* Replace placeholder with actual recent orders fetched from DB if needed */}
              {recentOrders.length > 0 ? recentOrders.map(order => (
                 <div key={order.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <div>
                      <Link href={`/orders/${order.id}`} className="font-medium hover:underline">{order.id.substring(0, 8)}...</Link>
                      <p className="text-xs text-muted-foreground">Customer: {order.customer.name}</p>
                    </div>
                    {order.status === 'Cancelled' ? (
                         <p className="text-sm font-semibold text-destructive">({order.status})</p>
                    ) : (
                         <p className="text-sm font-semibold">${order.total.toFixed(2)}</p>
                    )}
                  </div>
              )) : (
                 <p className="text-muted-foreground text-center pt-4 italic">No recent orders found.</p>
                )}
            </div>
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
