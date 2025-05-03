
'use server';

import { revalidatePath } from 'next/cache';
import { AddItemSchema, type AddItemInput } from '@/schemas/inventory';

// --- >>> IMPORTANT NOTE: NO DATABASE INTERACTION <<< ---
// This server action *simulates* adding an item to a database.
// Because there is NO actual database connected to this application,
// the `newItemData` created below is NOT saved anywhere permanently.
//
// The `revalidatePath('/inventory')` call WILL trigger a refresh
// of the inventory page (`src/app/inventory/page.tsx`), BUT that page
// uses a HARDCODED, STATIC list of items defined directly in its code.
//
// THEREFORE, THE NEWLY "ADDED" ITEM WILL *NOT* APPEAR ON THE INVENTORY LIST.
//
// To make items persist and appear after adding, you would need to:
// 1. Set up a database (e.g., Firestore, PostgreSQL, MongoDB).
// 2. Replace the simulation logic below with actual database insertion logic
//    (e.g., using an ORM like Prisma, or Firebase SDK).
// 3. Update the inventory page (`src/app/inventory/page.tsx`) to fetch
//    items from the database instead of using the static list.
// --- >>> END IMPORTANT NOTE <<< ---


// Server Action to add a new inventory item (Simulation)
export async function addItemAction(data: AddItemInput): Promise<{ success: boolean; message: string; itemId?: string; errors?: Record<string, string[]> | null }> {
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

  // Prepare the data (even though it won't be saved)
  const newItemData = {
      ...validationResult.data,
      imageUrl: validationResult.data.imageUrl === "" ? undefined : validationResult.data.imageUrl,
  };


  try {
    // --- Simulation Logic ---
    console.log("SIMULATING database insert with item data:", newItemData);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate a fake ID to return (purely for the success message)
    const simulatedNewItemId = `SIM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    console.log(`SIMULATED adding item with simulated ID: ${simulatedNewItemId}`);
    // --- End Simulation Logic ---

    // Revalidate the inventory list page cache.
    // This forces Next.js to re-render the page on the next request.
    // HOWEVER, since the page uses a static list, the re-render will just
    // show the same static list again. It won't include the simulated item.
    revalidatePath('/inventory');

    // Return success and the simulated ID
     return {
      success: true,
      message: `Item addition simulated successfully! (ID: ${simulatedNewItemId}). Note: Item won't appear in list due to static data.`, // Adjusted message
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
