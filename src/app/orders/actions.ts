
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

                // Construct fallback data more carefully
                const fallbackData: AddItemInput = {
                    name, sku, style, material, dimensions, stock, price,
                    // Only include optional fields if they exist in source data
                    ...(data?.description && { description: data.description }),
                    ...(data?.weight && { weight: data.weight }),
                    ...(data?.leadTime && { leadTime: data.leadTime }),
                    ...(imageUrl && { imageUrl }),
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

  // --- CHECK ITEM EXISTENCE (NEW) ---
  console.log("Checking existence of order items...");
  for (const item of validatedInputData.items) {
      const inventoryItem = await getInventoryItem(item.itemId);
      if (!inventoryItem) {
          const errorMessage = `Inventory item '${item.name || 'Unknown'}' (ID: ${item.itemId}) not found. Order cannot be placed.`;
          console.error(errorMessage);
          // Return a specific error structure that the form can potentially handle
          return {
              success: false,
              message: errorMessage,
              errors: { items: { [`${validatedInputData.items.indexOf(item)}.itemId`]: [errorMessage] } } // Point error to specific item
          };
      }
      console.log(`Item ${item.itemId} found.`);
  }
  console.log("All order items found in inventory.");
  // --- END CHECK ITEM EXISTENCE ---

  const now = Timestamp.now();

  // --- PREPARE FIRESTORE DATA ---
  const ordersCollectionRef = collection(db, 'orders');

  const firestoreOrderData = {
      items: validatedInputData.items.map(item => ({
          cartItemId: `${item.itemId}-${Date.now()}`, // Use itemId for consistency
          doorId: item.itemId, // Keep doorId as it seems to be used by Cloud Functions
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
          // Add transactionId or other fields if needed later
      } as z.infer<typeof PaymentInfoSchema>,
      status: validatedInputData.status, // Use status from validated data
      totalAmount: calculateOrderTotal(validatedInputData.items), // Use calculated total
      trackingInfo: { // Initialize tracking info
          status: 'Shipment Information Received', // Default status
          carrier: validatedInputData.shippingMethod || undefined, // Optional carrier
          trackingNumber: undefined, // No tracking number initially
          // Add other tracking fields if necessary
      } as z.infer<typeof TrackingInfoSchema>,
      userId: "admin_placeholder_user_id", // Replace with actual user ID later if auth is added
      createdAt: now, // Add createdAt timestamp
      updatedAt: now, // Add updatedAt timestamp
  };

  // --- ADD ORDER TO FIRESTORE ---
  try {
      console.log("Adding order to Firestore...");
      // Using addDoc will auto-generate an ID
      const docRef = await addDoc(ordersCollectionRef, firestoreOrderData);
      const newOrderId = docRef.id; // Get the generated ID
      console.log(`Order added successfully with ID: ${newOrderId}`);

      // Revalidate paths
      revalidatePath('/orders');
      revalidatePath(`/orders/${newOrderId}`); // Revalidate detail page
      revalidatePath('/inventory'); // Inventory will be updated by Cloud Function
      revalidatePath('/logistics');
      revalidatePath('/');

      return {
        success: true,
        message: `Order created successfully. Inventory will be updated automatically.`,
        orderId: newOrderId, // Return the new ID
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

   // --- CHECK ITEM EXISTENCE (FOR UPDATED ITEMS) ---
   console.log("Checking existence of updated order items...");
   for (const item of validatedUpdateData.items) {
       const inventoryItem = await getInventoryItem(item.itemId);
       if (!inventoryItem) {
           const errorMessage = `Inventory item '${item.name || 'Unknown'}' (ID: ${item.itemId}) not found. Order cannot be updated.`;
           console.error(errorMessage);
           return {
               success: false,
               message: errorMessage,
               errors: { items: { [`${validatedUpdateData.items.indexOf(item)}.itemId`]: [errorMessage] } }
           };
       }
       console.log(`Item ${item.itemId} found.`);
   }
   console.log("All updated order items found in inventory.");
   // --- END CHECK ITEM EXISTENCE ---


   const firestoreUpdateData: Record<string, any> = {
       shippingInfo: validatedUpdateData.customer as z.infer<typeof ShippingInfoSchema>,
       status: validatedUpdateData.status,
       paymentInfo: {
           paymentMethod: validatedUpdateData.paymentStatus,
       } as z.infer<typeof PaymentInfoSchema>,
       'trackingInfo.carrier': validatedUpdateData.shippingMethod, // Use dot notation for nested field
       items: validatedUpdateData.items.map(item => ({
            cartItemId: `${item.itemId}-${Date.now()}`, // Generate a new cartItemId? Or keep original? Needs consideration.
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

   // Remove undefined fields to avoid errors
   Object.keys(firestoreUpdateData).forEach(key => {
        if (firestoreUpdateData[key] === undefined) {
           delete firestoreUpdateData[key];
        }
   });

  try {
    const orderDocRef = doc(db, 'orders', orderId);
    console.log(`Attempting to update order ${orderId} with data:`, Object.keys(firestoreUpdateData));
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

   // Optional: Validate if newStatus is one of the expected enum values
   const isValidStatus = OrderStatusEnum.safeParse(newStatus);
   if (!isValidStatus.success) {
        // Check if it's a valid payment status instead (for edit form compatibility)
       const isValidPaymentStatus = PaymentStatusEnum.safeParse(newStatus);
       if (!isValidPaymentStatus.success) {
           console.warn(`Invalid status provided: ${newStatus}`);
            // Decide how to handle: error out or proceed cautiously? Erroring out is safer.
            return { success: false, message: `Invalid status value: ${newStatus}` };
       }
        // If it's a valid payment status, map it to a relevant order status if needed
        // For now, we'll allow setting the main status to a payment status if passed from edit form
        console.log(`Updating status with payment status value: ${newStatus}`);
   }


   try {
     const orderDocRef = doc(db, 'orders', orderId);

     const updateData: Record<string, any> = {
         updatedAt: serverTimestamp(),
         status: newStatus, // Update the main order status
     };

      // Also update tracking status based on the new main status for consistency
      if (newStatus === 'Shipped') {
          updateData['trackingInfo.status'] = 'Shipped';
      } else if (newStatus === 'Delivered') {
          updateData['trackingInfo.status'] = 'Delivered';
      } else if (newStatus === 'Processing') {
           updateData['trackingInfo.status'] = 'Shipment Information Received'; // Or 'Processing' if preferred
      } else if (newStatus === 'Cancelled' || newStatus === 'Refunded') {
           updateData['trackingInfo.status'] = 'Cancelled';
      } else if (newStatus === 'Pending Payment') {
           updateData['trackingInfo.status'] = 'Pending'; // Example mapping
      }
      // Add more mappings as needed based on your statuses

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
// Assumes a Cloud Function handles inventory restock triggered by status change.
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
            status: 'Cancelled', // Set main status to Cancelled
            paymentInfo: { // Update payment info
                ...orderData.paymentInfo, // Keep existing info if needed
                paymentMethod: 'Refunded', // Or keep original method and add refunded flag? Needs business logic decision.
            },
             // Update tracking status if tracking info exists
             ...(orderData.trackingInfo && { 'trackingInfo.status': 'Cancelled' }),
            updatedAt: serverTimestamp(),
        });
        console.log(`Order ${orderId} status updated to Cancelled.`);

        // --- Inventory Restock Handled by a Separate Cloud Function ---
        console.log(`Inventory restock for cancelled order ${orderId} should be handled by a Cloud Function triggered by the status update.`);

        // --- Revalidate Paths ---
        revalidatePath('/orders');
        revalidatePath(`/orders/${orderId}`);
        revalidatePath('/logistics');
        revalidatePath('/');

        let successMessage = `Order ${orderId} cancelled successfully. Inventory restock will be processed automatically if configured.`;

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
// Updates tracking info within the order document
export async function linkShipmentToOrderAction(orderId: string, trackingData: { carrier: string; trackingNumber: string; status?: string }): Promise<{ success: boolean; message: string }> {
   if (!db) return { success: false, message: "Database config error." };
   if (!orderId || !trackingData || !trackingData.carrier || !trackingData.trackingNumber) {
       return { success: false, message: "Order ID, carrier, and tracking number are required." };
   }

   try {
     const orderDocRef = doc(db, 'orders', orderId);
     console.log(`Linking tracking info to order ${orderId}:`, trackingData);

     // Prepare the trackingInfo object to update
     const trackingInfoUpdate: z.infer<typeof TrackingInfoSchema> = {
          carrier: trackingData.carrier,
          trackingNumber: trackingData.trackingNumber,
          status: trackingData.status || 'Shipped', // Default to 'Shipped' if no status provided
          // Add any other relevant fields from your TrackingInfoSchema here
     };

     await updateDoc(orderDocRef, {
       trackingInfo: trackingInfoUpdate, // Update the entire trackingInfo map
       status: 'Shipped', // Update the main order status to 'Shipped'
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
