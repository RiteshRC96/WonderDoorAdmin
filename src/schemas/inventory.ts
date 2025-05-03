
import { z } from 'zod';

// Define the schema for adding an inventory item
export const AddItemSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  style: z.string().min(1, { message: "Style is required." }),
  material: z.string().min(1, { message: "Material is required." }),
  dimensions: z.string().min(1, { message: "Dimensions are required." }),
  // Use coerce.number() and provide a default value on parse failure if needed,
  // or handle NaN in the form/action logic. Zod default() works on undefined input.
  stock: z.coerce.number({invalid_type_error: "Stock must be a number."})
           .int({message: "Stock must be a whole number."})
           .min(0, { message: "Stock cannot be negative." })
           .default(0), // Default if input is undefined, null, or fails coercion before validation
  price: z.coerce.number({invalid_type_error: "Price must be a number."})
           .min(0, { message: "Price cannot be negative." })
           .default(0), // Default if input is undefined, null, or fails coercion before validation
  description: z.string().optional(),
  sku: z.string().min(1, { message: "SKU is required." }).toUpperCase(),
  weight: z.string().optional(),
  leadTime: z.string().optional(),
  // Allow empty string or a valid URL for optional field
  imageUrl: z.string().url({ message: "Please enter a valid image URL." }).optional().or(z.literal('')),
  imageHint: z.string().optional(),
  // Add createdAt for Firestore consistency (optional here, set in action)
  // createdAt: z.date().optional(),
});

export type AddItemInput = z.infer<typeof AddItemSchema>;
