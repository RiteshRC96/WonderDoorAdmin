import { z } from 'zod';

// Define the schema for adding/editing an inventory item
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
  // imageUrl is now optional and will hold the image URL (e.g., from Google Drive).
  imageUrl: z.string().url("Must be a valid URL.").optional().or(z.literal('')), // Allow empty string or valid URL
  // Removed imageHint
  // Removed imageDataUrl from payload type below
});

// Type for data submitted from the form or stored in DB
export type AddItemInput = z.infer<typeof AddItemSchema>;

// No separate payload type needed anymore
// export interface AddItemPayload extends AddItemInput {
//   imageDataUrl?: string;
// }
