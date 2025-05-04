
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
      // Ensure undefined is not stored if imageUrl is empty
      imageUrl: validationResult.data.imageUrl === "" ? undefined : validationResult.data.imageUrl,
      createdAt: serverTimestamp(), // Add a server timestamp on creation
      updatedAt: serverTimestamp(), // Also set updatedAt on creation
  };
  // Remove empty optional fields before sending to Firestore
  Object.keys(newItemData).forEach(key => {
    if (newItemData[key as keyof typeof newItemData] === undefined || newItemData[key as keyof typeof newItemData] === "") {
      delete newItemData[key as keyof typeof newItemData];
    }
  });


  try {
    console.log("Attempting to add item to Firestore...");
    // Add the new item document to the 'inventory' collection
    const inventoryCollectionRef = collection(db, 'inventory');
    const docRef = await addDoc(inventoryCollectionRef, newItemData);

    console.log(`Successfully added item with ID: ${docRef.id}`);

    // Revalidate the inventory list page cache to show the new item
    revalidatePath('/inventory'); // Revalidate the main inventory listing page


    // Return success and the actual document ID
    return {
      success: true,
      message: `Item '${newItemData.name}' added successfully!`,
      itemId: docRef.id,
    };

  } catch (error) {
     const errorMessage = `Error adding item to Firestore: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return {
      success: false,
      message: "Failed to add item due to a database error. Please try again.", // Keep UI message simple
      errors: null, // Indicate no specific field errors for a general server error
    };
  }
}

// Server Action to update an existing inventory item in Firestore
export async function updateItemAction(
  itemId: string,
  data: AddItemInput
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
  const itemDataToUpdate = {
    ...validationResult.data,
    imageUrl: validationResult.data.imageUrl === "" ? undefined : validationResult.data.imageUrl,
    updatedAt: serverTimestamp(), // Update the timestamp
  };
  // Remove empty optional fields before sending to Firestore
  Object.keys(itemDataToUpdate).forEach(key => {
    if (itemDataToUpdate[key as keyof typeof itemDataToUpdate] === undefined || itemDataToUpdate[key as keyof typeof itemDataToUpdate] === "") {
      delete itemDataToUpdate[key as keyof typeof itemDataToUpdate];
    }
  });

  try {
    console.log(`Attempting to update item with ID: ${itemId}`);
    const itemDocRef = doc(db, 'inventory', itemId);
    await updateDoc(itemDocRef, itemDataToUpdate);

    console.log(`Successfully updated item with ID: ${itemId}`);

    // Revalidate relevant paths
    revalidatePath('/inventory'); // Revalidate the list page
    revalidatePath(`/inventory/${itemId}`); // Revalidate the detail page
    revalidatePath(`/inventory/${itemId}/edit`); // Revalidate the edit page itself

    return {
      success: true,
      message: `Item '${itemDataToUpdate.name}' updated successfully!`,
    };

  } catch (error) {
    const errorMessage = `Error updating item in Firestore (ID: ${itemId}): ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
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

    revalidatePath('/inventory'); // Revalidate the inventory list
    revalidatePath(`/inventory/${itemId}`); // Revalidate the detail page (will result in 404)
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
