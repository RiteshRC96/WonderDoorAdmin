'use server';

import { revalidatePath } from 'next/cache';
import { db, collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp, getDoc, writeBatch, CollectionReference } from '@/lib/firebase/firebase';
import { OrderSchema, type CreateOrderInput, type Order, type OrderInput } from '@/schemas/order'; // Import Order types/schemas
import { ShipmentSchema, type ShipmentInput, type Shipment } from '@/schemas/shipment'; // Import Shipment schema/type for initial status and potential updates
import { AddItemSchema, type AddItemInput } from '@/schemas/inventory'; // For fetching item details

// Helper function to fetch current item details (including stock) - Keep as is
async function getInventoryItem(itemId: string): Promise<(AddItemInput & { id: string }) | null> {
    if (!db) return null;
    try {
        const itemDocRef = doc(db, 'inventory', itemId);
        const docSnap = await getDoc(itemDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Use AddItemSchema for validation and coercion AFTER fetching
            const validatedData = AddItemSchema.safeParse(data);
            if (validatedData.success) {
                // Use validated data which includes coercion and defaults
                return {
                    id: docSnap.id,
                    ...validatedData.data, // Spread the successfully parsed and coerced data
                 };
            } else {
                console.warn(`Inventory item ${itemId} data validation failed:`, validatedData.error);
                 // Fallback: Attempt to return raw data but ensure critical fields are numbers
                 const stock = typeof data?.stock === 'number' ? data.stock : 0;
                 const price = typeof data?.price === 'number' ? data.price : 0;
                return { id: docSnap.id, ...(data as AddItemInput), stock, price };
            }
        }
        return null;
    } catch (error) {
        console.error(`Error fetching inventory item ${itemId}:`, error);
        return null;
    }
}


// Function to calculate order total - Keep as is
function calculateOrderTotal(items: { price: number; quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // In a real app, add logic for taxes, shipping, discounts etc.
}

// --- Create Order Action ---
export async function createOrderAction(data: CreateOrderInput): Promise<{ success: boolean; message: string; orderId?: string; shipmentId?: string; errors?: Record<string, any> | null }> {
  if (!db) {
    const errorMessage = "Database configuration error. Unable to create order.";
    console.error("Firestore database is not initialized. Cannot create order.");
    return { success: false, message: errorMessage, errors: null };
  }

  const validationResult = OrderSchema.safeParse(data);
  if (!validationResult.success) {
    console.error("Order Validation Errors:", validationResult.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Validation failed. Please check the order details.",
      errors: validationResult.error.flatten().fieldErrors || validationResult.error.errors,
    };
  }

  const validatedOrderData = validationResult.data;
  const now = Timestamp.now(); // Get a single timestamp for consistency

  // --- Prepare for Batch Write ---
  const batch = writeBatch(db);
  let stockCheckFailed = false;
  let stockErrorMessage = "";

  // 1. Prepare Order Document Reference and Data (without committing yet)
  const ordersCollectionRef = collection(db, 'orders');
  const newOrderRef = doc(ordersCollectionRef); // Generate ref to get ID

  // 2. Prepare Shipment Document Reference and Data
  const shipmentsCollectionRef = collection(db, 'shipments'); // No type assertion needed here
  const newShipmentRef = doc(shipmentsCollectionRef); // Generate ref for shipment

  const initialShipmentStatus = 'Processing'; // Set initial shipment status to Processing
  const initialHistoryEvent = {
      timestamp: now.toDate().toISOString(), // Use consistent timestamp
      status: initialShipmentStatus,
      location: 'Order Created', // Initial location note
      notes: 'Shipment record automatically created.',
  };


  // Ensure the structure matches ShipmentInput before adding timestamps etc.
  const shipmentInputData: ShipmentInput = {
       orderId: newOrderRef.id, // Use the generated order ID
       customerName: validatedOrderData.customer.name,
       carrier: 'TBD', // Default carrier, to be updated later
       trackingNumber: 'Pending', // Default tracking, update when available
       status: initialShipmentStatus,
       origin: 'Warehouse', // Default origin, adjust as needed
       destination: validatedOrderData.customer.address, // Use customer address
       estimatedDelivery: '', // Can be set later
       pieces: validatedOrderData.items.reduce((sum, item) => sum + item.quantity, 0), // Calculate total pieces
       // Optional fields, can be added later
       weight: '',
       dimensions: '',
       notes: 'Auto-generated shipment record.',
   };

   // Now add the Firestore specific fields
   const newShipmentData = {
        ...shipmentInputData,
        createdAt: now,
        updatedAt: now,
        history: [initialHistoryEvent],
        actualDelivery: null, // Set explicitly to null
    };


  // 3. Prepare Final Order Data (including the new shipmentId)
  const finalOrderData = {
      ...validatedOrderData,
      createdAt: now,
      updatedAt: now,
      total: calculateOrderTotal(validatedOrderData.items),
      shipmentId: newShipmentRef.id, // Link to the new shipment
  };


  // 4. Perform Stock Check and Prepare Inventory Updates for Batch
  try {
      for (const item of finalOrderData.items) { // item comes from validated input data
          const inventoryItem = await getInventoryItem(item.itemId); // Fetch current item data

          if (!inventoryItem) {
              stockCheckFailed = true;
              // More robust error message, avoids relying on potentially problematic item.name
              stockErrorMessage = `Inventory item with ID ${item.itemId} not found in database. Order cannot proceed.`;
              console.error(stockErrorMessage); // Log the error server-side
              break;
          }

          const currentStock = inventoryItem.stock; // Already validated as number by getInventoryItem logic
          if (currentStock < item.quantity) {
              stockCheckFailed = true;
              stockErrorMessage = `Insufficient stock for ${item.name} (ID: ${item.itemId}). Available: ${currentStock}, Ordered: ${item.quantity}.`;
              break;
          }

          const newStock = currentStock - item.quantity;
          const inventoryItemRef = doc(db, 'inventory', item.itemId);
          // Ensure we update with a server timestamp for inventory updatedAt
          batch.update(inventoryItemRef, { stock: newStock, updatedAt: serverTimestamp() });
      }

      if (stockCheckFailed) {
          console.error("Stock check failed:", stockErrorMessage);
          return { success: false, message: stockErrorMessage, errors: { items: stockErrorMessage } };
      }

      // 5. Add Order and Shipment Creation to the Batch
      batch.set(newOrderRef, finalOrderData); // Set final order data
      batch.set(newShipmentRef, newShipmentData); // Set shipment data

      // 6. Commit the Entire Batch
      console.log("Attempting to commit order creation, shipment creation, and stock update batch...");
      await batch.commit();
      const newOrderId = newOrderRef.id;
      const newShipmentId = newShipmentRef.id;
      console.log(`Successfully created order ID: ${newOrderId}, linked shipment ID: ${newShipmentId}, and updated stock.`);

      // 7. Revalidate Paths
      revalidatePath('/orders');
      revalidatePath(`/orders/${newOrderId}`);
      revalidatePath('/logistics'); // Revalidate logistics list page
      revalidatePath(`/logistics/${newShipmentId}`); // Revalidate new shipment detail page
      revalidatePath('/inventory'); // Revalidate inventory list
      finalOrderData.items.forEach(item => revalidatePath(`/inventory/${item.itemId}`));
      revalidatePath('/'); // Revalidate dashboard

      return {
        success: true,
        message: `Order ${newOrderId} created, shipment ${newShipmentId} linked, and inventory updated.`,
        orderId: newOrderId,
        shipmentId: newShipmentId, // Return shipment ID as well
      };

  } catch (error) {
      const errorMessage = `Error during batch commit: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      const userMessage = errorMessage.includes("stock")
            ? "Failed to update inventory stock. Please try again or check inventory levels."
            : "Failed to create order/shipment due to a database error.";
      return {
        success: false,
        message: userMessage,
        errors: null,
      };
    }
}

// --- Update Order Action ---
// Handles editing an existing order. Does NOT currently adjust stock automatically.
export async function updateOrderAction(
  orderId: string,
  data: OrderInput
): Promise<{ success: boolean; message: string; errors?: Record<string, any> | null }> {
  if (!db) {
    const errorMessage = "Database configuration error. Unable to update order.";
    console.error("Firestore database is not initialized.");
    return { success: false, message: errorMessage, errors: null };
  }
  if (!orderId) {
    return { success: false, message: "Order ID is required.", errors: null };
  }

  const validationResult = OrderSchema.safeParse(data);
  if (!validationResult.success) {
    console.error("Order Update Validation Errors:", validationResult.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Validation failed. Please check the order details.",
      errors: validationResult.error.flatten().fieldErrors || validationResult.error.errors,
    };
  }

  console.warn(`Updating order ${orderId}. Inventory stock levels are NOT automatically adjusted by this edit action. Manual adjustment may be needed.`);

  const orderDataToUpdate = {
    ...validationResult.data,
    updatedAt: serverTimestamp(), // Update the timestamp
    total: calculateOrderTotal(validationResult.data.items), // Recalculate total based on potentially edited items
  };

  try {
    console.log(`Attempting to update order with ID: ${orderId}`);
    const orderDocRef = doc(db, 'orders', orderId);
    await updateDoc(orderDocRef, orderDataToUpdate);

    console.log(`Successfully updated order with ID: ${orderId}`);

    revalidatePath('/orders');
    revalidatePath(`/orders/${orderId}`);
    revalidatePath(`/orders/${orderId}/edit`);
    revalidatePath('/'); // Revalidate dashboard

    return {
      success: true,
      message: `Order '${orderId}' updated successfully! Remember to manually adjust stock if items changed significantly.`,
    };

  } catch (error) {
    const errorMessage = `Error updating order in Firestore (ID: ${orderId}): ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return {
      success: false,
      message: "Failed to update order due to a database error. Please try again.",
      errors: null,
    };
  }
}


// --- Update Order Status Action ---
// Updates only the order status and payment status.
export async function updateOrderStatusAction(orderId: string, newStatus: Order['status'], newPaymentStatus?: Order['paymentStatus']): Promise<{ success: boolean; message: string }> {
   if (!db) {
     const errorMessage = "Database configuration error. Unable to update order status.";
     console.error("Firestore database is not initialized. Cannot update order status.");
     return { success: false, message: errorMessage };
   }
   if (!orderId) {
     return { success: false, message: "Order ID is required." };
   }
   const validStatuses = OrderSchema.shape.status.options;
   if (!validStatuses.includes(newStatus)) {
      return { success: false, message: `Invalid status: ${newStatus}` };
   }
   const validPaymentStatuses = OrderSchema.shape.paymentStatus.options;
    if (newPaymentStatus && !validPaymentStatuses.includes(newPaymentStatus)) {
      return { success: false, message: `Invalid payment status: ${newPaymentStatus}` };
    }

   try {
     console.log(`Attempting to update status for order ID: ${orderId} to ${newStatus}`);
     const orderDocRef = doc(db, 'orders', orderId);

      const updateData: { status: Order['status']; updatedAt: Timestamp; paymentStatus?: Order['paymentStatus'] } = {
         status: newStatus,
         updatedAt: Timestamp.now(),
       };
       if (newPaymentStatus) {
         updateData.paymentStatus = newPaymentStatus;
       }

     await updateDoc(orderDocRef, updateData);
     console.log(`Successfully updated status for order ID: ${orderId}`);

     // If status is now 'Shipped', update the linked shipment if not already shipped/delivered/exception
     if (newStatus === 'Shipped') {
        const orderSnap = await getDoc(orderDocRef);
        if (orderSnap.exists()) {
            const orderData = orderSnap.data() as Order;
            if (orderData.shipmentId) {
                 const shipmentDocRef = doc(db, 'shipments', orderData.shipmentId);
                 const shipmentSnap = await getDoc(shipmentDocRef);
                 if (shipmentSnap.exists()) {
                     const shipmentData = shipmentSnap.data() as Shipment;
                     // Only update shipment status if it's still in a pre-shipped state
                     if (['Processing', 'Label Created'].includes(shipmentData.status)) {
                        const { updateShipmentStatusAction: updateLinkedShipmentStatus } = await import('@/app/logistics/actions');
                        await updateLinkedShipmentStatus(orderData.shipmentId, 'Picked Up'); // Or 'In Transit' depending on workflow
                        console.log(`Updated linked shipment ${orderData.shipmentId} status to Picked Up.`);
                     }
                 }
            }
        }
     }

     revalidatePath('/orders');
     revalidatePath(`/orders/${orderId}`);
     revalidatePath('/'); // Revalidate dashboard
     // Revalidate logistics if shipment was potentially updated
     if (newStatus === 'Shipped') {
          const orderSnap = await getDoc(orderDocRef);
          if (orderSnap.exists()) {
              const orderData = orderSnap.data() as Order;
              if (orderData.shipmentId) {
                  revalidatePath('/logistics');
                  revalidatePath(`/logistics/${orderData.shipmentId}`);
              }
          }
      }


     return { success: true, message: "Order status updated successfully." };
   } catch (error) {
     const errorMessage = `Error updating order status (ID: ${orderId}): ${error instanceof Error ? error.message : String(error)}`;
     console.error(errorMessage);
     return {
       success: false,
       message: "Failed to update order status due to a database error.",
     };
   }
}

// --- Cancel Order Action (Includes Inventory Restock) ---
// Cancels the order, sets payment to Refunded, and attempts to restock inventory.
// Optionally updates linked shipment status.
export async function cancelOrderAction(orderId: string): Promise<{ success: boolean; message: string }> {
    if (!db) {
        const errorMessage = "Database configuration error. Unable to cancel order.";
        console.error("Firestore database is not initialized. Cannot cancel order.");
        return { success: false, message: errorMessage };
    }
    if (!orderId) {
        return { success: false, message: "Order ID is required." };
    }

    const orderDocRef = doc(db, 'orders', orderId);
    const batch = writeBatch(db);
    let itemsToRestock: { ref: any; quantity: number; name: string; itemId: string }[] = [];
    let restockSkippedCount = 0;
    let restockError = false;
    let shipmentIdToUpdate: string | undefined; // To potentially update shipment status

    try {
        console.log(`Attempting to cancel order ID: ${orderId} and restock items.`);
        const orderSnap = await getDoc(orderDocRef);

        if (!orderSnap.exists()) {
            return { success: false, message: `Order ${orderId} not found.` };
        }

        const orderData = orderSnap.data() as Order;
        shipmentIdToUpdate = orderData.shipmentId; // Get shipment ID if it exists

        // Prevent cancellation if already shipped or delivered
        if (['Shipped', 'Delivered'].includes(orderData.status)) {
            return { success: false, message: `Cannot cancel order that is already ${orderData.status}. Consider a return/refund process instead.` };
        }
        if (orderData.status === 'Cancelled') {
             return { success: true, message: `Order ${orderId} is already cancelled.` };
        }

        // Prepare to update order status
        batch.update(orderDocRef, {
            status: 'Cancelled',
            paymentStatus: 'Refunded', // Assume refund is processed on cancellation
            updatedAt: serverTimestamp(),
        });

        // Prepare to restock inventory items
         for (const item of orderData.items) {
             const inventoryItem = await getInventoryItem(item.itemId); // Fetch current item data

             if (!inventoryItem) {
                 console.warn(`Inventory item ${item.name} (ID: ${item.itemId}) not found during cancellation restock. Skipping restock for this item.`);
                 restockSkippedCount++;
                 continue; // Skip if item doesn't exist
             }

             const currentStock = inventoryItem.stock; // Already validated as number
             // No need to check typeof currentStock !== 'number' due to getInventoryItem logic

             const newStock = currentStock + item.quantity;
             const inventoryItemRef = doc(db, 'inventory', item.itemId);
             console.log(`Restocking item ${item.itemId}: Current Stock: ${currentStock}, Quantity to Add: ${item.quantity}, New Stock: ${newStock}`);
             batch.update(inventoryItemRef, { stock: newStock, updatedAt: serverTimestamp() });
             itemsToRestock.push({ ref: inventoryItemRef, quantity: item.quantity, name: item.name, itemId: item.itemId });

         }

         // Optional: Update linked shipment status if order is cancelled before shipping
         if (shipmentIdToUpdate) {
             const shipmentDocRef = doc(db, 'shipments', shipmentIdToUpdate);
             const shipmentSnap = await getDoc(shipmentDocRef); // Check current status
             if (shipmentSnap.exists()) {
                 const shipmentData = shipmentSnap.data() as Shipment;
                 // Only cancel shipment if it hasn't already progressed far
                 if (['Processing', 'Label Created'].includes(shipmentData.status)) {
                     console.log(`Marking linked shipment ${shipmentIdToUpdate} as Exception (due to order cancellation).`);
                     batch.update(shipmentDocRef, {
                         status: 'Exception', // Or a dedicated 'Cancelled' status if you add it to ShipmentSchema
                         notes: `Shipment cancelled - Order ${orderId} cancelled.`,
                         updatedAt: serverTimestamp(),
                         // Optionally add a history event here too using arrayUnion in a separate update if needed after batch commit
                     });
                 } else {
                     console.log(`Shipment ${shipmentIdToUpdate} has already progressed (${shipmentData.status}), not changing status due to order cancellation.`);
                 }
             }
         }


        await batch.commit();
        console.log(`Successfully processed cancellation for order ${orderId}.`);
         if (itemsToRestock.length > 0) console.log(`Updated stock for ${itemsToRestock.length} item types.`);
         if (restockSkippedCount > 0) console.warn(`Skipped restocking for ${restockSkippedCount} item types.`);
         if (shipmentIdToUpdate) console.log(`Status update attempted for linked shipment ${shipmentIdToUpdate}.`);

        // Revalidate paths
        revalidatePath('/orders');
        revalidatePath(`/orders/${orderId}`);
        revalidatePath('/inventory');
        itemsToRestock.forEach(item => revalidatePath(`/inventory/${item.itemId}`));
        if (shipmentIdToUpdate) {
            revalidatePath('/logistics');
            revalidatePath(`/logistics/${shipmentIdToUpdate}`);
        }
        revalidatePath('/');

        let successMessage = "Order cancelled successfully.";
        if (itemsToRestock.length > 0) successMessage += " Inventory restocked.";
        if (restockSkippedCount > 0) successMessage += ` Skipped restock for ${restockSkippedCount} item(s). Check logs.`;
         if (shipmentIdToUpdate) successMessage += ` Linked shipment status updated if applicable.`;

        return { success: true, message: successMessage };

    } catch (error) {
        const errorMessage = `Error cancelling order (ID: ${orderId}): ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMessage);
        return {
            success: false,
            message: "Failed to cancel order due to a database error. Inventory/shipment status may be inconsistent.",
        };
    }
}


// Action to link a shipment ID to an order (if needed manually)
// Kept for edge cases or manual intervention needs.
export async function linkShipmentToOrderAction(orderId: string, shipmentId: string): Promise<{ success: boolean; message: string }> {
   if (!db) {
     const errorMessage = "Database configuration error. Unable to link shipment.";
     console.error("Firestore database is not initialized. Cannot link shipment.");
     return { success: false, message: errorMessage };
   }
   if (!orderId || !shipmentId) {
     return { success: false, message: "Order ID and Shipment ID are required." };
   }

   try {
     console.log(`Attempting to manually link shipment ${shipmentId} to order ${orderId}`);
     const orderDocRef = doc(db, 'orders', orderId);
     await updateDoc(orderDocRef, {
       shipmentId: shipmentId,
       updatedAt: Timestamp.now(),
       // Avoid automatic status change on manual link, as the reason might vary.
       // status: 'Shipped',
     });
     console.log(`Successfully manually linked shipment to order.`);

     revalidatePath('/orders');
     revalidatePath(`/orders/${orderId}`);
     revalidatePath('/logistics');
     revalidatePath(`/logistics/${shipmentId}`);
     revalidatePath('/');

     return { success: true, message: "Shipment manually linked to order successfully." };
   } catch (error) {
     const errorMessage = `Error linking shipment (Order ID: ${orderId}, Shipment ID: ${shipmentId}): ${error instanceof Error ? error.message : String(error)}`;
     console.error(errorMessage);
     return {
       success: false,
       message: "Failed to link shipment due to a database error.",
     };
   }
}
