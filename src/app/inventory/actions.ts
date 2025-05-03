'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Define the schema for adding an inventory item
export const AddItemSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  style: z.string().min(1, { message: "Style is required." }),
  material: z.string().min(1, { message: "Material is required." }),
  dimensions: z.string().min(1, { message: "Dimensions are required." }),
  stock: z.coerce.number().int().min(0, { message: "Stock cannot be negative." }),
  price: z.coerce.number().min(0, { message: "Price cannot be negative." }),
  description: z.string().optional(),
  sku: z.string().min(1, { message: "SKU is required." }).toUpperCase(),
  weight: z.string().optional(),
  leadTime: z.string().optional(),
  // Allow empty string or a valid URL for optional field
  imageUrl: z.string().url({ message: "Please enter a valid image URL." }).optional().or(z.literal('')),
  imageHint: z.string().optional(),
});

export type AddItemInput = z.infer<typeof AddItemSchema>;

// Server Action to add a new inventory item
export async function addItemAction(data: AddItemInput) {
  const validationResult = AddItemSchema.safeParse(data);

  if (!validationResult.success) {
    console.error("Validation Errors:", validationResult.error.flatten().fieldErrors);
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
    // --- Placeholder for actual database interaction ---
    console.log("Attempting to add item:", newItemData);
    // In a real application, you would insert `newItemData` into your database here.
    // Example (pseudo-code):
    // const db = await connectToDatabase();
    // const newItem = await db.collection('inventory').insertOne(newItemData);
    // const newItemId = newItem.insertedId;

    // Important Note for Simulation: This action *simulates* adding an item.
    // Because there's no database, the item won't actually appear on the
    // inventory list page even after revalidation, as the list page uses static data.
    // --- End Placeholder ---

    // Simulate successful addition
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    const simulatedNewItemId = `ITEM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    console.log(`Simulated adding item with ID: ${simulatedNewItemId}`);


    // Revalidate the inventory list page cache. This causes the page component
    // to re-run on the next visit, but it won't add the item to the static list.
    revalidatePath('/inventory');

    // Return success and potentially the new item's ID
     return {
      success: true,
      message: "Item added successfully!",
      itemId: simulatedNewItemId, // Return the simulated ID
    };

  } catch (error) {
    console.error("Error adding item:", error);
    return {
      success: false,
      message: "Failed to add item due to a server error. Please try again.",
      errors: null, // Indicate no specific field errors for a general server error
    };
  }
  // Redirecting is handled client-side after receiving the success response
}
