'use server';

import { revalidatePath } from 'next/cache';
import { db, collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp, arrayUnion, getDoc } from '@/lib/firebase/firebase';
import { ShipmentSchema, type CreateShipmentInput, type Shipment } from '@/schemas/shipment';
import { linkShipmentToOrderAction } from '@/app/orders/actions'; // Import action to link shipment

// --- Create Shipment Action ---
export async function createShipmentAction(data: CreateShipmentInput): Promise<{ success: boolean; message: string; shipmentId?: string; errors?: Record<string, string[]> | null }> {
  if (!db) {
    const errorMessage = "Database configuration error. Unable to create shipment.";
    console.error("Firestore database is not initialized. Cannot create shipment.");
    return { success: false, message: errorMessage, errors: null };
  }

  const validationResult = ShipmentSchema.safeParse(data);
  if (!validationResult.success) {
    console.error("Shipment Validation Errors:", validationResult.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Validation failed. Please check the shipment details.",
      errors: validationResult.error.flatten().fieldErrors,
    };
  }

  const initialHistoryEvent = {
      timestamp: Timestamp.now().toISOString(), // Use current time as ISO string for initial event
      status: validationResult.data.status, // Use the initial status provided
      location: validationResult.data.origin, // Use origin as initial location
  };

  const newShipmentData = {
    ...validationResult.data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    history: [initialHistoryEvent], // Initialize history with the first event
    actualDelivery: null, // Explicitly set actualDelivery to null initially
  };

  try {
    console.log("Attempting to add shipment to Firestore...");
    const shipmentsCollectionRef = collection(db, 'shipments');
    const docRef = await addDoc(shipmentsCollectionRef, newShipmentData);
    console.log(`Successfully added shipment with ID: ${docRef.id}`);

    // Attempt to link this shipment to the order
    const linkResult = await linkShipmentToOrderAction(newShipmentData.orderId, docRef.id);
    if (!linkResult.success) {
        console.warn(`Failed to automatically link shipment ${docRef.id} to order ${newShipmentData.orderId}: ${linkResult.message}`);
        // Decide if this should be a hard failure or just a warning
    }

    revalidatePath('/logistics'); // Revalidate the logistics list page
    revalidatePath(`/logistics/${docRef.id}`); // Revalidate the specific shipment page
    revalidatePath('/'); // Revalidate dashboard

    return {
      success: true,
      message: `Shipment ${docRef.id} created successfully! ${linkResult.success ? '' : '(Manual order link may be needed)'}`,
      shipmentId: docRef.id,
    };
  } catch (error) {
    const errorMessage = `Error adding shipment to Firestore: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return {
      success: false,
      message: "Failed to create shipment due to a database error.",
      errors: null,
    };
  }
}

// --- Update Shipment Status & Add History Action ---
export async function updateShipmentStatusAction(
  shipmentId: string,
  newStatus: Shipment['status'],
  location?: string,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  if (!db) {
    const errorMessage = "Database configuration error. Unable to update shipment status.";
    console.error("Firestore database is not initialized. Cannot update shipment status.");
    return { success: false, message: errorMessage };
  }
  if (!shipmentId) {
    return { success: false, message: "Shipment ID is required." };
  }

  const validStatuses = ShipmentSchema.shape.status.options;
  if (!validStatuses.includes(newStatus)) {
     return { success: false, message: `Invalid status: ${newStatus}` };
  }

  const now = Timestamp.now();
  const historyEvent = {
    timestamp: now.toDate().toISOString(), // Convert to ISO string
    status: newStatus,
    location: location || "Update Recorded", // Default location if not provided
    notes: notes || undefined, // Add notes if provided
  };
   // Remove undefined notes field
   if (historyEvent.notes === undefined) {
       delete historyEvent.notes;
   }


  try {
    console.log(`Attempting to update status for shipment ID: ${shipmentId} to ${newStatus}`);
    const shipmentDocRef = doc(db, 'shipments', shipmentId);

    // Check if status is 'Delivered' to update actualDelivery
    const updateData: any = {
        status: newStatus,
        updatedAt: now,
        history: arrayUnion(historyEvent), // Add the new event to the history array
    };

    if (newStatus === 'Delivered') {
        updateData.actualDelivery = now; // Set actual delivery timestamp
    }


    await updateDoc(shipmentDocRef, updateData);
    console.log(`Successfully updated status and added history for shipment ID: ${shipmentId}`);

    // Potentially update the linked order status if the shipment is delivered
    if (newStatus === 'Delivered') {
        const shipmentSnap = await getDoc(shipmentDocRef);
        if (shipmentSnap.exists()) {
            const shipmentData = shipmentSnap.data() as Shipment;
            // Import and call the order update action (ensure no circular dependency issues)
            const { updateOrderStatusAction: updateLinkedOrderStatus } = await import('@/app/orders/actions');
             await updateLinkedOrderStatus(shipmentData.orderId, 'Delivered');
        }
    }


    revalidatePath('/logistics'); // Revalidate the list page
    revalidatePath(`/logistics/${shipmentId}`); // Revalidate the detail page
    revalidatePath('/'); // Revalidate dashboard
    // Revalidate order pages if status changed significantly (like Delivered)
     if (newStatus === 'Delivered') {
        const shipmentSnap = await getDoc(shipmentDocRef);
        if (shipmentSnap.exists()) {
            const shipmentData = shipmentSnap.data() as Shipment;
             revalidatePath('/orders');
             revalidatePath(`/orders/${shipmentData.orderId}`);
         }
     }

    return { success: true, message: "Shipment status updated successfully." };
  } catch (error) {
    const errorMessage = `Error updating shipment status (ID: ${shipmentId}): ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return {
      success: false,
      message: "Failed to update shipment status due to a database error.",
    };
  }
}

// --- Delete Shipment Action (Use with caution!) ---
// Usually, you wouldn't delete shipments, but mark them as cancelled or archived.
// export async function deleteShipmentAction(shipmentId: string): Promise<{ success: boolean; message: string; }> {
//   if (!db) { /* ... error handling ... */ }
//   if (!shipmentId) { /* ... error handling ... */ }

//   try {
//     console.log(`Attempting to delete shipment with ID: ${shipmentId}`);
//     const shipmentDocRef = doc(db, 'shipments', shipmentId);
//     await deleteDoc(shipmentDocRef); // Firestore delete function
//     console.log(`Successfully deleted shipment with ID: ${shipmentId}`);

//     revalidatePath('/logistics');

//     return { success: true, message: "Shipment deleted successfully." };
//   } catch (error) {
//     /* ... error handling ... */
//   }
// }
