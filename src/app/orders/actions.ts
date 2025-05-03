
'use server';

import { revalidatePath } from 'next/cache';
import { db, collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp, getDoc } from '@/lib/firebase/firebase';
import { OrderSchema, type CreateOrderInput, type Order } from '@/schemas/order'; // Import Order types/schemas
import { Shipment, ShipmentSchema } from '@/schemas/shipment'; // Import Shipment schema for status update consistency

// Function to calculate order total
function calculateOrderTotal(items: { price: number; quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // In a real app, add logic for taxes, shipping, discounts etc.
}

// --- Create Order Action ---
export async function createOrderAction(data: CreateOrderInput): Promise<{ success: boolean; message: string; orderId?: string; errors?: Record<string, string[]> | null }> {
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
      errors: validationResult.error.flatten().fieldErrors,
    };
  }

  const newOrderData = {
    ...validationResult.data,
    createdAt: serverTimestamp(), // Use server timestamp for creation
    updatedAt: serverTimestamp(), // Also set updatedAt on creation
    total: calculateOrderTotal(validationResult.data.items), // Calculate total
    // shipmentId can be added later when a shipment is created
  };

  try {
    console.log("Attempting to add order to Firestore...");
    const ordersCollectionRef = collection(db, 'orders');
    const docRef = await addDoc(ordersCollectionRef, newOrderData);
    console.log(`Successfully added order with ID: ${docRef.id}`);

    revalidatePath('/orders'); // Revalidate the orders list page
    revalidatePath(`/orders/${docRef.id}`); // Revalidate the specific order page if needed immediately

    return {
      success: true,
      message: `Order ${docRef.id} created successfully!`,
      orderId: docRef.id,
    };
  } catch (error) {
    const errorMessage = `Error adding order to Firestore: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return {
      success: false,
      message: "Failed to create order due to a database error.",
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

// --- Cancel Order Action (Example of specific status update) ---
export async function cancelOrderAction(orderId: string): Promise<{ success: boolean; message: string }> {
   // Optional: Add logic here to check if the order *can* be cancelled (e.g., not already shipped/delivered)
   // Fetch the order first, check its status, then proceed or return an error.
   return updateOrderStatusAction(orderId, 'Cancelled', 'Refunded'); // Also update payment status to Refunded
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
