
'use server';

import { revalidatePath } from 'next/cache';
import { AddItemSchema, type AddItemInput } from '@/schemas/inventory';
import { db, collection, addDoc } from '@/lib/firebase/firebase'; // Import Firestore instance and functions

// Server Action to add a new inventory item to Firestore
export async function addItemAction(data: AddItemInput): Promise<{ success: boolean; message: string; itemId?: string; errors?: Record<string, string[]> | null }> {
  // Ensure Firestore is initialized before proceeding
  if (!db) {
    const errorMessage = "Firestore database is not initialized. Check Firebase configuration in .env.local and restart the server. Cannot add item.";
    console.error(errorMessage);
    return {
      success: false,
      message: "Database configuration error. Unable to add item.", // Keep UI message simpler
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
      createdAt: new Date(), // Add a timestamp
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
    // Use a tag-based or path-based revalidation strategy
    revalidatePath('/inventory'); // Revalidate the main inventory listing page
    revalidatePath(`/inventory/${docRef.id}`); // Revalidate the specific item page (though less critical here)


    // Return success and the actual document ID
    return {
      success: true,
      message: `Item '${newItemData.name}' added successfully!`,
      itemId: docRef.id,
    };

  } catch (error) {
     const errorMessage = `Error adding item to Firestore: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    // Check if the error is a Firestore specific error if needed
    // Example: if (error instanceof FirestoreError) { ... }
    return {
      success: false,
      message: "Failed to add item due to a database error. Please try again.", // Keep UI message simple
      errors: null, // Indicate no specific field errors for a general server error
    };
  }
}
