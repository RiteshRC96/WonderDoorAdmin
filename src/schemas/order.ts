
import { z } from 'zod';
// Assuming inventory schema exists, but imageHint is removed from it too
// import { AddItemSchema } from './inventory';

// Schema for customer details within an order
const CustomerSchema = z.object({
  name: z.string().min(1, "Customer name is required."),
  email: z.string().email("Invalid email address.").optional(),
  phone: z.string().optional(),
  address: z.string().min(1, "Shipping address is required."),
});

// Schema for an item within an order
// Removed imageHint
const OrderItemSchema = z.object({
  itemId: z.string(), // Reference to the inventory item ID
  name: z.string(), // Denormalized for display
  sku: z.string(), // Denormalized for display
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  price: z.coerce.number().min(0, "Price cannot be negative."), // Price per unit at the time of order
  image: z.string().url().optional().or(z.literal('')), // Denormalized for display
  // imageHint: z.string().optional(), // Removed
});

// Schema for creating/updating an order
export const OrderSchema = z.object({
  customer: CustomerSchema,
  items: z.array(OrderItemSchema).min(1, "Order must contain at least one item."),
  status: z.enum(['Processing', 'Shipped', 'Delivered', 'Cancelled', 'Pending Payment']),
  paymentStatus: z.enum(['Paid', 'Pending', 'Refunded', 'Failed']),
  shippingMethod: z.string().optional(),
});

export type OrderInput = z.infer<typeof OrderSchema>;

// Define the structure of an Order document stored in Firestore, including ID and Timestamps
export interface Order extends OrderInput {
  id: string;
  createdAt: string; // ISO string representation of Timestamp
  updatedAt?: string; // ISO string representation of Timestamp
  total: number; // Calculated total
  shipmentId?: string;
}

// Define the structure for creating a new order (matches OrderInput)
export interface CreateOrderInput extends OrderInput {}
