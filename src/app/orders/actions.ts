
'use server';

import { revalidatePath } from 'next/cache';
import { db, collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp, getDoc, writeBatch } from '@/lib/firebase/firebase';
import { OrderSchema, type CreateOrderInput, type Order, type OrderInput, type PaymentInfoSchema, type TrackingInfoSchema, type ShippingInfoSchema } from '@/schemas/order'; // Import Order types/schemas
import type { AddItemInput } from '@/schemas/inventory'; // For fetching item details

// --- HELPER FUNCTIONS (MAY NEED UPDATES) ---

// Helper function to fetch current item details (including stock)
async function getInventoryItem(itemId: string): Promise<(AddItemInput & { id: string }) | null> {
    if (!db) return null;
    try {
        const itemDocRef = doc(db, 'inventory', itemId);
        const docSnap = await getDoc(itemDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Use AddItemSchema for basic validation/coercion AFTER fetching
            // Ensure AddItemSchema aligns with inventory structure
            const validatedData = AddItemSchema.safeParse(data);
            if (validatedData.success) {
                return {
                    id: docSnap.id,
                    ...validatedData.data,
                 };
            } else {
                console.warn(`Inventory item ${itemId} data validation failed:`, validatedData.error);
                 // Fallback to potentially unsafe casting if validation fails, ensuring required fields
                 const stock = typeof data?.stock === 'number' ? data.stock : 0;
                 const price = typeof data?.price === 'number' ? data.price : 0;
                 const name = typeof data?.name === 'string' ? data.name : 'Unknown';
                 const sku = typeof data?.sku === 'string' ? data.sku : 'Unknown';
                 const style = typeof data?.style === 'string' ? data.style : 'Unknown';
                 const material = typeof data?.material === 'string' ? data.material : 'Unknown';
                 const dimensions = typeof data?.dimensions === 'string' ? data.dimensions : 'Unknown';
                 const imageUrl = typeof data?.imageUrl === 'string' ? data.imageUrl : undefined;

                // Construct a partial AddItemInput
                const fallbackData: AddItemInput = {
                    name,
                    sku,
                    style,
                    material,
                    dimensions,
                    stock,
                    price,
                    ...(data as Partial<AddItemInput>),
                    imageUrl,
                };
                return { id: docSnap.id, ...fallbackData };
            }
        }
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
export async function createOrderAction(data: CreateOrderInput): Promise<{ success: boolean; message: string; orderId?: string; errors?: Record<string, any> | null }> {
  if (!db) {
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
  const batch = writeBatch(db);
  let stockCheckFailed = false;
  let stockErrorMessage = "";
  let itemsToRestock: { ref: any; quantity: number; name: string; itemId: string }[] = []; // Used for potential rollback/revalidation

  // --- PREPARE FIRESTORE DATA ---
  const ordersCollectionRef = collection(db, 'orders');
  const newOrderRef = doc(ordersCollectionRef); // Generate ref for ID

  // Map validatedInputData to the Firestore structure
  const firestoreOrderData = {
      items: validatedInputData.items.map(item => ({
          cartItemId: `${item.itemId}-${Date.now()}`, // Generate a unique ID in context
          doorId: item.itemId,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          finalPrice: item.price, // Use price from form input
          imageUrl: item.image || '',
          customizations: item.customizations || {},
      })),
      orderDate: now,
      shippingInfo: validatedInputData.customer as z.infer<typeof ShippingInfoSchema>, // Customer data maps directly to shippingInfo
      paymentInfo: {
          paymentMethod: validatedInputData.paymentStatus, // Map form's paymentStatus to paymentMethod
      } as z.infer<typeof PaymentInfoSchema>,
      status: validatedInputData.status,
      totalAmount: calculateOrderTotal(validatedInputData.items), // Recalculate total
      trackingInfo: {
          status: validatedInputData.status === 'Processing' ? 'Shipment Information Received' : 'Pending',
          carrier: validatedInputData.shippingMethod || undefined,
          trackingNumber: undefined,
      } as z.infer<typeof TrackingInfoSchema>,
      userId: "admin_placeholder_user_id", // Replace with actual user ID from auth context
  };


  // --- STOCK CHECK & INVENTORY UPDATES ---
  try {
      for (const item of firestoreOrderData.items) {
          const inventoryItem = await getInventoryItem(item.doorId);

          if (!inventoryItem) {
              stockCheckFailed = true;
              stockErrorMessage = `Inventory item '${item.name}' (ID: ${item.doorId}) not found. Order cannot be placed.`;
              break;
          }
           if (inventoryItem.stock < item.quantity) {
               stockCheckFailed = true;
               stockErrorMessage = `Insufficient stock for item '${item.name}'. Available: ${inventoryItem.stock}, Required: ${item.quantity}.`;
               break;
           }

          // Prepare inventory update for the batch
          const newStock = inventoryItem.stock - item.quantity;
          const inventoryItemRef = doc(db, 'inventory', item.doorId);
          batch.update(inventoryItemRef, { stock: newStock, updatedAt: serverTimestamp() });
           itemsToRestock.push({ ref: inventoryItemRef, quantity: item.quantity, name: item.name, itemId: inventoryItem.id });
          console.log(`Prepared stock update for item ${item.doorId}: ${inventoryItem.stock} -> ${newStock}`);
      }

      if (stockCheckFailed) {
          console.error("Stock check failed:", stockErrorMessage);
          return {
              success: false,
              message: stockErrorMessage,
              errors: { items: [{ message: stockErrorMessage }] }
          };
      }

      // --- ADD ORDER TO BATCH & COMMIT ---
      batch.set(newOrderRef, firestoreOrderData);
      console.log("Committing batch operation...");
      await batch.commit();
      const newOrderId = newOrderRef.id;
      console.log(`Batch committed successfully. New order ID: ${newOrderId}`);


      // --- REVALIDATE ---
      revalidatePath('/orders');
      revalidatePath(`/orders/${newOrderId}`);
      revalidatePath('/inventory');
      itemsToRestock.forEach(item => revalidatePath(`/inventory/${item.itemId}`));
      revalidatePath('/logistics');
      revalidatePath('/');

      return {
        success: true,
        message: `Order ${newOrderId} created successfully and stock updated.`,
        orderId: newOrderId,
      };

  } catch (error) {
      console.error("Error during order creation batch operation:", error);
       let errorMessage = "Failed to create order due to a server error.";
       if (error instanceof Error) {
           errorMessage = `Failed to create order: ${error.message}`;
       }
       return { success: false, message: errorMessage, errors: null };
    }
}


// --- UPDATE ORDER ACTION ---
// Handles updates from the Edit Order Form.
// Note: Does NOT automatically adjust stock based on item changes in the edit form.
// Manual stock adjustment might be needed if quantities/items are significantly changed.
export async function updateOrderAction(
  orderId: string,
  data: OrderInput // Use OrderInput as the shape for incoming update data
): Promise<{ success: boolean; message: string; errors?: Record<string, any> | null }> {
   if (!db) return { success: false, message: "Database config error.", errors: null };
   if (!orderId) return { success: false, message: "Order ID is required.", errors: null };

   // --- VALIDATION ---
   const validationResult = OrderSchema.safeParse(data); // Validate incoming form data
   if (!validationResult.success) {
       console.error("Update Order Validation Errors:", validationResult.error.flatten().fieldErrors);
       return { success: false, message: "Validation failed.", errors: validationResult.error.flatten().fieldErrors };
   }
   const validatedUpdateData = validationResult.data;

   console.warn(`Updating order ${orderId}. Inventory stock NOT automatically adjusted by this action. Manual stock adjustment may be needed if items/quantities changed significantly.`);

   // --- Map input data to Firestore structure for update ---
   const firestoreUpdateData: Record<string, any> = {
       shippingInfo: validatedUpdateData.customer as z.infer<typeof ShippingInfoSchema>, // Map customer directly to shippingInfo
       status: validatedUpdateData.status,
       paymentInfo: {
           paymentMethod: validatedUpdateData.paymentStatus, // Map form's paymentStatus to paymentInfo.paymentMethod
       } as z.infer<typeof PaymentInfoSchema>,
       'trackingInfo.carrier': validatedUpdateData.shippingMethod, // Map shippingMethod to carrier inside trackingInfo
       // Update items: Replacing the entire array. Be cautious if sub-data needs preservation.
       items: validatedUpdateData.items.map(item => ({
            cartItemId: `${item.itemId}-${Date.now()}`, // Consider keeping original cartItemId if it exists and is needed
            doorId: item.itemId,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            finalPrice: item.price,
            imageUrl: item.image || '',
            customizations: item.customizations || {},
        })),
       totalAmount: calculateOrderTotal(validatedUpdateData.items), // Recalculate total based on potentially updated items/prices
       updatedAt: serverTimestamp(), // Add updatedAt timestamp
   };

   // Remove undefined fields to avoid issues during Firestore update
   Object.keys(firestoreUpdateData).forEach(key => {
        if (firestoreUpdateData[key] === undefined) {
           delete firestoreUpdateData[key];
        }
        // Optional: More sophisticated check for nested undefined fields if needed
   });

  try {
    const orderDocRef = doc(db, 'orders', orderId);
    console.log(`Attempting to update order ${orderId} with data:`, firestoreUpdateData);
    await updateDoc(orderDocRef, firestoreUpdateData);
    console.log(`Order ${orderId} updated successfully.`);

    // --- REVALIDATE PATHS ---
    revalidatePath('/orders');
    revalidatePath(`/orders/${orderId}`);
    revalidatePath(`/orders/${orderId}/edit`);
    revalidatePath('/logistics'); // If status/tracking changed
    revalidatePath('/'); // Dashboard

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
// Focuses specifically on updating the main 'status' and potentially 'trackingInfo.status'.
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

      // Optionally, update tracking status based on main status transitions
      // This logic can be refined based on specific workflow requirements
      if (newStatus === 'Shipped') {
          updateData['trackingInfo.status'] = 'Shipped';
      } else if (newStatus === 'Delivered') {
          updateData['trackingInfo.status'] = 'Delivered';
          // updateData['trackingInfo.actualDelivery'] = serverTimestamp(); // Optionally add delivery timestamp
      } else if (newStatus === 'Processing') {
           updateData['trackingInfo.status'] = 'Shipment Information Received';
      } else if (newStatus === 'Cancelled' || newStatus === 'Refunded') {
           updateData['trackingInfo.status'] = 'Cancelled';
      }

     console.log(`Attempting to update status for order ${orderId} to ${newStatus} with data:`, updateData);
     await updateDoc(orderDocRef, updateData);
     console.log(`Order ${orderId} status updated successfully.`);

     // --- REVALIDATE PATHS ---
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
export async function cancelOrderAction(orderId: string): Promise<{ success: boolean; message: string }> {
    if (!db) return { success: false, message: "Database config error." };
    if (!orderId) return { success: false, message: "Order ID required." };

    const orderDocRef = doc(db, 'orders', orderId);
    const batch = writeBatch(db);
    let itemsToRestock: { ref: any; quantity: number; name: string; itemId: string }[] = [];
    let restockSkippedCount = 0;
    let shipmentTrackingNumber: string | undefined;

    try {
        console.log(`Attempting to cancel order ${orderId}`);
        const orderSnap = await getDoc(orderDocRef);
        if (!orderSnap.exists()) {
            console.error(`Order ${orderId} not found.`);
            return { success: false, message: `Order ${orderId} not found.` };
        }

        const orderData = orderSnap.data() as Order;

        // --- Cancellation Check ---
        const currentStatus = orderData.status;
        const cancellableStatuses = ['Pending Payment', 'Processing']; // Define which statuses allow cancellation
        const nonCancellableStatuses = ['Shipped', 'Delivered', 'Cancelled', 'Refunded'];

        if (nonCancellableStatuses.includes(currentStatus)) {
            console.log(`Order ${orderId} is already ${currentStatus} and cannot be cancelled.`);
            return { success: false, message: `Order is already ${currentStatus} and cannot be cancelled.` };
        }
        // Optionally warn or prevent cancellation for other statuses if needed

        // --- Prepare Order Update ---
        batch.update(orderDocRef, {
            status: 'Cancelled',
            'paymentInfo.paymentMethod': 'Refunded', // Update payment method to Refunded
            'trackingInfo.status': 'Cancelled', // Also update tracking status
            updatedAt: serverTimestamp(),
        });
        console.log(`Prepared order update for ${orderId} to Cancelled/Refunded.`);

        // --- Prepare Inventory Restock ---
         console.log(`Preparing to restock items for cancelled order ${orderId}`);
         for (const item of orderData.items) {
             const inventoryItem = await getInventoryItem(item.doorId); // Use doorId

             if (!inventoryItem) {
                 console.warn(`Inventory item ${item.name} (ID: ${item.doorId}) not found. Skipping restock.`);
                 restockSkippedCount++;
                 continue;
             }
             const currentStock = inventoryItem.stock;
             const newStock = currentStock + item.quantity;
             const inventoryItemRef = doc(db, 'inventory', inventoryItem.id);
             batch.update(inventoryItemRef, { stock: newStock, updatedAt: serverTimestamp() });
             itemsToRestock.push({ ref: inventoryItemRef, quantity: item.quantity, name: item.name, itemId: inventoryItem.id });
              console.log(`Prepared restock for item ${inventoryItem.id}: ${currentStock} -> ${newStock}`);
         }
          if (restockSkippedCount > 0) {
              console.warn(`${restockSkippedCount} items could not be restocked because they were not found.`);
          }

         // Note: Shipment collection update logic removed as trackingInfo is within Order doc

        // --- Commit Batch ---
        console.log(`Committing cancellation batch for order ${orderId}`);
        await batch.commit();
        console.log(`Order ${orderId} cancelled and batch committed successfully.`);

        // --- Revalidate Paths ---
        revalidatePath('/orders');
        revalidatePath(`/orders/${orderId}`);
        revalidatePath('/inventory');
        itemsToRestock.forEach(item => revalidatePath(`/inventory/${item.itemId}`));
        revalidatePath('/logistics'); // Status change affects logistics
        revalidatePath('/');

        let successMessage = `Order ${orderId} cancelled successfully.`;
        if(itemsToRestock.length > 0){
            successMessage += ` ${itemsToRestock.reduce((sum, i) => sum + i.quantity, 0)} item(s) restocked.`;
        }
        if(restockSkippedCount > 0){
             successMessage += ` ${restockSkippedCount} item(s) could not be restocked (not found).`;
        }

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
// Updates the 'trackingInfo' within the order document.
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
           status: trackingData.status || 'Shipped', // Default status if not provided
       },
       status: 'Shipped', // Update main order status to Shipped
       updatedAt: serverTimestamp(),
     });
     console.log(`Tracking info linked to order ${orderId} successfully.`);

     // --- REVALIDATE PATHS ---
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
