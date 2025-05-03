import { z } from 'zod';

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