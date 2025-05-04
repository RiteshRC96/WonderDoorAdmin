'use server';

import { revalidatePath } from 'next/cache';
import { db, collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp, getDoc, writeBatch } from '@/lib/firebase/firebase';
import { OrderSchema, type CreateOrderInput, type Order, type OrderInput } from '@/schemas/order'; // Import Order types/schemas
import type { AddItemInput } from '@/schemas/inventory'; // For fetching item details

// Helper function to fetch current item details (including stock)
async function getInventoryItem(itemId: string): Promise<(AddItemInput & { id: string }) | null> {
    if (!db) return null;
    try {
        const itemDocRef = doc(db, 'inventory', itemId);
        const docSnap = await getDoc(itemDocRef);
        if (docSnap.exists()) {
            // Ensure data conforms to AddItemInput, especially stock and price types
            const data = docSnap.data();
            const validatedData = AddItemSchema.partial().safeParse(data); // Use partial schema for existing data
            if (validatedData.success) {
                return { id: docSnap.id, ...(validatedData.data as AddItemInput) };
            } else {
                console.warn(`Inventory item ${itemId} data validation failed:`, validatedData.error);
                // Return potentially incomplete data but log warning
                return { id: docSnap.id, ...(data as AddItemInput) };
            }
        }
        return null;
    } catch (error) {
        console.error(`Error fetching inventory item ${itemId}:`, error);
        return null;
    }
}


// Function to calculate order total
function calculateOrderTotal(items: { price: number; quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // In a real app, add logic for taxes, shipping, discounts etc.
}

// --- Create Order Action ---
export async function createOrderAction(data: CreateOrderInput): Promise<{ success: boolean; message: string; orderId?: string; errors?: Record<string, any> | null }> {
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
      // Use fieldErrors for specific field issues, errors for general/item array issues
      errors: validationResult.error.flatten().fieldErrors || validationResult.error.errors,
    };
  }

  const newOrderData = {
    ...validationResult.data,
    createdAt: serverTimestamp(), // Use server timestamp for creation
    updatedAt: serverTimestamp(), // Also set updatedAt on creation
    total: calculateOrderTotal(validationResult.data.items), // Calculate total
    // shipmentId can be added later when a shipment is created
  };

  // --- Inventory Stock Update Logic ---
  const batch = writeBatch(db);
  let stockCheckFailed = false;
  let stockErrorMessage = "";

  try {
      for (const item of newOrderData.items) {
          const inventoryItemRef = doc(db, 'inventory', item.itemId);
          const inventoryItemSnap = await getDoc(inventoryItemRef); // Get current stock within potential transaction/batch

          if (!inventoryItemSnap.exists()) {
              stockCheckFailed = true;
              stockErrorMessage = `Inventory item ${item.name} (ID: ${item.itemId}) not found.`;
              break;
          }

          const inventoryData = inventoryItemSnap.data();
          const currentStock = inventoryData?.stock; // Access stock field
          // Ensure currentStock is a number before comparing
          if (typeof currentStock !== 'number' || currentStock < item.quantity) {
              stockCheckFailed = true;
              stockErrorMessage = `Insufficient stock for ${item.name}. Available: ${currentStock ?? 'N/A'}, Ordered: ${item.quantity}.`;
              break;
          }

          const newStock = currentStock - item.quantity;
          batch.update(inventoryItemRef, { stock: newStock, updatedAt: serverTimestamp() });
      }

      if (stockCheckFailed) {
          console.error("Stock check failed:", stockErrorMessage);
          return { success: false, message: stockErrorMessage, errors: { items: stockErrorMessage } };
      }

      // Add the order to the batch AFTER successful stock check
      const ordersCollectionRef = collection(db, 'orders');
      const newOrderRef = doc(ordersCollectionRef); // Create a ref first to get the ID
      batch.set(newOrderRef, newOrderData);

      console.log("Attempting to commit order creation and stock update batch...");
      await batch.commit(); // Commit the batch (creates order and updates stock atomically)
      const newOrderId = newOrderRef.id; // Get the ID from the ref
      console.log(`Successfully added order with ID: ${newOrderId} and updated stock.`);

      // Revalidate paths after successful commit
      revalidatePath('/orders');
      revalidatePath(`/orders/${newOrderId}`);
      revalidatePath('/inventory'); // Revalidate inventory list
      newOrderData.items.forEach(item => revalidatePath(`/inventory/${item.itemId}`)); // Revalidate specific items
      revalidatePath('/'); // Revalidate dashboard

      return {
        success: true,
        message: `Order ${newOrderId} created successfully! Inventory updated.`,
        orderId: newOrderId,
      };
  } catch (error) {
      const errorMessage = `Error during order creation/stock update: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      // More specific error message if possible
      const userMessage = errorMessage.includes("stock")
            ? "Failed to update inventory stock. Please try again or check inventory levels."
            : "Failed to create order due to a database error.";
      return {
        success: false,
        message: userMessage,
        errors: null,
      };
    }
}

// --- Update Order Action ---
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

  // *** Important Note: Inventory Stock Adjustment on Edit ***
  // This basic update does NOT adjust inventory stock based on changes to the items array.
  // A robust implementation would require comparing original vs new items and using a transaction.
  console.warn(`Updating order ${orderId}. Inventory stock levels are NOT automatically adjusted by this edit action.`);


  const orderDataToUpdate = {
    ...validationResult.data,
    updatedAt: serverTimestamp(), // Update the timestamp
    total: calculateOrderTotal(validationResult.data.items), // Recalculate total
  };

  try {
    console.log(`Attempting to update order with ID: ${orderId}`);
    const orderDocRef = doc(db, 'orders', orderId);
    await updateDoc(orderDocRef, orderDataToUpdate);

    console.log(`Successfully updated order with ID: ${orderId}`);

    // Revalidate relevant paths
    revalidatePath('/orders');
    revalidatePath(`/orders/${orderId}`);
    revalidatePath(`/orders/${orderId}/edit`);
    revalidatePath('/'); // Revalidate dashboard

    return {
      success: true,
      message: `Order '${orderId}' updated successfully! Remember to manually adjust stock if items changed.`,
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
export async function updateOrderStatusAction(orderId: string, newStatus: Order['status'], newPaymentStatus?: Order['paymentStatus']): Promise<{ success: boolean; message: string }> {
   if (!db) {
     const errorMessage = "Database configuration error. Unable to update order status.";
     console.error("Firestore database is not initialized. Cannot update order status.");
     return { success: false, message: errorMessage };
   }
   if (!orderId) {
     return { success: false, message: "Order ID is required." };
   }
   // Validate status against the enum if necessary (though TypeScript helps here)
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
         updatedAt: Timestamp.now(), // Use client-side Timestamp for update
       };
       if (newPaymentStatus) {
         updateData.paymentStatus = newPaymentStatus;
       }

     await updateDoc(orderDocRef, updateData);
     console.log(`Successfully updated status for order ID: ${orderId}`);

     revalidatePath('/orders'); // Revalidate the list page
     revalidatePath(`/orders/${orderId}`); // Revalidate the detail page
     revalidatePath('/'); // Revalidate dashboard

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

    try {
        console.log(`Attempting to cancel order ID: ${orderId} and restock items.`);
        const orderSnap = await getDoc(orderDocRef);

        if (!orderSnap.exists()) {
            return { success: false, message: `Order ${orderId} not found.` };
        }

        const orderData = orderSnap.data() as Order;

        // Prevent cancelling if already shipped or delivered
        if (['Shipped', 'Delivered'].includes(orderData.status)) {
            return { success: false, message: `Cannot cancel order that is already ${orderData.status}.` };
        }
        if (orderData.status === 'Cancelled') {
             return { success: true, message: `Order ${orderId} is already cancelled.` }; // Idempotent
        }

        // Prepare to update order status
        batch.update(orderDocRef, {
            status: 'Cancelled',
            paymentStatus: 'Refunded', // Assuming cancellation implies refund
            updatedAt: serverTimestamp(),
        });

        // Prepare to restock inventory items
        for (const item of orderData.items) {
            const inventoryItemRef = doc(db, 'inventory', item.itemId);
            try {
                const inventoryItemSnap = await getDoc(inventoryItemRef);

                if (!inventoryItemSnap.exists()) {
                    console.warn(`Inventory item ${item.name} (ID: ${item.itemId}) not found during cancellation restock. Skipping restock for this item.`);
                    restockSkippedCount++;
                    continue; // Skip if item doesn't exist, but continue cancellation
                }

                const inventoryData = inventoryItemSnap.data();
                const currentStock = inventoryData?.stock;

                // Ensure currentStock is a number before adding
                if (typeof currentStock !== 'number') {
                    console.error(`Invalid stock value for item ${item.itemId} during restock:`, currentStock, ". Skipping restock for this item.");
                    restockSkippedCount++;
                    restockError = true; // Flag that there was an issue
                    continue;
                }

                const newStock = currentStock + item.quantity;
                console.log(`Restocking item ${item.itemId}: Current Stock: ${currentStock}, Quantity to Add: ${item.quantity}, New Stock: ${newStock}`);
                batch.update(inventoryItemRef, { stock: newStock, updatedAt: serverTimestamp() });
                itemsToRestock.push({ ref: inventoryItemRef, quantity: item.quantity, name: item.name, itemId: item.itemId }); // Keep track for logging/revalidation

            } catch (itemError) {
                console.error(`Error processing inventory item ${item.itemId} during restock:`, itemError);
                restockSkippedCount++;
                restockError = true; // Flag that there was an issue with this item
                // Decide whether to halt the entire batch or just skip this item.
                // For now, we skip the item and continue.
            }
        }

        // Commit the batch
        await batch.commit();
        console.log(`Successfully processed cancellation for order ${orderId}.`);
         if (itemsToRestock.length > 0) {
            console.log(`Updated stock for ${itemsToRestock.length} item types.`);
         }
         if (restockSkippedCount > 0) {
             console.warn(`Skipped restocking for ${restockSkippedCount} item types due to errors or item not found.`);
         }


        // Revalidate paths
        revalidatePath('/orders');
        revalidatePath(`/orders/${orderId}`);
        revalidatePath('/inventory');
        itemsToRestock.forEach(item => revalidatePath(`/inventory/${item.itemId}`));
        revalidatePath('/'); // Revalidate dashboard

        let successMessage = "Order cancelled successfully.";
        if (itemsToRestock.length > 0) successMessage += " Inventory restocked.";
        if (restockSkippedCount > 0) successMessage += ` Skipped restock for ${restockSkippedCount} item(s). Check logs.`;

        return { success: true, message: successMessage };

    } catch (error) {
        const errorMessage = `Error cancelling order (ID: ${orderId}): ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMessage);
        return {
            success: false,
            message: "Failed to cancel order due to a database error. Inventory may not have been restocked correctly.",
        };
    }
}


// Potentially add an action to link a shipment ID to an order
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
     console.log(`Attempting to link shipment ${shipmentId} to order ${orderId}`);
     const orderDocRef = doc(db, 'orders', orderId);
     await updateDoc(orderDocRef, {
       shipmentId: shipmentId,
       updatedAt: Timestamp.now(), // Update timestamp
       status: 'Shipped', // Often, linking a shipment means the order is now 'Shipped'
     });
     console.log(`Successfully linked shipment to order.`);

     revalidatePath('/orders');
     revalidatePath(`/orders/${orderId}`);
     revalidatePath('/logistics'); // Revalidate logistics too if needed
     revalidatePath(`/logistics/${shipmentId}`);
     revalidatePath('/'); // Revalidate dashboard

     return { success: true, message: "Shipment linked to order successfully." };
   } catch (error) {
     const errorMessage = `Error linking shipment (Order ID: ${orderId}, Shipment ID: ${shipmentId}): ${error instanceof Error ? error.message : String(error)}`;
     console.error(errorMessage);
     return {
       success: false,
       message: "Failed to link shipment due to a database error.",
     };
   }
}
