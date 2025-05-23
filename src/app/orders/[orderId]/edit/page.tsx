import { EditOrderForm } from "@/components/orders/edit-order-form";
import { ArrowLeft, Home, ChevronRight, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { db, doc, getDoc, Timestamp, collection, getDocs } from '@/lib/firebase/firebase';
import type { Order, OrderInput, PaymentStatusEnum } from '@/schemas/order'; // Import needed types
import type { AddItemInput } from '@/schemas/inventory';
import { notFound } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define the structure of an inventory item for selection in the edit form
interface InventorySelectItem extends AddItemInput {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

// Define a type for the Order object with serializable dates
interface SerializableOrder extends Omit<Order, 'orderDate' | 'createdAt' | 'updatedAt'> {
  orderDate: string; // ISO string
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string or undefined
}


// Function to fetch a single order's details for editing
async function getOrderForEdit(orderId: string): Promise<{ order: SerializableOrder | null; error?: string }> {
  if (!db) {
    const errorMessage = "Database configuration error. Unable to fetch order details.";
    console.error(errorMessage);
    return { order: null, error: "Database initialization failed." };
  }

  try {
    const orderDocRef = doc(db, 'orders', orderId);
    const docSnap = await getDoc(orderDocRef);

    if (!docSnap.exists()) {
      return { order: null }; // Not found
    }

    // Use the Order type for initial fetching
    const data = docSnap.data() as Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'orderDate'> & { orderDate?: Timestamp, createdAt?: Timestamp, updatedAt?: Timestamp };

    // Convert Timestamps to ISO strings for serialization
    const orderDateISO = data.orderDate instanceof Timestamp ? data.orderDate.toDate().toISOString() : new Date().toISOString();
    const createdAtISO = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : orderDateISO; // Use orderDate as fallback
    const updatedAtISO = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined;


    // Construct the serializable order data
    const serializableOrderData: SerializableOrder = {
      id: docSnap.id,
      // Spread the rest of the data, ensuring types match SerializableOrder expectations
      items: data.items || [],
      paymentInfo: data.paymentInfo || { paymentMethod: 'Pending' }, // Ensure paymentInfo exists
      shippingInfo: data.shippingInfo || { name: '', address: '', city: '', state: '', zipCode: '' }, // Ensure shippingInfo exists
      status: data.status || 'Processing',
      totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
      trackingInfo: data.trackingInfo,
      userId: data.userId || '',
      // Add serializable dates
      orderDate: orderDateISO,
      createdAt: createdAtISO,
      updatedAt: updatedAtISO,
       // Re-calculate compatibility fields based on fetched data if needed
       total: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
       customer: {
           name: data.shippingInfo?.name || 'N/A',
           email: data.shippingInfo?.email,
           phone: data.shippingInfo?.phone,
           address: data.shippingInfo?.address || 'N/A',
           city: data.shippingInfo?.city,
           state: data.shippingInfo?.state,
           zipCode: data.shippingInfo?.zipCode,
       },
       paymentStatus: data.paymentInfo?.paymentMethod || data.status,
       shipmentId: data.trackingInfo?.trackingNumber,
       shippingMethod: data.trackingInfo?.carrier,

    };

    return { order: serializableOrderData };

  } catch (error) {
    const errorMessage = `Error fetching order for edit (ID ${orderId}): ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return { order: null, error: "Failed to load order data for editing." };
  }
}

// Function to fetch inventory items for selection (copied from create order page)
async function getInventoryItemsForSelection(): Promise<{ items: InventorySelectItem[]; error?: string }> {
    if (!db) {
      const errorMessage = "Database initialization failed. Cannot fetch inventory for order editing.";
      console.error(errorMessage);
      return { items: [], error: "Database initialization failed." };
    }

    try {
      const inventoryCollectionRef = collection(db, 'inventory');
      const querySnapshot = await getDocs(inventoryCollectionRef);
      const items: InventorySelectItem[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as AddItemInput & { createdAt?: Timestamp, updatedAt?: Timestamp };
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined;
        const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined;
        const { createdAt: _, updatedAt: __, ...restData } = data;
        // Ensure stock and price are numbers, provide defaults if missing/invalid
        const stock = typeof data.stock === 'number' ? data.stock : 0;
        const price = typeof data.price === 'number' ? data.price : 0;
        items.push({
            id: doc.id,
             ...restData,
             stock, // Use validated/defaulted stock
             price, // Use validated/defaulted price
             createdAt,
             updatedAt
        });
      });
      return { items };
    } catch (error) {
      const errorMessage = `Error fetching inventory items for selection: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      return { items: [], error: "Failed to load inventory data." };
    }
}


export default async function EditOrderPage({ params }: { params: { orderId: string } }) {
  // Fetch serializable order data
  const { order, error: orderFetchError } = await getOrderForEdit(params.orderId);
  const { items: inventoryItems, error: inventoryFetchError } = await getInventoryItemsForSelection();
  const fetchError = orderFetchError || inventoryFetchError;

  // Handle fetch error first
  if (fetchError) {
     return (
       <div className="container mx-auto py-6 space-y-6">
         {/* Breadcrumbs for Error Page */}
         <Breadcrumb>
           <BreadcrumbList>
             <BreadcrumbItem><BreadcrumbLink asChild><Link href="/"><Home className="h-4 w-4"/></Link></BreadcrumbLink></BreadcrumbItem>
             <BreadcrumbSeparator />
             <BreadcrumbItem><BreadcrumbLink asChild><Link href="/orders">Orders</Link></BreadcrumbLink></BreadcrumbItem>
             <BreadcrumbSeparator />
             <BreadcrumbItem><BreadcrumbPage>Error</BreadcrumbPage></BreadcrumbItem>
           </BreadcrumbList>
         </Breadcrumb>
         <Alert variant="destructive">
           <AlertTriangle className="h-4 w-4" />
           <AlertTitle>Error Loading Data for Editing</AlertTitle>
           <AlertDescription>
             {fetchError}
              {fetchError?.includes("initialization failed") && (
                <span className="block mt-2 text-xs">
                  Please verify your Firebase setup in `.env.local` and restart the application.
                </span>
              )}
            </AlertDescription>
         </Alert>
       </div>
     );
  }

  // If no error but order is null, then it's not found
  if (!order) {
    notFound();
  }

  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in space-y-6">
       {/* Breadcrumbs */}
        <Breadcrumb>
           <BreadcrumbList>
             <BreadcrumbItem>
               <BreadcrumbLink asChild><Link href="/"><Home className="h-4 w-4"/></Link></BreadcrumbLink>
             </BreadcrumbItem>
             <BreadcrumbSeparator />
              <BreadcrumbItem>
               <BreadcrumbLink asChild><Link href="/orders">Orders</Link></BreadcrumbLink>
             </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                    {/* Link back to the order detail page */}
                   <Link href={`/orders/${order.id}`} className="truncate max-w-xs">Order {order.id.substring(0, 8)}...</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
             <BreadcrumbSeparator />
             <BreadcrumbItem>
               <BreadcrumbPage>Edit</BreadcrumbPage>
             </BreadcrumbItem>
           </BreadcrumbList>
         </Breadcrumb>

       {/* Back Button */}
       <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" asChild>
            {/* Link back to the specific order detail page */}
           <Link href={`/orders/${order.id}`}>
             <ArrowLeft className="mr-2 h-4 w-4" />
             Back to Order Details
           </Link>
         </Button>
          <h1 className="text-2xl font-semibold text-foreground hidden md:block">Edit Order</h1>
       </div>

       {/* Edit Form Component - Pass the serializable order and inventory data */}
       <EditOrderForm order={order} inventoryItems={inventoryItems} />
    </div>
  );
}

// Generate dynamic metadata
export async function generateMetadata({ params }: { params: { orderId: string } }) {
  // Fetch serializable order for metadata
  const { order } = await getOrderForEdit(params.orderId);
  return {
    title: order ? `Edit Order ${order.id.substring(0, 8)}... | Showroom Manager` : 'Edit Order | Showroom Manager',
    description: `Edit details for order ${order?.id || params.orderId}.`,
  };
}

// Ensure dynamic rendering because data is fetched on each request
export const dynamic = 'force-dynamic';