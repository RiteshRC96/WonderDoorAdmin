'use server';

import { revalidatePath } from 'next/cache';
import { AddItemSchema, type AddItemInput } from '@/schemas/inventory';

// Server Action to add a new inventory item
export async function addItemAction(data: AddItemInput) {
  const validationResult = AddItemSchema.safeParse(data);

  if (!validationResult.success) {
    console.error("Validation Errors:", validationResult.error.flatten().fieldErrors);
    // Return structured error data for the client
    return {
      success: false,
      message: "Validation failed. Please check the form fields.",
      errors: validationResult.error.flatten().fieldErrors,
    };
  }

  // Ensure empty string imageUrl becomes undefined if needed downstream, or handle as is.
  const newItemData = {
      ...validationResult.data,
      // Convert empty string imageUrl back to undefined if your backend/DB expects null/undefined
      imageUrl: validationResult.data.imageUrl === "" ? undefined : validationResult.data.imageUrl,
  };


  try {
    // --- >>> PLACEHOLDER: NO DATABASE INTERACTION <<< ---
    // This action *simulates* adding an item to a database.
    // Because there is no actual database connected to this application,
    // the `newItemData` is NOT saved anywhere permanently.
    // The `revalidatePath('/inventory')` call below WILL trigger a refresh
    // of the inventory page, but that page uses a STATIC list of items.
    // Therefore, the newly "added" item WILL NOT APPEAR on the inventory list.
    // To make items persist, you would need to integrate a database
    // (e.g., Firestore, PostgreSQL) and replace this simulation with
    // actual database insertion logic.
    // --- >>> END PLACEHOLDER <<< ---

    console.log("Simulating database insert with item data:", newItemData);

    // Simulate successful addition and network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    const simulatedNewItemId = `SIM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`; // Prefix indicates simulation
    console.log(`Simulated adding item with simulated ID: ${simulatedNewItemId}`);


    // Revalidate the inventory list page cache. This causes the page component
    // to re-run on the next visit, but it won't add the item because the list is static.
    revalidatePath('/inventory');

    // Return success and the simulated ID
     return {
      success: true,
      message: "Item addition simulated successfully!", // Adjusted message
      itemId: simulatedNewItemId,
    };

  } catch (error) {
    console.error("Error during simulated item addition:", error);
    return {
      success: false,
      message: "Failed to simulate item addition due to a server error. Please try again.",
      errors: null, // Indicate no specific field errors for a general server error
    };
  }
}
