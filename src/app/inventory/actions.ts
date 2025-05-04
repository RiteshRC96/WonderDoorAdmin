
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
    // Remove Storage related imports
    // storage,
    // storageRef,
    // uploadString,
    // getDownloadURL,
    // deleteObject
} from '@/lib/firebase/firebase'; // Import Firestore instance and functions

// Helper function to check Firestore initialization
function checkFirebaseInitialization() {
  if (!db) {
    const errorMessage = `Firebase Initialization Error: Firestore database is not initialized. Check Firebase configuration. Operation cannot proceed.`;
    console.error(errorMessage);
    return { initialized: false, message: "Database configuration error. Please check setup and restart." };
  }
  // No need to check storage anymore
  return { initialized: true, message: "" };
}


// Server Action to add a new inventory item to Firestore
export async function addItemAction(itemData: AddItemInput): Promise<{ success: boolean; message: string; itemId?: string; errors?: Record<string, string[]> | null }> {
  console.log("addItemAction started. Received payload:", itemData);
  const firebaseCheck = checkFirebaseInitialization();
  if (!firebaseCheck.initialized) {
    console.error("Firestore initialization check failed.");
    return { success: false, message: firebaseCheck.message, errors: null };
  }

  // Validate the incoming data
  const validationResult = AddItemSchema.safeParse(itemData);

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


  // --- Image Handling Removed ---
  // No image upload logic needed here. The imageUrl comes directly from the validatedData.

  // Prepare the final data for Firestore
  // Use the validatedData from the schema result, which includes the optional imageUrl
  const newItemData = {
      ...validatedData, // Use data parsed by Zod
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
  };

  // Remove empty/undefined optional fields before sending to Firestore
   Object.keys(newItemData).forEach(key => {
        const typedKey = key as keyof typeof newItemData;
        // Explicitly remove imageUrl if it's an empty string or undefined
        if (typedKey === 'imageUrl' && (newItemData[typedKey] === "" || newItemData[typedKey] === undefined)) {
           console.log("Removing empty/undefined imageUrl field.");
           delete newItemData[typedKey];
        } else if (newItemData[typedKey] === undefined || newItemData[typedKey] === "") {
           // Remove other undefined/empty fields (excluding imageUrl which was handled)
           console.log(`Removing empty/undefined field: ${typedKey}`);
           delete newItemData[typedKey];
        }
   });

  try {
    console.log("Preparing item data for Firestore:", newItemData);
    if (!db) { // Redundant check, but safe
        throw new Error("Firestore database instance (db) is null. Cannot add document.");
    }
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
            errorMessage = `Error adding item document: ${error.message}`;
            console.error("Error adding item to Firestore (non-Firestore error or code missing):", error.message, error.stack);
         }
     } else {
        console.error("An unexpected non-Error object was thrown:", error);
        errorMessage = "An unexpected error occurred while saving the item.";
     }

     // --- Orphaned Image Cleanup Removed ---

    return {
      success: false,
      message: `${errorMessage} (Code: ${errorCode}). Please try again.`,
      errors: null,
    };
  }
}

// Server Action to update an existing inventory item in Firestore
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

  // --- Image Handling Removed ---
  // No image update logic needed here beyond the imageUrl field itself.

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

    return {
      success: false,
      message: `${errorMessage} (Code: ${errorCode}). Please try again.`,
      errors: null,
    };
  }
}


// Server Action to delete an inventory item from Firestore
// Removes deletion of associated image from Firebase Storage.
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

    // Check if document exists before attempting delete (optional but good practice)
    const docSnap = await getDoc(itemDocRef);
    if (!docSnap.exists()) {
       console.log(`Item ${itemId} not found in Firestore, cannot delete.`);
       return { success: false, message: `Item with ID ${itemId} not found.` };
    }

    // Delete Firestore document
    await deleteDoc(itemDocRef);
    console.log(`Successfully deleted Firestore document for item ID: ${itemId}`);

    // --- Image Deletion Logic Removed ---

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
                case 'not-found':
                     // This shouldn't happen if we get the doc first, but handle defensively
                     errorMessage = `Item with ID ${itemId} not found. Cannot delete.`;
                     break;
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

    return {
      success: false,
      message: `${errorMessage} (Code: ${errorCode}). Please try again.`,
    };
  }
}
