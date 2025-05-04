'use server';

import { revalidatePath } from 'next/cache';
import { db, collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp, getDoc, writeBatch, CollectionReference } from '@/lib/firebase/firebase';
import { OrderSchema, type CreateOrderInput, type Order, type OrderInput } from '@/schemas/order'; // Import Order types/schemas
import type { AddItemInput } from '@/schemas/inventory'; // For fetching item details

// --- HELPER FUNCTIONS (MAY NEED UPDATES) ---

// Helper function to fetch current item details (including stock) - Keep as is for now, but verify field names
async function getInventoryItem(itemId: string): Promise<(AddItemInput & { id: string }) | null> {
    if (!db) return null;
    try {
        const itemDocRef = doc(db, 'inventory', itemId);
        const docSnap = await getDoc(itemDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Use AddItemSchema for validation and coercion AFTER fetching
            // Ensure AddItemSchema aligns with inventory structure
            const validatedData = AddItemSchema.safeParse(data);
            if (validatedData.success) {
                return {
                    id: docSnap.id,
                    ...validatedData.data,
                 };
            } else {
                console.warn(`Inventory item ${itemId} data validation failed:`, validatedData.error);
                 // Fallback to potentially unsafe casting if validation fails, but include required fields
                 const stock = typeof data?.stock === 'number' ? data.stock : 0;
                 const price = typeof data?.price === 'number' ? data.price : 0;
                 const name = typeof data?.name === 'string' ? data.name : 'Unknown';
                 const sku = typeof data?.sku === 'string' ? data.sku : 'Unknown';
                 const style = typeof data?.style === 'string' ? data.style : 'Unknown';
                 const material = typeof data?.material === 'string' ? data.material : 'Unknown';
                 const dimensions = typeof data?.dimensions === 'string' ? data.dimensions : 'Unknown';
                 // imageUrl is optional, handle potential undefined
                 const imageUrl = typeof data?.imageUrl === 'string' ? data.imageUrl : undefined;

                // Construct a partial AddItemInput, ensuring required fields are present
                const fallbackData: AddItemInput = {
                    name,
                    sku,
                    style,
                    material,
                    dimensions,
                    stock,
                    price,
                    ...(data as Partial<AddItemInput>), // Spread other optional fields if they exist
                    imageUrl, // Ensure imageUrl is included if present
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


// Function to calculate order total - needs update for new item price field ('finalPrice')
function calculateOrderTotal(items: { finalPrice: number; quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);
  // In a real app, add logic for taxes, shipping, discounts etc.
}


// --- CREATE ORDER ACTION ---
export async function createOrderAction(data: CreateOrderInput): Promise<{ success: boolean; message: string; orderId?: string; errors?: Record<string, any> | null }> {
  if (!db) {
      return { success: false, message: "Database configuration error.", errors: null };
  }

  // --- VALIDATION ---
  // Validate against the combined input schema
  const validationResult = OrderSchema.safeParse(data);
  if (!validationResult.success) {
    console.error("Create Order Validation Errors:", validationResult.error.flatten().fieldErrors);
    return { success: false, message: "Validation failed.", errors: validationResult.error.flatten().fieldErrors };
  }
  const validatedInputData = validationResult.data; // This data should now match the OrderInput type derived from OrderSchema

  const now = Timestamp.now();
  const batch = writeBatch(db);
  let stockCheckFailed = false;
  let stockErrorMessage = "";

  // --- PREPARE FIRESTORE DATA ---
  const ordersCollectionRef = collection(db, 'orders');
  const newOrderRef = doc(ordersCollectionRef); // Generate ref for ID

  // Map validatedInputData to the actual Firestore structure
  const firestoreOrderData = {
      items: validatedInputData.items.map(item => ({ // Map items from OrderInput
          cartItemId: `${item.itemId}-${Date.now()}`, // Generate a unique cart item ID
          doorId: item.itemId, // Map itemId to doorId
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          finalPrice: item.price, // Map price to finalPrice
          imageUrl: item.image || '', // Use item.image from OrderItemSchema
          customizations: {}, // Placeholder for customizations if needed later
      })),
      orderDate: now,
      // Map shipping info from the validated customer object
      shippingInfo: {
          name: validatedInputData.customer.name,
          email: validatedInputData.customer.email,
          phone: validatedInputData.customer.phone,
          address: validatedInputData.customer.address,
          // Assume city, state, zip might be part of the address string or need separate fields
          // If separate, they need to be added to the customer schema and mapped here
          city: 'N/A', // Placeholder - Add if needed
          state: 'N/A', // Placeholder - Add if needed
          zipCode: 'N/A', // Placeholder - Add if needed
      },
      // Map payment info
      paymentInfo: {
          paymentMethod: validatedInputData.paymentStatus || 'Pending', // Map from paymentStatus
      },
      status: validatedInputData.status, // Use status from input
      totalAmount: calculateOrderTotal(validatedInputData.items.map(i => ({ finalPrice: i.price, quantity: i.quantity }))), // Recalculate total based on input price
      // Default tracking info - status might be linked to main order status initially
      trackingInfo: {
          status: validatedInputData.status === 'Processing' ? 'Shipment Information Received' : 'Pending', // Example initial tracking status
          carrier: validatedInputData.shippingMethod || undefined, // Optional carrier
          trackingNumber: undefined, // No tracking number initially
      },
      // Assuming userId needs to be obtained from authentication context elsewhere
      // For now, using a placeholder - REPLACE THIS IN A REAL APP
      userId: "admin_placeholder_user_id",
  };


  // --- STOCK CHECK & INVENTORY UPDATES ---
  try {
      for (const item of firestoreOrderData.items) { // Iterate over mapped items
          const inventoryItem = await getInventoryItem(item.doorId); // Use doorId to fetch inventory

          if (!inventoryItem) {
              stockCheckFailed = true;
              // Use item.name which comes from the validated input (likely more reliable)
              stockErrorMessage = `Inventory item '${item.name}' (ID: ${item.doorId}) not found. Order cannot be placed.`;
              break;
          }
           if (inventoryItem.stock < item.quantity) {
               stockCheckFailed = true;
               // Use item.name from input
               stockErrorMessage = `Insufficient stock for item '${item.name}'. Available: ${inventoryItem.stock}, Required: ${item.quantity}.`;
               break;
           }

          // Prepare inventory update for the batch
          const newStock = inventoryItem.stock - item.quantity;
          const inventoryItemRef = doc(db, 'inventory', item.doorId);
          batch.update(inventoryItemRef, { stock: newStock, updatedAt: serverTimestamp() });
          console.log(`Prepared stock update for item ${item.doorId}: ${inventoryItem.stock} -> ${newStock}`);
      }

      if (stockCheckFailed) {
          console.error("Stock check failed:", stockErrorMessage);
          // Return specific error related to items if stock check fails
          // Ensure the structure matches expected client-side handling (e.g., field-specific errors)
          return {
              success: false,
              message: stockErrorMessage,
              // Map the error to a specific field if possible, otherwise use general error
              errors: { items: [{ message: stockErrorMessage }] } // Example: mapping to 'items' field
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
      revalidatePath('/inventory'); // Revalidate inventory list as stock changed
      firestoreOrderData.items.forEach(item => revalidatePath(`/inventory/${item.doorId}`)); // Revalidate specific item pages
      revalidatePath('/logistics'); // Revalidate logistics page
      revalidatePath('/'); // Revalidate dashboard

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
       return { success: false, message: errorMessage, errors: null }; // Return general error if batch fails
    }
}


// --- UPDATE ORDER ACTION ---
// This action needs careful consideration of what fields are updatable
// and how changes (like item quantity) affect inventory stock.
// For now, it updates basic info and status but DOES NOT adjust stock.
export async function updateOrderAction(
  orderId: string,
  data: OrderInput // Use OrderInput as the shape for incoming update data
): Promise<{ success: boolean; message: string; errors?: Record<string, any> | null }> {
   if (!db) return { success: false, message: "Database config error.", errors: null };
   if (!orderId) return { success: false, message: "Order ID is required.", errors: null };

   // --- VALIDATION ---
   const validationResult = OrderSchema.safeParse(data); // Validate incoming data
   if (!validationResult.success) {
       console.error("Update Order Validation Errors:", validationResult.error.flatten().fieldErrors);
       return { success: false, message: "Validation failed.", errors: validationResult.error.flatten().fieldErrors };
   }
   const validatedUpdateData = validationResult.data;

   console.warn(`Updating order ${orderId}. Inventory stock NOT automatically adjusted by this action. Manual stock adjustment may be needed if items/quantities changed significantly.`);

   // --- Map input data to Firestore structure for update ---
   // Selectively map fields that are intended to be updatable via the form
   const firestoreUpdateData: Record<string, any> = { // Use a generic object for flexibility
       'shippingInfo.name': validatedUpdateData.customer.name,
       'shippingInfo.email': validatedUpdateData.customer.email,
       'shippingInfo.phone': validatedUpdateData.customer.phone,
       'shippingInfo.address': validatedUpdateData.customer.address,
       // If city/state/zip are separate fields, map them here
       status: validatedUpdateData.status,
       'paymentInfo.paymentMethod': validatedUpdateData.paymentStatus, // Map paymentStatus to paymentMethod
       'trackingInfo.carrier': validatedUpdateData.shippingMethod, // Map shippingMethod to carrier
       // Update items - Be cautious: Replacing the whole array might lose important sub-data
       // Consider updating individual items if needed, which is more complex.
       // For simplicity now, replacing the array based on form input.
       items: validatedUpdateData.items.map(item => ({
            cartItemId: `${item.itemId}-${Date.now()}`, // Re-generate? Or keep existing? Needs careful thought
            doorId: item.itemId,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            finalPrice: item.price,
            imageUrl: item.image || '',
            customizations: {}, // Assuming customizations aren't editable here
        })),
       totalAmount: calculateOrderTotal(validatedUpdateData.items.map(i => ({ finalPrice: i.price, quantity: i.quantity }))), // Recalculate total
       updatedAt: serverTimestamp(), // Add updatedAt timestamp
   };

   // Remove undefined fields to avoid overwriting with null/undefined in Firestore
   Object.keys(firestoreUpdateData).forEach(key => {
       // Special handling for nested objects like shippingInfo - Check if all nested props are undefined?
       if (key === 'shippingInfo' || key === 'paymentInfo' || key === 'trackingInfo') {
           // If the nested object itself is undefined in the source `data`, skip
           // Note: This logic might need refinement based on how the form handles partial updates
       } else if (firestoreUpdateData[key] === undefined) {
           delete firestoreUpdateData[key];
       }
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

   // Optional: Validate newStatus against allowed values if necessary

   try {
     const orderDocRef = doc(db, 'orders', orderId);

     const updateData: Record<string, any> = {
         updatedAt: serverTimestamp(),
         status: newStatus, // Update the main order status
     };

      // Optionally, update tracking status based on main status transitions
      if (newStatus === 'Shipped') {
          updateData['trackingInfo.status'] = 'Shipped'; // Or 'In Transit' depending on workflow
      } else if (newStatus === 'Delivered') {
          updateData['trackingInfo.status'] = 'Delivered';
          // Maybe add actual delivery timestamp here?
          // updateData['trackingInfo.actualDelivery'] = serverTimestamp();
      } else if (newStatus === 'Processing') {
           updateData['trackingInfo.status'] = 'Shipment Information Received';
      }
      // Add more logic as needed for other status transitions

     console.log(`Attempting to update status for order ${orderId} to ${newStatus} with data:`, updateData);
     await updateDoc(orderDocRef, updateData);
     console.log(`Order ${orderId} status updated successfully.`);


     // --- REVALIDATE PATHS ---
     revalidatePath('/orders');
     revalidatePath(`/orders/${orderId}`);
     revalidatePath('/logistics'); // Status change affects logistics view
     revalidatePath('/'); // Dashboard

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
    let shipmentTrackingNumber: string | undefined; // Using tracking number as potential shipment link

    try {
        console.log(`Attempting to cancel order ${orderId}`);
        const orderSnap = await getDoc(orderDocRef);
        if (!orderSnap.exists()) {
            console.error(`Order ${orderId} not found.`);
            return { success: false, message: `Order ${orderId} not found.` };
        }

        const orderData = orderSnap.data() as Order; // Use the Order interface

        // --- Cancellation Check ---
        const currentStatus = orderData.status;
        const cancellableStatuses = ['Pending Payment', 'Processing']; // Define which statuses allow cancellation
        const nonCancellableStatuses = ['Shipped', 'Delivered', 'Cancelled', 'Refunded']; // Define non-cancellable statuses

        if (nonCancellableStatuses.includes(currentStatus)) {
            console.log(`Order ${orderId} is already ${currentStatus} and cannot be cancelled.`);
            return { success: false, message: `Order is already ${currentStatus} and cannot be cancelled.` };
        }
         // Allow cancellation for specific statuses
        if (!cancellableStatuses.includes(currentStatus)) {
             console.warn(`Order ${orderId} has status ${currentStatus}. Cancellation might not be standard procedure.`);
             // Decide if you want to proceed or return an error/warning based on your business logic
             // return { success: false, message: `Order status (${currentStatus}) does not allow standard cancellation.` };
        }


        // --- Prepare Order Update ---
        batch.update(orderDocRef, {
            status: 'Cancelled',
            'paymentInfo.paymentMethod': 'Refunded', // Assuming cancellation implies refund
            updatedAt: serverTimestamp(),
        });
        console.log(`Prepared order update for ${orderId} to Cancelled/Refunded.`);

        // --- Prepare Inventory Restock ---
         console.log(`Preparing to restock items for order ${orderId}`);
         for (const item of orderData.items) {
             const inventoryItem = await getInventoryItem(item.doorId || item.itemId); // Use doorId or fallback to itemId

             if (!inventoryItem) {
                 console.warn(`Inventory item ${item.name} (ID: ${item.doorId || item.itemId}) not found. Skipping restock.`);
                 restockSkippedCount++;
                 continue;
             }
             const currentStock = inventoryItem.stock;
             const newStock = currentStock + item.quantity;
             const inventoryItemRef = doc(db, 'inventory', inventoryItem.id); // Use fetched item's ID
             batch.update(inventoryItemRef, { stock: newStock, updatedAt: serverTimestamp() });
             itemsToRestock.push({ ref: inventoryItemRef, quantity: item.quantity, name: item.name, itemId: inventoryItem.id });
              console.log(`Prepared restock for item ${inventoryItem.id}: ${currentStock} -> ${newStock}`);
         }
          if (restockSkippedCount > 0) {
              console.warn(`${restockSkippedCount} items could not be restocked because they were not found in inventory.`);
          }

         // --- Optional: Update Linked Shipment ---
         // This part assumes a separate 'shipments' collection, which might not be the case anymore.
         // If trackingInfo is the only place shipment data lives, maybe update its status?
         shipmentTrackingNumber = orderData.trackingInfo?.trackingNumber;
         if (shipmentTrackingNumber && orderData.trackingInfo?.status !== 'Delivered') { // Only if shipment exists and not delivered
              console.log(`Updating tracking info status for order ${orderId} due to cancellation.`);
              // Update the trackingInfo within the order document itself
              batch.update(orderDocRef, {
                  'trackingInfo.status': 'Cancelled', // Or another appropriate status
                  updatedAt: serverTimestamp() // Ensure order's updatedAt is also updated
              });

             // --- IF using a separate Shipments collection (legacy/alternative setup) ---
             // const shipmentDocRef = doc(db, 'shipments', shipmentTrackingNumber); // This assumes shipment collection exists
             // try {
             //     const shipmentSnap = await getDoc(shipmentDocRef);
             //     if (shipmentSnap.exists()) {
             //         const shipmentData = shipmentSnap.data() as Shipment;
             //         // Only cancel shipment if it hasn't progressed too far
             //         // if (['Processing', 'Label Created', 'Pending Pickup'].includes(shipmentData.status)) {
             //         //     batch.update(shipmentDocRef, { status: 'Cancelled', // or appropriate status
             //                                                 updatedAt: serverTimestamp() });
             //         // }
             //     } else {
             //         console.warn(`Shipment document ${shipmentTrackingNumber} not found.`);
             //     }
             // } catch(shipmentError) {
             //     console.error(`Error checking/updating shipment ${shipmentTrackingNumber}:`, shipmentError);
             // }
             // --- End separate Shipments collection logic ---
         }


        // --- Commit Batch ---
        console.log(`Committing cancellation batch for order ${orderId}`);
        await batch.commit();
        console.log(`Order ${orderId} cancelled and batch committed successfully.`);


        // --- Revalidate Paths ---
        revalidatePath('/orders');
        revalidatePath(`/orders/${orderId}`);
        revalidatePath('/inventory');
        itemsToRestock.forEach(item => revalidatePath(`/inventory/${item.itemId}`));
        if (shipmentTrackingNumber) { // Revalidate logistics if tracking info was updated
            revalidatePath('/logistics');
        }
        revalidatePath('/'); // Dashboard

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


// --- LINK SHIPMENT ACTION (Placeholder/Needs Review) ---
// This action's purpose needs clarification in the new structure.
// It likely should update the 'trackingInfo' within the order document.
export async function linkShipmentToOrderAction(orderId: string, trackingData: { carrier: string; trackingNumber: string; status?: string }): Promise<{ success: boolean; message: string }> {
   if (!db) return { success: false, message: "Database config error." };
   if (!orderId || !trackingData || !trackingData.carrier || !trackingData.trackingNumber) {
       return { success: false, message: "Order ID, carrier, and tracking number are required." };
   }

   try {
     const orderDocRef = doc(db, 'orders', orderId);
     console.log(`Linking tracking info to order ${orderId}:`, trackingData);

     // Update the trackingInfo field within the order document
     await updateDoc(orderDocRef, {
       trackingInfo: {
           carrier: trackingData.carrier,
           trackingNumber: trackingData.trackingNumber,
           status: trackingData.status || 'Shipped', // Default status if not provided
       },
       status: 'Shipped', // Update main order status as well
       updatedAt: serverTimestamp(),
     });
     console.log(`Tracking info linked to order ${orderId} successfully.`);

     // --- REVALIDATE PATHS ---
     revalidatePath('/orders');
     revalidatePath(`/orders/${orderId}`);
     revalidatePath('/logistics'); // Shipment info affects logistics
     revalidatePath('/'); // Dashboard

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


// --- Placeholder Function (if Shipment creation is separate, which is unlikely now) ---
/*
export async function createShipmentAction(data: any): Promise<any> {
    console.warn("createShipmentAction is likely obsolete. Shipment info is part of the order.");
    return { success: false, message: "Shipment creation now handled via orders." };
}
*/

// Placeholder functions removed as they are now implemented above.
