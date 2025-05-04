import { z } from 'zod';

// Define the schema for adding an inventory item
export const AddItemSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  style: z.string().min(1, { message: "Style is required." }),
  material: z.string().min(1, { message: "Material is required." }),
  dimensions: z.string().min(1, { message: "Dimensions are required." }),
  stock: z.coerce.number({invalid_type_error: "Stock must be a number."})
           .int({message: "Stock must be a whole number."})
           .min(0, { message: "Stock cannot be negative." })
           .default(0),
  price: z.coerce.number({invalid_type_error: "Price must be a number."})
           .min(0, { message: "Price cannot be negative." })
           .default(0),
  description: z.string().optional(),
  sku: z.string().min(1, { message: "SKU is required." }).toUpperCase(),
  weight: z.string().optional(),
  leadTime: z.string().optional(),
  // imageUrl is now optional and will hold the Firebase Storage URL.
  // It's set by the server action after upload. Client form should not submit this directly.
  imageUrl: z.string().url("Must be a valid URL (will be set after upload)").optional(),
  // Image hint is required, used for placeholder generation or if no image uploaded.
  imageHint: z.string().min(3, { message: "Image hint is required (e.g., 'modern sofa')." }),
});

// Type for data submitted from the form (excluding the image file itself)
export type AddItemInput = z.infer<typeof AddItemSchema>;

// Type for the server action, including the optional image data URL
// This is what the server action receives from the client form component.
export interface AddItemPayload extends AddItemInput {
  imageDataUrl?: string; // Optional Base64 Data URL string for the image to be uploaded
}