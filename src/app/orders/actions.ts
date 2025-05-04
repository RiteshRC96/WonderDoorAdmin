
'use server';

import { revalidatePath } from 'next/cache';
import { db, collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp, getDoc, writeBatch, CollectionReference } from '@/lib/firebase/firebase';
import { OrderSchema, type CreateOrderInput, type Order, type OrderInput } from '@/schemas/order'; // Import Order types/schemas
import { ShipmentSchema, type ShipmentInput, type Shipment } from '@/schemas/shipment'; // Import Shipment schema/type for initial status and potential updates
import { AddItemSchema, type AddItemInput } from '@/schemas/inventory'; // For fetching item details

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


// Function to calculate order total - needs update for new item price field ('finalPrice')
function calculateOrderTotal(items: { finalPrice: number; quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);
  // In a real app, add logic for taxes, shipping, discounts etc.
}


// --- CREATE ORDER ACTION (NEEDS SIGNIFICANT UPDATE) ---
/*
export async function createOrderAction(data: CreateOrderInput): Promise<{ success: boolean; message: string; orderId?: string; shipmentId?: string; errors?: Record<string, any> | null }> {
  // ... Firestore check ...

  // --- VALIDATION ---
  // Need to validate against a schema that matches the *input* data, which might differ from Firestore structure.
  // For now, using the potentially outdated OrderSchema.
  const validationResult = OrderSchema.safeParse(data);
  if (!validationResult.success) {
    // ... handle validation errors ...
    return { success: false, message: "Validation failed.", errors: validationResult.error.flatten().fieldErrors };
  }
  const validatedInputData = validationResult.data; // This data might not match Firestore structure directly

  const now = Timestamp.now();
  const batch = writeBatch(db);
  let stockCheckFailed = false;
  let stockErrorMessage = "";

  // --- PREPARE FIRESTORE DATA ---
  const ordersCollectionRef = collection(db, 'orders');
  const newOrderRef = doc(ordersCollectionRef); // Generate ref for ID

  // Map validatedInputData to the actual Firestore structure
  const firestoreOrderData = {
      items: validatedInputData.items.map(item => ({ // Map items
          cartItemId: `${item.itemId}-${Date.now()}`, // Generate a unique cart item ID
          doorId: item.itemId, // Map itemId to doorId
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          finalPrice: item.price, // Map price to finalPrice
          imageUrl: item.image || '',
          // Add customizations if applicable based on input data
          customizations: {}, // Placeholder
      })),
      orderDate: now,
      paymentInfo: {
          paymentMethod: validatedInputData.paymentStatus || 'N/A', // Map paymentStatus or provide default
      },
      shippingInfo: {
          name: validatedInputData.customer.name,
          email: validatedInputData.customer.email,
          phone: validatedInputData.customer.phone,
          address: validatedInputData.customer.address,
          // Need city, state, zipCode from input data or defaults
          city: 'N/A',
          state: 'N/A',
          zipCode: 'N/A',
      },
      status: validatedInputData.status, // Use status from input
      totalAmount: calculateOrderTotal(validatedInputData.items.map(i => ({ finalPrice: i.price, quantity: i.quantity }))), // Recalculate total based on input price
      trackingInfo: { // Default tracking info
          status: "Processing",
          // carrier/trackingNumber might be set later
      },
      userId: "placeholder_user_id", // Replace with actual authenticated user ID
      // Remove fields not present in the target Firestore structure (like 'customer', 'total', etc.)
  };

  // --- PREPARE SHIPMENT DATA (if applicable) ---
  // This logic also needs update based on when/how shipments are created
  const shipmentsCollectionRef = collection(db, 'shipments');
  const newShipmentRef = doc(shipmentsCollectionRef);
  // ... (Map data to shipment structure, similar to order mapping)

  // --- STOCK CHECK & INVENTORY UPDATES ---
  try {
      for (const item of firestoreOrderData.items) { // Iterate over mapped items
          const inventoryItem = await getInventoryItem(item.doorId); // Use doorId to fetch inventory

          if (!inventoryItem) {
              stockCheckFailed = true;
              stockErrorMessage = `Inventory item with ID ${item.doorId} not found.`;
              break;
          }
          // ... (rest of stock check logic using inventoryItem.stock and item.quantity) ...
          const newStock = inventoryItem.stock - item.quantity;
          const inventoryItemRef = doc(db, 'inventory', item.doorId);
          batch.update(inventoryItemRef, { stock: newStock, updatedAt: serverTimestamp() });
      }

      if (stockCheckFailed) {
          return { success: false, message: stockErrorMessage, errors: { items: stockErrorMessage } };
      }

      // --- ADD TO BATCH & COMMIT ---
      batch.set(newOrderRef, firestoreOrderData);
      // batch.set(newShipmentRef, firestoreShipmentData); // Add shipment if created

      await batch.commit();
      const newOrderId = newOrderRef.id;
      // const newShipmentId = newShipmentRef.id;

      // --- REVALIDATE ---
      revalidatePath('/orders');
      revalidatePath(`/orders/${newOrderId}`);
      // ... revalidate other relevant paths ...

      return {
        success: true,
        message: `Order ${newOrderId} created successfully.`, // Adjust message
        orderId: newOrderId,
        // shipmentId: newShipmentId,
      };

  } catch (error) {
      // ... error handling ...
      return { success: false, message: "Failed to create order.", errors: null };
    }
}
*/

// --- UPDATE ORDER ACTION (NEEDS UPDATE) ---
/*
export async function updateOrderAction(
  orderId: string,
  data: OrderInput // Assuming OrderInput matches the expected *update* structure
): Promise<{ success: boolean; message: string; errors?: Record<string, any> | null }> {
   // ... Firestore check ...
   // ... Validation using an appropriate schema for updates ...

   console.warn(`Updating order ${orderId}. Inventory stock NOT automatically adjusted. Manual adjustment may be needed.`);

   // --- Map input data to Firestore structure for update ---
   const firestoreUpdateData = {
       // Map fields from 'data' to the Firestore structure
       'shippingInfo.name': data.shippingInfo?.name,
       'shippingInfo.address': data.shippingInfo?.address,
       // ... map other updatable fields ...
       items: data.items?.map(item => ({ /* ... map item fields ... *\/ })),
       status: data.status,
       totalAmount: calculateOrderTotal(data.items || []), // Recalculate if items changed
       updatedAt: serverTimestamp(), // Add updatedAt timestamp
   };
   // Remove undefined fields to avoid overwriting with null in Firestore
   Object.keys(firestoreUpdateData).forEach(key => {
       if (firestoreUpdateData[key as keyof typeof firestoreUpdateData] === undefined) {
           delete firestoreUpdateData[key as keyof typeof firestoreUpdateData];
       }
   });


  try {
    const orderDocRef = doc(db, 'orders', orderId);
    await updateDoc(orderDocRef, firestoreUpdateData);

    // ... Revalidate paths ...

    return {
      success: true,
      message: `Order '${orderId}' updated successfully! Remember to manually adjust stock if items changed.`,
    };

  } catch (error) {
    // ... error handling ...
    return { success: false, message: "Failed to update order.", errors: null };
  }
}
*/

// --- UPDATE ORDER STATUS ACTION (NEEDS UPDATE) ---
// This needs to decide which field in Firestore represents the "status" to update (e.g., top-level 'status', 'trackingInfo.status').
/*
export async function updateOrderStatusAction(orderId: string, newStatus: string, /* Add other relevant params *\/): Promise<{ success: boolean; message: string }> {
   // ... Firestore check ...
   // ... Validation ...

   try {
     const orderDocRef = doc(db, 'orders', orderId);

     const updateData: any = {
         updatedAt: Timestamp.now(),
         // Determine which status field to update based on context
         status: newStatus, // Or 'trackingInfo.status': newStatus
       };

     await updateDoc(orderDocRef, updateData);

     // ... Potentially update linked shipment or perform other side effects ...

     // ... Revalidate paths ...

     return { success: true, message: "Order status updated successfully." };
   } catch (error) {
     // ... error handling ...
     return { success: false, message: "Failed to update order status." };
   }
}
*/

// --- CANCEL ORDER ACTION (NEEDS UPDATE) ---
/*
export async function cancelOrderAction(orderId: string): Promise<{ success: boolean; message: string }> {
    // ... Firestore check ...
    if (!orderId) return { success: false, message: "Order ID required." };

    const orderDocRef = doc(db, 'orders', orderId);
    const batch = writeBatch(db);
    let itemsToRestock: { ref: any; quantity: number; name: string; itemId: string }[] = [];
    let restockSkippedCount = 0;
    let shipmentTrackingNumber: string | undefined; // Assuming trackingNumber is shipment ID

    try {
        const orderSnap = await getDoc(orderDocRef);
        if (!orderSnap.exists()) return { success: false, message: `Order ${orderId} not found.` };

        const orderData = orderSnap.data(); // Data matching Firestore structure

        // --- Cancellation Check ---
        // Update status field based on Firestore structure (e.g., orderData.status or orderData.trackingInfo.status)
        const currentStatus = orderData.status; // Or orderData.trackingInfo.status
        if (['Shipped', 'Delivered'].includes(currentStatus)) { // Adjust statuses as needed
            return { success: false, message: `Cannot cancel order that is already ${currentStatus}.` };
        }
        if (currentStatus === 'Cancelled') {
             return { success: true, message: `Order ${orderId} is already cancelled.` };
        }

        // --- Prepare Order Update ---
        batch.update(orderDocRef, {
            status: 'Cancelled', // Update appropriate status field
            'paymentInfo.paymentMethod': 'Refunded', // Update payment info if needed
            updatedAt: serverTimestamp(), // Assuming an updatedAt field exists
        });

        // --- Prepare Inventory Restock ---
         for (const item of orderData.items) {
             const inventoryItem = await getInventoryItem(item.doorId); // Use doorId
             if (!inventoryItem) {
                 console.warn(`Inventory item ${item.name} (ID: ${item.doorId}) not found. Skipping restock.`);
                 restockSkippedCount++;
                 continue;
             }
             const currentStock = inventoryItem.stock;
             const newStock = currentStock + item.quantity;
             const inventoryItemRef = doc(db, 'inventory', item.doorId);
             batch.update(inventoryItemRef, { stock: newStock, updatedAt: serverTimestamp() });
             itemsToRestock.push({ ref: inventoryItemRef, quantity: item.quantity, name: item.name, itemId: item.doorId });
         }

         // --- Optional: Update Linked Shipment ---
         shipmentTrackingNumber = orderData.trackingInfo?.trackingNumber;
         if (shipmentTrackingNumber) {
             // Assuming shipment ID = tracking number for lookup, might need adjustment
             const shipmentDocRef = doc(db, 'shipments', shipmentTrackingNumber); // This assumes shipment collection exists
             const shipmentSnap = await getDoc(shipmentDocRef);
             if (shipmentSnap.exists()) {
                 const shipmentData = shipmentSnap.data();
                 // Update shipment status based on its current state
                 // if (['Processing', 'Label Created'].includes(shipmentData.status)) {
                 //     batch.update(shipmentDocRef, { status: 'Cancelled' /* or appropriate status */, updatedAt: serverTimestamp() });
                 // }
             }
         }

        // --- Commit Batch ---
        await batch.commit();

        // --- Revalidate Paths ---
        revalidatePath('/orders');
        revalidatePath(`/orders/${orderId}`);
        revalidatePath('/inventory');
        itemsToRestock.forEach(item => revalidatePath(`/inventory/${item.itemId}`));
        if (shipmentTrackingNumber) {
            revalidatePath('/logistics');
            revalidatePath(`/logistics/${shipmentTrackingNumber}`); // Assuming logistics path uses tracking number
        }
        revalidatePath('/');

        let successMessage = "Order cancelled successfully.";
        // ... add restock/shipment update info to message ...

        return { success: true, message: successMessage };

    } catch (error) {
        // ... error handling ...
        return { success: false, message: "Failed to cancel order." };
    }
}
*/

// --- LINK SHIPMENT ACTION (NEEDS UPDATE) ---
// This action might need to update the 'trackingInfo' map within the order document.
/*
export async function linkShipmentToOrderAction(orderId: string, shipmentId: string /* or tracking info *\/): Promise<{ success: boolean; message: string }> {
   // ... Firestore check ...
   if (!orderId || !shipmentId) return { success: false, message: "Order ID and Shipment info required." };

   try {
     const orderDocRef = doc(db, 'orders', orderId);
     // Update the trackingInfo field within the order document
     await updateDoc(orderDocRef, {
       // Example: updating trackingInfo - structure depends on what 'shipmentId' represents
       'trackingInfo.trackingNumber': shipmentId, // If shipmentId is the tracking number
       'trackingInfo.status': 'Processing', // Or an initial shipment status
       'trackingInfo.carrier': 'TBD', // Or carrier info if available
       updatedAt: Timestamp.now(), // Assuming an updatedAt field exists
     });

     // ... Revalidate paths ...

     return { success: true, message: "Shipment linked to order successfully." };
   } catch (error) {
     // ... error handling ...
     return { success: false, message: "Failed to link shipment." };
   }
}
*/

// --- Placeholder Functions ---
// Add placeholder async functions to avoid build errors if actions are imported elsewhere

export async function createOrderAction(data: any): Promise<any> {
    console.warn("createOrderAction needs implementation based on the new Firestore structure.");
    return { success: false, message: "Create order action not yet implemented for new structure." };
}

export async function updateOrderAction(orderId: string, data: any): Promise<any> {
     console.warn("updateOrderAction needs implementation based on the new Firestore structure.");
     return { success: false, message: "Update order action not yet implemented for new structure." };
}

export async function updateOrderStatusAction(orderId: string, newStatus: string): Promise<any> {
     console.warn("updateOrderStatusAction needs implementation based on the new Firestore structure.");
     return { success: false, message: "Update order status action not yet implemented for new structure." };
}

export async function cancelOrderAction(orderId: string): Promise<any> {
     console.warn("cancelOrderAction needs implementation based on the new Firestore structure.");
     return { success: false, message: "Cancel order action not yet implemented for new structure." };
}

export async function linkShipmentToOrderAction(orderId: string, shipmentId: string): Promise<any> {
     console.warn("linkShipmentToOrderAction needs implementation based on the new Firestore structure.");
     return { success: false, message: "Link shipment action not yet implemented for new structure." };
}
