'use server';

import { revalidatePath } from 'next/cache';
import { db, collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp, getDoc, writeBatch } from '@/lib/firebase/firebase';
import { OrderSchema, type CreateOrderInput, type Order, type OrderInput, PaymentInfoSchema, TrackingInfoSchema, ShippingInfoSchema, OrderStatusEnum, PaymentStatusEnum } from '@/schemas/order'; // Import Order types/schemas
import type { AddItemInput } from '@/schemas/inventory'; // For fetching item details
import { AddItemSchema } from '@/schemas/inventory'; // Import AddItemSchema for validation

// --- HELPER FUNCTIONS ---

// Helper function to fetch current item details (removed stock check specific parts)
async function getInventoryItem(itemId: string): Promise<(AddItemInput & { id: string }) | null> {
    if (!db) {
        console.error("getInventoryItem: Firestore database is not initialized.");
        return null;
    }
    try {
        const itemDocRef = doc(db, 'inventory', itemId);
        const docSnap = await getDoc(itemDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const validatedData = AddItemSchema.safeParse(data);
            if (validatedData.success) {
                return {
                    id: docSnap.id,
                    ...validatedData.data,
                 };
            } else {
                console.warn(`Inventory item ${itemId} data validation failed:`, validatedData.error);
                 const stock = typeof data?.stock === 'number' ? data.stock : 0;
                 const price = typeof data?.price === 'number' ? data.price : 0;
                 const name = typeof data?.name === 'string' ? data.name : 'Unknown';
                 const sku = typeof data?.sku === 'string' ? data.sku : 'Unknown';
                 const style = typeof data?.style === 'string' ? data.style : 'Unknown';
                 const material = typeof data?.material === 'string' ? data.material : 'Unknown';
                 const dimensions = typeof data?.dimensions === 'string' ? data.dimensions : 'Unknown';
                 const imageUrl = typeof data?.imageUrl === 'string' ? data.imageUrl : undefined;

                const fallbackData: AddItemInput = {
                    name, sku, style, material, dimensions, stock, price,
                    ...(data as Partial<AddItemInput>), imageUrl,
                };
                return { id: docSnap.id, ...fallbackData };
            }
        }
        console.log(`getInventoryItem: Item ${itemId} not found.`);
        return null;
    } catch (error) {
        console.error(`Error fetching inventory item ${itemId}:`, error);
        return null;
    }
}


// Function to calculate order total based on items in the order input
function calculateOrderTotal(items: { price: number; quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}


// --- CREATE ORDER ACTION ---
// REMOVED Stock check and inventory update logic. Cloud Function handles this.
export async function createOrderAction(data: CreateOrderInput): Promise<{ success: boolean; message: string; orderId?: string; errors?: Record<string, any> | null }> {
  if (!db) {
      console.error("createOrderAction: Firestore database is not initialized.");
      return { success: false, message: "Database configuration error.", errors: null };
  }

  // --- VALIDATION ---
  const validationResult = OrderSchema.safeParse(data);
  if (!validationResult.success) {
    console.error("Create Order Validation Errors:", validationResult.error.flatten().fieldErrors);
    return { success: false, message: "Validation failed.", errors: validationResult.error.flatten().fieldErrors };
  }
  const validatedInputData = validationResult.data;

  const now = Timestamp.now();

  // --- PREPARE FIRESTORE DATA ---
  const ordersCollectionRef = collection(db, 'orders');
  const newOrderRef = doc(ordersCollectionRef); // Generate ref for ID

  const firestoreOrderData = {
      items: validatedInputData.items.map(item => ({
          cartItemId: `${item.itemId}-${Date.now()}`,
          doorId: item.itemId,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          finalPrice: item.price,
          imageUrl: item.image || '',
          customizations: item.customizations || {},
      })),
      orderDate: now,
      shippingInfo: validatedInputData.customer as z.infer<typeof ShippingInfoSchema>,
      paymentInfo: {
          paymentMethod: validatedInputData.paymentStatus,
      } as z.infer<typeof PaymentInfoSchema>,
      status: validatedInputData.status,
      totalAmount: calculateOrderTotal(validatedInputData.items),
      trackingInfo: {
          status: validatedInputData.status === 'Processing' ? 'Shipment Information Received' : 'Pending',
          carrier: validatedInputData.shippingMethod || undefined,
          trackingNumber: undefined,
      } as z.infer<typeof TrackingInfoSchema>,
      userId: "admin_placeholder_user_id", // Replace with actual user ID
      createdAt: now,
      updatedAt: now,
  };

  // --- ADD ORDER TO FIRESTORE ---
  try {
      console.log("Adding order to Firestore...");
      await addDoc(ordersCollectionRef, firestoreOrderData); // Using addDoc directly as batch is no longer needed here
      const newOrderId = newOrderRef.id; // Get the generated ID after addDoc resolves (though addDoc returns the ref)
      console.log(`Order added successfully. New order ID should be available in Firestore.`); // ID needs fetch or use addDoc result

      // Revalidate paths
      revalidatePath('/orders');
      // Revalidate detail page - need the actual ID from addDoc result or fetch after create
      // revalidatePath(`/orders/${newOrderId}`); // Re-enable if you get the ID back
      revalidatePath('/inventory'); // Inventory will be updated by Cloud Function
      // Revalidation for specific items will happen implicitly when inventory list is revalidated
      revalidatePath('/logistics');
      revalidatePath('/');

      return {
        success: true,
        message: `Order created successfully. Inventory will be updated automatically.`,
        // orderId: newOrderId, // Return ID if needed client-side
      };

  } catch (error) {
      console.error("Error during order creation:", error);
       let errorMessage = "Failed to create order due to a server error.";
       if (error instanceof Error) {
           errorMessage = `Failed to create order: ${error.message}`;
       }
       return { success: false, message: errorMessage, errors: null };
    }
}


// --- UPDATE ORDER ACTION ---
export async function updateOrderAction(
  orderId: string,
  data: OrderInput
): Promise<{ success: boolean; message: string; errors?: Record<string, any> | null }> {
   if (!db) return { success: false, message: "Database config error.", errors: null };
   if (!orderId) return { success: false, message: "Order ID is required.", errors: null };

   const validationResult = OrderSchema.safeParse(data);
   if (!validationResult.success) {
       console.error("Update Order Validation Errors:", validationResult.error.flatten().fieldErrors);
       return { success: false, message: "Validation failed.", errors: validationResult.error.flatten().fieldErrors };
   }
   const validatedUpdateData = validationResult.data;

   console.warn(`Updating order ${orderId}. Inventory stock NOT automatically adjusted by this action. Manual stock adjustment may be needed if items/quantities changed significantly.`);

   const firestoreUpdateData: Record<string, any> = {
       shippingInfo: validatedUpdateData.customer as z.infer<typeof ShippingInfoSchema>,
       status: validatedUpdateData.status,
       paymentInfo: {
           paymentMethod: validatedUpdateData.paymentStatus,
       } as z.infer<typeof PaymentInfoSchema>,
       'trackingInfo.carrier': validatedUpdateData.shippingMethod,
       items: validatedUpdateData.items.map(item => ({
            cartItemId: `${item.itemId}-${Date.now()}`,
            doorId: item.itemId,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            finalPrice: item.price,
            imageUrl: item.image || '',
            customizations: item.customizations || {},
        })),
       totalAmount: calculateOrderTotal(validatedUpdateData.items),
       updatedAt: serverTimestamp(),
   };

   Object.keys(firestoreUpdateData).forEach(key => {
        if (firestoreUpdateData[key] === undefined) {
           delete firestoreUpdateData[key];
        }
   });

  try {
    const orderDocRef = doc(db, 'orders', orderId);
    console.log(`Attempting to update order ${orderId} with data:`, firestoreUpdateData);
    await updateDoc(orderDocRef, firestoreUpdateData);
    console.log(`Order ${orderId} updated successfully.`);

    revalidatePath('/orders');
    revalidatePath(`/orders/${orderId}`);
    revalidatePath(`/orders/${orderId}/edit`);
    revalidatePath('/logistics');
    revalidatePath('/');

    return {
      success: true,
      message: `Order '${orderId}' updated successfully! Remember to manually adjust stock if items changed.`,
    };

  } catch (error) {
     console.error(`Error updating order ${orderId}:`, error);
     let errorMessage = "Failed to update order due to a database error.";
     if (error instanceof Error) {
         errorMessage = `Failed to update order: ${error.message}`;
     }
     return { success: false, message: errorMessage, errors: null };
  }
}


// --- UPDATE ORDER STATUS ACTION ---
export async function updateOrderStatusAction(orderId: string, newStatus: string): Promise<{ success: boolean; message: string }> {
   if (!db) return { success: false, message: "Database config error." };
   if (!orderId) return { success: false, message: "Order ID required." };
   if (!newStatus) return { success: false, message: "New status is required." };

   try {
     const orderDocRef = doc(db, 'orders', orderId);

     const updateData: Record<string, any> = {
         updatedAt: serverTimestamp(),
         status: newStatus,
     };

      if (newStatus === 'Shipped') {
          updateData['trackingInfo.status'] = 'Shipped';
      } else if (newStatus === 'Delivered') {
          updateData['trackingInfo.status'] = 'Delivered';
      } else if (newStatus === 'Processing') {
           updateData['trackingInfo.status'] = 'Shipment Information Received';
      } else if (newStatus === 'Cancelled' || newStatus === 'Refunded') {
           updateData['trackingInfo.status'] = 'Cancelled';
      }

     console.log(`Attempting to update status for order ${orderId} to ${newStatus} with data:`, updateData);
     await updateDoc(orderDocRef, updateData);
     console.log(`Order ${orderId} status updated successfully.`);

     revalidatePath('/orders');
     revalidatePath(`/orders/${orderId}`);
     revalidatePath('/logistics');
     revalidatePath('/');

     return { success: true, message: "Order status updated successfully." };
   } catch (error) {
      console.error(`Error updating order status for ${orderId}:`, error);
      let errorMessage = "Failed to update order status due to a database error.";
      if (error instanceof Error) {
          errorMessage = `Failed to update order status: ${error.message}`;
      }
      return { success: false, message: errorMessage };
   }
}


// --- CANCEL ORDER ACTION ---
// REMOVED inventory restock logic. Create another Cloud Function for this.
export async function cancelOrderAction(orderId: string): Promise<{ success: boolean; message: string }> {
    if (!db) return { success: false, message: "Database config error." };
    if (!orderId) return { success: false, message: "Order ID required." };

    const orderDocRef = doc(db, 'orders', orderId);

    try {
        console.log(`Attempting to cancel order ${orderId}`);
        const orderSnap = await getDoc(orderDocRef);
        if (!orderSnap.exists()) {
            console.error(`Order ${orderId} not found.`);
            return { success: false, message: `Order ${orderId} not found.` };
        }

        const orderData = orderSnap.data();
        const currentStatus = orderData.status;
        const nonCancellableStatuses = ['Shipped', 'Delivered', 'Cancelled', 'Refunded'];

        if (nonCancellableStatuses.includes(currentStatus)) {
            console.log(`Order ${orderId} is already ${currentStatus} and cannot be cancelled.`);
            return { success: false, message: `Order is already ${currentStatus} and cannot be cancelled.` };
        }

        // --- Prepare Order Update ---
        await updateDoc(orderDocRef, {
            status: 'Cancelled',
            'paymentInfo.paymentMethod': 'Refunded',
            'trackingInfo.status': 'Cancelled',
            updatedAt: serverTimestamp(),
        });
        console.log(`Order ${orderId} status updated to Cancelled/Refunded.`);

        // --- Inventory Restock Handled by a Separate Cloud Function ---
        console.log(`Inventory restock for cancelled order ${orderId} should be handled by a Cloud Function.`);

        // --- Revalidate Paths ---
        revalidatePath('/orders');
        revalidatePath(`/orders/${orderId}`);
        revalidatePath('/logistics');
        revalidatePath('/');
        // Inventory revalidation will happen after the Cloud Function updates stock

        let successMessage = `Order ${orderId} cancelled successfully. Inventory restock will be processed automatically.`;

        return { success: true, message: successMessage };

    } catch (error) {
         console.error(`Error cancelling order ${orderId}:`, error);
         let errorMessage = "Failed to cancel order due to a server error.";
         if (error instanceof Error) {
             errorMessage = `Failed to cancel order: ${error.message}`;
         }
         return { success: false, message: errorMessage };
    }
}


// --- LINK SHIPMENT ACTION ---
export async function linkShipmentToOrderAction(orderId: string, trackingData: { carrier: string; trackingNumber: string; status?: string }): Promise<{ success: boolean; message: string }> {
   if (!db) return { success: false, message: "Database config error." };
   if (!orderId || !trackingData || !trackingData.carrier || !trackingData.trackingNumber) {
       return { success: false, message: "Order ID, carrier, and tracking number are required." };
   }

   try {
     const orderDocRef = doc(db, 'orders', orderId);
     console.log(`Linking tracking info to order ${orderId}:`, trackingData);

     await updateDoc(orderDocRef, {
       trackingInfo: {
           carrier: trackingData.carrier,
           trackingNumber: trackingData.trackingNumber,
           status: trackingData.status || 'Shipped',
       },
       status: 'Shipped',
       updatedAt: serverTimestamp(),
     });
     console.log(`Tracking info linked to order ${orderId} successfully.`);

     revalidatePath('/orders');
     revalidatePath(`/orders/${orderId}`);
     revalidatePath('/logistics');
     revalidatePath('/');

     return { success: true, message: "Shipment linked to order successfully." };
   } catch (error) {
     console.error(`Error linking shipment to order ${orderId}:`, error);
     let errorMessage = "Failed to link shipment due to a database error.";
     if (error instanceof Error) {
         errorMessage = `Failed to link shipment: ${error.message}`;
     }
     return { success: false, message: errorMessage };
   }
}
