'use server';

import { revalidatePath } from 'next/cache';
import { AddItemSchema, type AddItemInput } from '@/schemas/inventory';
import { db, collection, addDoc, doc, deleteDoc, updateDoc, serverTimestamp, Timestamp } from '@/lib/firebase/firebase'; // Import Firestore instance and functions

// Helper function to check Firestore initialization
function checkFirestoreInitialization() {
  if (!db) {
    const errorMessage = "Firestore database is not initialized. Check Firebase configuration. Operation cannot proceed.";
    console.error(errorMessage);
    return { initialized: false, message: "Database configuration error. Unable to proceed." };
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
  // Ensure imageUrl is truly removed if it's an empty string or undefined
   Object.keys(newItemData).forEach(key => {
      const typedKey = key as keyof typeof newItemData;
      if (newItemData[typedKey] === undefined || newItemData[typedKey] === "") {
           // Special check for imageUrl to ensure undefined is used if empty
          if (typedKey === 'imageUrl') {
              delete newItemData.imageUrl;
          } else if (newItemData[typedKey] === "") { // Delete other empty strings if needed
             delete newItemData[typedKey];
          }
      }
    });

  try {
    console.log("Attempting to add item to Firestore...");
    const inventoryCollectionRef = collection(db, 'inventory');
    const docRef = await addDoc(inventoryCollectionRef, newItemData);

    console.log(`Successfully added item with ID: ${docRef.id}`);

    // Revalidate the inventory list page cache to show the new item
    revalidatePath('/inventory');

    return {
      success: true,
      message: `Item '${newItemData.name}' added successfully!`,
      itemId: docRef.id,
    };

  } catch (error) {
     const errorMessage = `Error adding item to Firestore: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    // Check for large data URL error (Firestore has document size limits)
    if (errorMessage.includes('ENTITY_TOO_LARGE') || errorMessage.includes('maximum size')) {
        return {
          success: false,
          message: "Failed to add item. The image file might be too large. Please use a smaller image (e.g., under 1MB).",
          errors: null,
        };
    }
    return {
      success: false,
      message: "Failed to add item due to a database error. Please try again.",
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
            // Special check for imageUrl to ensure undefined is used if empty
           if (typedKey === 'imageUrl') {
               // If imageUrl is empty string, we want to remove it using `delete`
               // If it's already undefined, delete won't hurt
               delete itemDataToUpdate.imageUrl;
           } else if (itemDataToUpdate[typedKey] === "") { // Delete other empty strings if needed
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

    return {
      success: true,
      message: `Item '${itemDataToUpdate.name}' updated successfully!`,
    };

  } catch (error) {
    const errorMessage = `Error updating item in Firestore (ID: ${itemId}): ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    // Check for large data URL error during update
    if (errorMessage.includes('ENTITY_TOO_LARGE') || errorMessage.includes('maximum size')) {
       return {
         success: false,
         message: "Failed to update item. The image data might be too large. Please use a smaller image or URL.",
         errors: null,
       };
     }
    return {
      success: false,
      message: "Failed to update item due to a database error. Please try again.",
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
     // No need to revalidate edit page as it won't exist anymore

    return { success: true, message: "Item deleted successfully." };

  } catch (error) {
    const errorMessage = `Error deleting item from Firestore (ID: ${itemId}): ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return {
      success: false,
      message: "Failed to delete item due to a database error. Please try again.",
    };
  }
}