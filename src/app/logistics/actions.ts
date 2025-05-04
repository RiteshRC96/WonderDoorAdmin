
'use server';

import { revalidatePath } from 'next/cache';
import { db, collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp, arrayUnion, getDoc } from '@/lib/firebase/firebase';
// Schemas might need updates or removal depending on how shipments are handled now
import { ShipmentSchema, type CreateShipmentInternal, type Shipment } from '@/schemas/shipment';
import { linkShipmentToOrderAction } from '@/app/orders/actions'; // This action also needs update

// --- CREATE SHIPMENT ACTION (LIKELY OBSOLETE or NEEDS REWORK) ---
// Shipment creation is now likely handled within createOrderAction
/*
export async function createShipmentAction(data: CreateShipmentInput): Promise<{ success: boolean; message: string; shipmentId?: string; errors?: Record<string, string[]> | null }> {
  // ... Firestore check ...

  const validationResult = ShipmentSchema.safeParse(data);
  if (!validationResult.success) {
    // ... handle validation errors ...
    return { success: false, message: "Validation failed.", errors: validationResult.error.flatten().fieldErrors };
  }

  const initialHistoryEvent = {
      timestamp: Timestamp.now().toISOString(),
      status: validationResult.data.status,
      location: validationResult.data.origin,
  };

  const newShipmentData: CreateShipmentInternal = { // Use internal type if needed
    ...validationResult.data,
    createdAt: Timestamp.now(), // Use Firestore Timestamp for creation
    updatedAt: Timestamp.now(), // Use Firestore Timestamp for creation
    history: [initialHistoryEvent],
    actualDelivery: null,
  };

  try {
    const shipmentsCollectionRef = collection(db, 'shipments');
    const docRef = await addDoc(shipmentsCollectionRef, newShipmentData);

    // Link shipment to order (this action also needs update)
    // const linkResult = await linkShipmentToOrderAction(newShipmentData.orderId, docRef.id);
    // ... handle link result ...

    revalidatePath('/logistics');
    revalidatePath(`/logistics/${docRef.id}`);
    revalidatePath('/');

    return {
      success: true,
      message: `Shipment ${docRef.id} created successfully!`, // Adjust message
      shipmentId: docRef.id,
    };
  } catch (error) {
    // ... error handling ...
    return { success: false, message: "Failed to create shipment.", errors: null };
  }
}
*/

// --- UPDATE SHIPMENT STATUS ACTION (NEEDS REWORK) ---
// This action now needs to update the 'trackingInfo' within the specific ORDER document.
/*
export async function updateShipmentStatusAction(
  orderId: string, // Need Order ID to find the document
  newStatus: string, // Use string as enum might change
  location?: string,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  if (!db) return { success: false, message: "Database config error." };
  if (!orderId) return { success: false, message: "Order ID is required." };

  // Optional: Validate newStatus against expected values if needed

  const now = Timestamp.now();
  const historyEvent = {
    timestamp: now.toDate().toISOString(),
    status: newStatus,
    location: location || "Update Recorded",
    notes: notes || undefined,
  };
   if (historyEvent.notes === undefined) delete historyEvent.notes;

  try {
    console.log(`Attempting to update tracking status for order ID: ${orderId} to ${newStatus}`);
    const orderDocRef = doc(db, 'orders', orderId);

    // Prepare update for the 'trackingInfo' map field
    const updateData: any = {
        // Use dot notation to update specific fields in the map
        'trackingInfo.status': newStatus,
        'trackingInfo.updatedAt': now, // Add/update an updatedAt within trackingInfo?
        // Add history event? Firestore doesn't directly support arrayUnion within a map update easily.
        // Might need to read the order, update the history array, then update the whole trackingInfo map.
        // OR store history separately if it gets complex.
    };

    // Handle 'Delivered' status - update trackingInfo and maybe top-level order status
    if (newStatus === 'Delivered') {
        updateData['trackingInfo.actualDelivery'] = now; // Add actualDelivery to trackingInfo
        // Optionally update the main order status as well
        // updateData['status'] = 'Delivered'; // Update top-level status
    }

    // --- Read-Modify-Write for History (Example) ---
    const orderSnap = await getDoc(orderDocRef);
    if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        const currentTrackingInfo = orderData.trackingInfo || {};
        const currentHistory = currentTrackingInfo.history || [];
        currentHistory.push(historyEvent); // Add new event
        updateData['trackingInfo.history'] = currentHistory; // Update the whole history array
    } else {
        return { success: false, message: `Order ${orderId} not found.` };
    }
     // --- End Read-Modify-Write ---


    await updateDoc(orderDocRef, updateData);
    console.log(`Successfully updated tracking status for order ID: ${orderId}`);

    // --- Revalidate Paths ---
    revalidatePath('/logistics'); // Revalidate logistics list (derived from orders)
    revalidatePath(`/orders/${orderId}`); // Revalidate the order detail page
    revalidatePath('/');

    return { success: true, message: "Shipment status updated successfully." };
  } catch (error) {
    // ... error handling ...
    return { success: false, message: "Failed to update shipment status." };
  }
}
*/


// --- Placeholder Functions ---
export async function createShipmentAction(data: any): Promise<any> {
    console.warn("createShipmentAction is likely obsolete or needs rework.");
    return { success: false, message: "Shipment creation now handled via orders." };
}

export async function updateShipmentStatusAction(orderId: string, newStatus: string, location?: string, notes?: string): Promise<any> {
    console.warn("updateShipmentStatusAction needs rework to update order's trackingInfo.");
    return { success: false, message: "Shipment status update needs rework." };
}

// Delete Shipment action is likely irrelevant now as shipments are part of orders.
// Deleting an order should handle associated data.
