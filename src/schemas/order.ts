import { z } from 'zod';

// Define possible statuses
const OrderStatusEnum = z.enum(['Pending Payment', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded']);
const PaymentStatusEnum = z.enum(['Pending', 'Paid', 'COD', 'Refunded', 'Failed']);


// Schema for customer/shipping details based on Firestore's shippingInfo
const ShippingInfoSchema = z.object({
  name: z.string().min(1, "Customer name is required."),
  email: z.string().email("Invalid email address.").optional().or(z.literal('')),
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
  // Removed cartItemId as it seems redundant if items array index is used
  // cartItemId: z.string(), // Unique ID for the item in the cart/order context
  itemId: z.string().min(1, "Product must be selected."), // Reference to the inventory item ID
  name: z.string(), // Denormalized product name (set when item is selected)
  sku: z.string(), // Denormalized product SKU (set when item is selected)
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  price: z.coerce.number().min(0, "Price cannot be negative."), // Price per unit at the time of order (set when item is selected)
  image: z.string().url("Invalid image URL.").optional().or(z.literal('')), // Denormalized product image URL (set when item is selected)
  customizations: ItemCustomizationsSchema.optional(), // Optional customizations
});

// Schema for payment info based on Firestore
const PaymentInfoSchema = z.object({
    paymentMethod: PaymentStatusEnum, // Use enum
    // Add other payment details if needed (e.g., transaction ID)
});

// Schema for tracking info based on Firestore
const TrackingInfoSchema = z.object({
    carrier: z.string().optional(),
    status: z.string().optional(), // Shipment status (can be different from main order status)
    trackingNumber: z.string().optional(),
});

// --- Main Order Schema reflecting Firestore structure ---
// This schema is used for validating the INPUT data for creating/updating orders.
export const OrderSchema = z.object({
  // Map Firestore fields to schema fields
  customer: ShippingInfoSchema, // Use ShippingInfoSchema directly for customer input
  items: z.array(OrderItemSchema).min(1, "Order must contain at least one item."),
  status: OrderStatusEnum, // Use enum for main order status
  paymentStatus: PaymentStatusEnum, // Use enum for payment status - might overlap with main status logic
  shippingMethod: z.string().optional().or(z.literal('')),

  // Fields below are part of the Order interface for reading data, not typically part of the core input validation schema
  // paymentInfo: PaymentInfoSchema, // Handled separately or derived? Let's keep paymentStatus for input
  // trackingInfo: TrackingInfoSchema.optional(), // Usually added after creation
  // userId: z.string(), // Usually added server-side based on authentication
});

// Type for validating input FORM data
export type OrderInput = z.infer<typeof OrderSchema>;


// Define the structure of an Order document READ FROM Firestore
export interface Order {
  id: string; // Firestore document ID
  items: z.infer<typeof OrderItemSchema>[]; // Use mapped items
  orderDate: string; // ISO string representation of Firestore Timestamp
  paymentInfo: { paymentMethod: string }; // Reflects actual DB structure (string)
  shippingInfo: z.infer<typeof ShippingInfoSchema>;
  status: string; // Main order status from Firestore (string)
  totalAmount: number; // Total order amount from Firestore
  trackingInfo?: z.infer<typeof TrackingInfoSchema>; // Optional tracking info
  userId: string;

  // Compatibility mappings for potential UI use
  createdAt?: string;
  updatedAt?: string;
  shipmentId?: string;
  customer: { // Use DB structure directly
      name: string;
      email?: string;
      phone?: string;
      address: string;
      // Add city, state, zip if needed by UI directly
      city?: string;
      state?: string;
      zipCode?: string;
  };
  total?: number; // Map from totalAmount
  paymentStatus: string; // Map from paymentInfo.paymentMethod or status
  shippingMethod?: string; // Map from trackingInfo.carrier or separate field?
}

// Schema/Type for creating an order might need to be different,
// depending on what data is expected from the creation form.
// Use OrderInput for form validation.
export interface CreateOrderInput extends OrderInput {}

// Export enums for use in components
export { OrderStatusEnum, PaymentStatusEnum };
