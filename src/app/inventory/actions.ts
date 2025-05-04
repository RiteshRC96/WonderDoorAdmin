'use server';

import { revalidatePath } from 'next/cache';
import { AddItemSchema, type AddItemInput } from '@/schemas/inventory'; // Use AddItemInput directly
import {
    db,
    collection,
    addDoc,
    doc,
    deleteDoc,
    updateDoc,
    serverTimestamp,
    Timestamp,
    getDoc, // Keep getDoc for checking existence in delete
    // Removed Storage imports
} from '@/lib/firebase/firebase'; // Import Firestore instance and functions

// Helper function to check Firestore initialization
function checkFirebaseInitialization() {
  if (!db) { // Check only Firestore
    const errorMessage = `Firebase Initialization Error: Firestore database is not initialized. Check Firebase configuration. Operation cannot proceed.`;
    console.error(errorMessage);
    return { initialized: false, message: "Database configuration error. Please check setup and restart." };
  }
  return { initialized: true, message: "" };
}


// Server Action to add a new inventory item to Firestore
export async function addItemAction(payload: AddItemInput): Promise<{ success: boolean; message: string; itemId?: string; errors?: Record<string, string[]> | null }> {
  console.log("addItemAction started. Received payload:", Object.keys(payload));
  const firebaseCheck = checkFirebaseInitialization();
  if (!firebaseCheck.initialized) {
    console.error("Firebase initialization check failed.");
    return { success: false, message: firebaseCheck.message, errors: null };
  }

  // Validate the item data
  const validationResult = AddItemSchema.safeParse(payload);

  if (!validationResult.success) {
    console.error("Validation Errors:", validationResult.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Validation failed. Please check the form fields.",
      errors: validationResult.error.flatten().fieldErrors,
    };
  }
  console.log("Validation successful.");
  const validatedData = validationResult.data;

  // Image is now just a URL, no upload handling needed here
  const imageUrl = validatedData.imageUrl || undefined; // Use the URL from payload or undefined
  console.log("Image URL provided:", imageUrl);

  // Prepare the final data for Firestore
  const newItemData = {
      ...validatedData,
      // imageUrl is already part of validatedData
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
  };

  // Remove empty/undefined optional fields before sending to Firestore
   Object.keys(newItemData).forEach(key => {
        const typedKey = key as keyof typeof newItemData;
        if (newItemData[typedKey] === undefined || newItemData[typedKey] === "") {
           // Remove undefined/empty fields
           console.log(`Removing empty/undefined field: ${typedKey}`);
           delete newItemData[typedKey];
        }
   });

  try {
    console.log("Attempting to add item document to Firestore with data keys:", JSON.stringify(Object.keys(newItemData)));
    const inventoryCollectionRef = collection(db, 'inventory');
    const docRef = await addDoc(inventoryCollectionRef, newItemData);

    console.log(`Successfully added item with ID: ${docRef.id}`);

    // Revalidate the inventory list page cache to show the new item
    revalidatePath('/inventory');
    revalidatePath('/'); // Also revalidate dashboard

    return {
      success: true,
      message: `Item '${newItemData.name}' added successfully!`,
      itemId: docRef.id,
      errors: null,
    };

  } catch (error) {
     // --- Enhanced Error Logging ---
     let errorMessage = "Failed to add item document to Firestore.";
     let errorCode = "UNKNOWN";

     if (error instanceof Error) {
         const firestoreError = error as any;
         if (firestoreError.code) {
            errorCode = firestoreError.code;
            console.error(`Firestore Error (${firestoreError.code}):`, error.message, error.stack);
            // Simplified switch for common Firestore errors
            switch (firestoreError.code) {
                 case 'permission-denied':
                     errorMessage = "Permission denied. Check Firestore security rules.";
                     break;
                 case 'unauthenticated':
                      errorMessage = "Authentication required. Please log in.";
                      break;
                  case 'resource-exhausted':
                      errorMessage = "Firestore quota exceeded. Please check your Firebase plan limits.";
                      break;
                  case 'invalid-argument':
                      errorMessage = `Invalid data provided to Firestore: ${firestoreError.message}`;
                      break;
                  default:
                      errorMessage = `Firestore error (${firestoreError.code}): ${firestoreError.message}`;
                      break;
            }
         } else {
            // Handle generic errors or non-Firebase errors
            errorMessage = `Error adding item document: ${error.message}`;
            console.error("Error adding item to Firestore (non-Firestore error or code missing):", error.message, error.stack);
         }
     } else {
        console.error("An unexpected non-Error object was thrown:", error);
        errorMessage = "An unexpected error occurred while saving the item.";
     }

    // Removed orphaned image cleanup logic

    // ALWAYS return null for errors when it's not a validation failure
    return {
      success: false,
      message: `${errorMessage}${errorCode !== 'UNKNOWN' ? ` (Code: ${errorCode})` : ''}. Please try again.`,
      errors: null, // Explicitly set errors to null for non-validation errors
    };
  }
}

// Server Action to update an existing inventory item in Firestore
// Image URL is just another field to update if provided
export async function updateItemAction(
  itemId: string,
  data: AddItemInput // Use AddItemInput directly
): Promise<{ success: boolean; message: string; errors?: Record<string, string[]> | null }> {
  const firebaseCheck = checkFirebaseInitialization();
  if (!firebaseCheck.initialized) {
    return { success: false, message: firebaseCheck.message, errors: null };
  }

  if (!itemId) {
      return { success: false, message: "Item ID is required for update.", errors: null };
  }

  // Validate the incoming data
  const validationResult = AddItemSchema.safeParse(data);

  if (!validationResult.success) {
    console.error("Update Validation Errors:", validationResult.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Validation failed. Please check the form fields.",
      errors: validationResult.error.flatten().fieldErrors,
    };
  }

  // Image URL is part of validationResult.data if provided and valid

  // Prepare the data for Firestore update
  const itemDataToUpdate: Partial<AddItemInput & { updatedAt: any }> = {
    ...validationResult.data,
    updatedAt: serverTimestamp(),
  };

  // Remove empty/undefined fields before sending to Firestore
   Object.keys(itemDataToUpdate).forEach(key => {
        const typedKey = key as keyof typeof itemDataToUpdate;
        // Handle imageUrl specifically: remove if empty or undefined
         if (typedKey === 'imageUrl' && (itemDataToUpdate[typedKey] === "" || itemDataToUpdate[typedKey] === undefined)) {
             console.log("Removing empty/undefined imageUrl field during update.");
             delete itemDataToUpdate[typedKey];
         } else if (itemDataToUpdate[typedKey] === undefined || itemDataToUpdate[typedKey] === "") {
            // Remove other undefined/empty fields
            console.log(`Removing empty/undefined field during update: ${typedKey}`);
            delete itemDataToUpdate[typedKey];
         }
   });


  try {
    console.log(`Attempting to update item with ID: ${itemId} with data:`, itemDataToUpdate);
    const itemDocRef = doc(db, 'inventory', itemId);
    await updateDoc(itemDocRef, itemDataToUpdate); // Use updateDoc with partial data

    console.log(`Successfully updated item with ID: ${itemId}`);

    // Revalidate relevant paths
    revalidatePath('/inventory');
    revalidatePath(`/inventory/${itemId}`);
    revalidatePath(`/inventory/${itemId}/edit`);
    revalidatePath('/'); // Revalidate dashboard


    return {
      success: true,
      message: `Item '${itemDataToUpdate.name}' updated successfully!`,
      errors: null, // Ensure errors is explicitly null on success
    };

  } catch (error) {
    // --- Enhanced Error Logging ---
    let errorMessage = "Failed to update item due to a database error.";
    let errorCode = "UNKNOWN";

    if (error instanceof Error) {
        const firestoreError = error as any;
        if (firestoreError.code) {
            errorCode = firestoreError.code;
             switch (firestoreError.code) {
                case 'permission-denied':
                    errorMessage = "Permission denied. Check Firestore security rules.";
                    break;
                case 'unauthenticated':
                     errorMessage = "Authentication required. Please log in.";
                     break;
                case 'not-found':
                     errorMessage = `Item with ID ${itemId} not found. Cannot update.`;
                     break;
                 case 'resource-exhausted':
                     errorMessage = "Firestore quota exceeded. Please check your Firebase plan limits.";
                     break;
                 case 'invalid-argument':
                      errorMessage = `Invalid data provided for update: ${firestoreError.message}`;
                     break;
                 default:
                     errorMessage = `Firestore error (${firestoreError.code}): ${firestoreError.message}`;
                     break;
             }
            console.error(`Firestore Error during update (${firestoreError.code}):`, error);
        } else {
            errorMessage = `Error updating item: ${error.message}`;
            console.error("Error updating item in Firestore:", error);
        }
    } else {
        console.error("An unexpected error occurred during update:", error);
    }

    // Return null for errors for non-validation failures
    return {
      success: false,
      message: `${errorMessage}${errorCode !== 'UNKNOWN' ? ` (Code: ${errorCode})` : ''}. Please try again.`,
      errors: null, // Explicitly null
    };
  }
}


// Server Action to delete an inventory item from Firestore (no image deletion needed)
export async function deleteItemAction(itemId: string): Promise<{ success: boolean; message: string; }> {
  const firebaseCheck = checkFirebaseInitialization();
  if (!firebaseCheck.initialized) {
    return { success: false, message: firebaseCheck.message };
  }

  if (!itemId) {
      return { success: false, message: "Item ID is required." };
  }

  const itemDocRef = doc(db, 'inventory', itemId);

  try {
    console.log(`Attempting to delete item document for ID: ${itemId}`);

    // Get the document first to check if it exists (optional, deleteDoc handles non-existent docs gracefully)
    const docSnap = await getDoc(itemDocRef);
    if (!docSnap.exists()) {
       console.log(`Item ${itemId} not found in Firestore, cannot delete.`);
       // If it doesn't exist in Firestore, no need to proceed.
       // Technically success=true as the end state (item gone) is achieved.
       return { success: true, message: `Item with ID ${itemId} not found or already deleted.` };
    }

    // Delete Firestore document
    await deleteDoc(itemDocRef);
    console.log(`Successfully deleted Firestore document for item ID: ${itemId}`);

    // --- Image deletion logic removed ---

    // Revalidate paths after successful deletion
    revalidatePath('/inventory');
    revalidatePath('/'); // Revalidate dashboard

    return { success: true, message: "Item deleted successfully." };

  } catch (error) {
    // --- Enhanced Error Logging for Firestore delete ---
    let errorMessage = "Failed to delete item due to a database error.";
    let errorCode = "UNKNOWN";

     if (error instanceof Error) {
         const firestoreError = error as any;
         if (firestoreError.code) {
            errorCode = firestoreError.code;
             switch (firestoreError.code) {
                case 'permission-denied':
                    errorMessage = "Permission denied. Check Firestore security rules.";
                    break;
                case 'unauthenticated':
                     errorMessage = "Authentication required. Please log in.";
                     break;
                 // No need to check for 'not-found' here as we getDoc first
                 default:
                     errorMessage = `Firestore error (${firestoreError.code}): ${firestoreError.message}`;
                     break;
             }
            console.error(`Firestore Error during delete (${firestoreError.code}):`, error);
         } else {
            errorMessage = `Error deleting item: ${error.message}`;
            console.error("Error deleting item from Firestore:", error);
         }
     } else {
        console.error("An unexpected error occurred during delete:", error);
     }

    // Firestore delete failed
    return {
      success: false,
      message: `${errorMessage}${errorCode !== 'UNKNOWN' ? ` (Code: ${errorCode})` : ''}. Please try again.`,
    };
  }
}
