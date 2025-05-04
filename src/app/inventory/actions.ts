'use server';

import { revalidatePath } from 'next/cache';
import { AddItemSchema, type AddItemInput } from '@/schemas/inventory';
import { db, collection, addDoc, doc, deleteDoc, updateDoc, serverTimestamp, Timestamp } from '@/lib/firebase/firebase'; // Import Firestore instance and functions

// Helper function to check Firestore initialization
function checkFirestoreInitialization() {
  if (!db) {
    const errorMessage = "Firestore database is not initialized. Check Firebase configuration. Operation cannot proceed.";
    console.error(errorMessage);
    // Provide a user-friendly message emphasizing configuration check
    return { initialized: false, message: "Database configuration error. Please check setup and restart." };
  }
  return { initialized: true, message: "" };
}


// Server Action to add a new inventory item to Firestore
export async function addItemAction(data: AddItemInput): Promise<{ success: boolean; message: string; itemId?: string; errors?: Record<string, string[]> | null }> {
  const dbCheck = checkFirestoreInitialization();
  if (!dbCheck.initialized) {
    return {
      success: false,
      message: dbCheck.message,
      errors: null,
    };
  }

  const validationResult = AddItemSchema.safeParse(data);

  if (!validationResult.success) {
    console.error("Validation Errors:", validationResult.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Validation failed. Please check the form fields.",
      errors: validationResult.error.flatten().fieldErrors,
    };
  }

  // Prepare the data for Firestore
  const newItemData = {
      ...validationResult.data,
      // imageUrl might be a data URL or undefined
      imageUrl: validationResult.data.imageUrl || undefined,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
  };

  // Remove empty/undefined optional fields before sending to Firestore
   Object.keys(newItemData).forEach(key => {
      const typedKey = key as keyof typeof newItemData;
      if (newItemData[typedKey] === undefined || newItemData[typedKey] === "") {
          if (typedKey === 'imageUrl') {
              // Use delete to ensure the field is completely removed if empty/undefined
              delete newItemData.imageUrl;
          } else {
             // For other potentially empty fields, decide if they should be removed or sent as empty string
             // For now, let's remove them if undefined/empty string
             delete newItemData[typedKey];
          }
      }
    });

  try {
    console.log("Attempting to add item to Firestore with data:", JSON.stringify(Object.keys(newItemData))); // Log keys to avoid logging potentially large image data
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
    };

  } catch (error) {
     // --- Enhanced Error Logging ---
     let errorMessage = "Failed to add item due to a database error.";
     let errorCode = "UNKNOWN"; // Default error code

     if (error instanceof Error) {
         // Attempt to get a more specific Firestore error code if available
         const firestoreError = error as any; // Cast to any to check for 'code' property
         if (firestoreError.code) {
            errorCode = firestoreError.code;
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
             console.error(`Firestore Error (${firestoreError.code}):`, error);
         } else {
            // Generic JavaScript error
            errorMessage = `Error adding item: ${error.message}`;
            console.error("Error adding item to Firestore:", error);
         }
     } else {
        // Non-Error object thrown
        console.error("An unexpected error occurred:", error);
     }

    // Check for large data URL error specifically
    if (error instanceof Error && (error.message.includes('ENTITY_TOO_LARGE') || error.message.includes('maximum size'))) {
        errorMessage = "Failed to add item. The image file might be too large. Please use a smaller image (e.g., under 1MB).";
        errorCode = "ENTITY_TOO_LARGE";
    }

    // Return the more specific or generic error message
    return {
      success: false,
      // Provide a user-friendly message, maybe add the code for easier debugging for devs
      message: `${errorMessage} (Code: ${errorCode}). Please try again.`,
      errors: null,
    };
  }
}

// Server Action to update an existing inventory item in Firestore
export async function updateItemAction(
  itemId: string,
  data: AddItemInput // Image uploads are not handled in edit yet, assumes imageUrl is URL or dataURL
): Promise<{ success: boolean; message: string; errors?: Record<string, string[]> | null }> {
  const dbCheck = checkFirestoreInitialization();
  if (!dbCheck.initialized) {
    return {
      success: false,
      message: dbCheck.message,
      errors: null,
    };
  }

  if (!itemId) {
      return { success: false, message: "Item ID is required for update.", errors: null };
  }

  const validationResult = AddItemSchema.safeParse(data);

  if (!validationResult.success) {
    console.error("Validation Errors:", validationResult.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Validation failed. Please check the form fields.",
      errors: validationResult.error.flatten().fieldErrors,
    };
  }

  // Prepare the data for Firestore update
  const itemDataToUpdate: Partial<AddItemInput & { updatedAt: any }> = { // Use Partial for update
    ...validationResult.data,
    imageUrl: validationResult.data.imageUrl || undefined, // Handle optional image URL/Data URL
    updatedAt: serverTimestamp(),
  };

  // Remove empty/undefined fields before sending to Firestore
   Object.keys(itemDataToUpdate).forEach(key => {
        const typedKey = key as keyof typeof itemDataToUpdate;
        if (itemDataToUpdate[typedKey] === undefined || itemDataToUpdate[typedKey] === "") {
           if (typedKey === 'imageUrl') {
               delete itemDataToUpdate.imageUrl;
           } else {
              delete itemDataToUpdate[typedKey];
           }
        }
      });

  try {
    console.log(`Attempting to update item with ID: ${itemId}`);
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

    if (error instanceof Error && (error.message.includes('ENTITY_TOO_LARGE') || error.message.includes('maximum size'))) {
       errorMessage = "Failed to update item. The image data might be too large. Please use a smaller image or URL.";
       errorCode = "ENTITY_TOO_LARGE";
     }
    return {
      success: false,
      message: `${errorMessage} (Code: ${errorCode}). Please try again.`,
      errors: null,
    };
  }
}


// Server Action to delete an inventory item from Firestore
export async function deleteItemAction(itemId: string): Promise<{ success: boolean; message: string; }> {
  const dbCheck = checkFirestoreInitialization();
  if (!dbCheck.initialized) {
    return {
      success: false,
      message: dbCheck.message,
    };
  }

  if (!itemId) {
      return { success: false, message: "Item ID is required." };
  }

  try {
    console.log(`Attempting to delete item with ID: ${itemId}`);
    const itemDocRef = doc(db, 'inventory', itemId);
    await deleteDoc(itemDocRef);
    console.log(`Successfully deleted item with ID: ${itemId}`);

    revalidatePath('/inventory');
    revalidatePath(`/inventory/${itemId}`);
    revalidatePath('/'); // Revalidate dashboard
     // No need to revalidate edit page as it won't exist anymore

    return { success: true, message: "Item deleted successfully." };

  } catch (error) {
    // --- Enhanced Error Logging ---
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
                     // Arguably should be success if it's already gone, but let's report it
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
