import { z } from 'zod';

// Schema for customer/shipping details based on Firestore's shippingInfo
const ShippingInfoSchema = z.object({
  name: z.string().min(1, "Customer name is required."),
  email: z.string().email("Invalid email address.").optional(),
  phone: z.string().optional(), // Assuming phone might be added later or is optional
  address: z.string().min(1, "Shipping address is required."),
  city: z.string().min(1, "City is required."),
  state: z.string().min(1, "State is required."),
  zipCode: z.string().min(1, "Zip code is required."),
});

// Schema for item customizations based on Firestore
const ItemCustomizationsSchema = z.object({
    material: z.string().optional(),
    size: z.object({
        height: z.number().optional(),
        width: z.number().optional(),
    }).optional(),
});

// Schema for an item within an order based on Firestore
const OrderItemSchema = z.object({
  cartItemId: z.string(), // Unique ID for the item in the cart/order context
  doorId: z.string(), // Reference to the inventory item ID (assuming this maps to inventory)
  name: z.string(), // Denormalized product name
  sku: z.string(), // Denormalized product SKU
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  finalPrice: z.coerce.number().min(0, "Price cannot be negative."), // Price per unit at the time of order
  imageUrl: z.string().url("Invalid image URL.").optional().or(z.literal('')), // Denormalized product image URL
  customizations: ItemCustomizationsSchema.optional(), // Optional customizations
});

// Schema for payment info based on Firestore
const PaymentInfoSchema = z.object({
    paymentMethod: z.string().min(1, "Payment method required."), // e.g., "cod", "card"
    // Add other payment details if needed (e.g., transaction ID)
});

// Schema for tracking info based on Firestore
const TrackingInfoSchema = z.object({
    carrier: z.string().optional(),
    status: z.string().optional(), // Shipment status
    trackingNumber: z.string().optional(),
});

// --- Main Order Schema reflecting Firestore structure ---
// Note: This schema is primarily for reading/displaying data based on the provided structure.
// Creating/Updating might need adjustments or separate schemas if the input differs significantly.
export const OrderSchema = z.object({
  // Map Firestore fields to schema fields
  shippingInfo: ShippingInfoSchema,
  items: z.array(OrderItemSchema).min(1, "Order must contain at least one item."),
  status: z.string(), // Main order status (e.g., "Pending Payment", "Processing", "Shipped")
  paymentInfo: PaymentInfoSchema,
  trackingInfo: TrackingInfoSchema.optional(), // Tracking info might not exist initially
  userId: z.string(), // User who placed the order
  // orderDate: handled by Order interface using string representation
  // totalAmount: handled by Order interface

  // --- Fields from previous schema (might need mapping or removal) ---
  // customer: Merged into shippingInfo
  // paymentStatus: Possibly derived from paymentInfo.paymentMethod or top-level status? Assuming top-level 'status' covers this for now.
  // shippingMethod: Not present in Firestore example, maybe derived from trackingInfo.carrier? Marked optional.
  shippingMethod: z.string().optional(),
});

// Type for validating input if needed (might differ from Firestore structure)
// For now, mirroring OrderSchema for consistency, but might need refinement for creation/update forms.
export type OrderInput = z.infer<typeof OrderSchema>;

// Define the structure of an Order document READ FROM Firestore
export interface Order {
  id: string; // Firestore document ID
  items: z.infer<typeof OrderItemSchema>[];
  orderDate: string; // ISO string representation of Firestore Timestamp
  paymentInfo: z.infer<typeof PaymentInfoSchema>;
  shippingInfo: z.infer<typeof ShippingInfoSchema>;
  status: string; // Main order status from Firestore
  totalAmount: number; // Total order amount from Firestore
  trackingInfo?: z.infer<typeof TrackingInfoSchema>; // Optional tracking info
  userId: string;
  // Potentially add calculated fields or fields mapped from previous structure if needed by UI
  // For example, mapping Firestore's 'status' to the old enum might be needed temporarily
  // or calculating derived statuses.
  createdAt?: string; // Keep original field if needed by other parts, map from orderDate
  updatedAt?: string; // Optional, if exists in Firestore
  shipmentId?: string; // Maybe derived from trackingInfo.trackingNumber or a separate field?
  // Map 'customer' for compatibility if needed by UI components expecting it
  customer?: {
      name: string;
      email?: string;
      phone?: string;
      address: string;
  };
  // Map old 'total' if needed
  total?: number;
  // Map old status/paymentStatus if needed
  paymentStatus?: string;
}

// Schema/Type for creating an order might need to be different,
// depending on what data is expected from the creation form.
// For now, let's assume CreateOrderInput is similar to OrderInput.
export interface CreateOrderInput extends OrderInput {}
