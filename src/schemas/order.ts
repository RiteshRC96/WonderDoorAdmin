import { z } from 'zod';

// Define possible statuses
export const OrderStatusEnum = z.enum(['Pending Payment', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded']);
// Updated PaymentStatusEnum
export const PaymentStatusEnum = z.enum(['Pending', 'Paid', 'COD', 'Refunded', 'Failed', 'Completed', 'Delivered']);


// Schema for customer/shipping details based on Firestore's shippingInfo
const ShippingInfoSchema = z.object({
  name: z.string().min(1, "Customer name is required."),
  email: z.string().email("Invalid email address.").optional().or(z.literal('')),
  phone: z.string().optional(),
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
  itemId: z.string().min(1, "Product must be selected."), // Reference to the inventory item ID
  name: z.string(), // Denormalized product name (set when item is selected)
  sku: z.string(), // Denormalized product SKU (set when item is selected)
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  price: z.coerce.number().min(0, "Price cannot be negative."), // Price per unit at the time of order
  image: z.string().url("Invalid image URL.").optional().or(z.literal('')), // Denormalized product image URL
  customizations: ItemCustomizationsSchema.optional(),
});

// Schema for payment info based on Firestore
const PaymentInfoSchema = z.object({
    paymentMethod: PaymentStatusEnum, // Use enum
});

// Schema for tracking info based on Firestore
const TrackingInfoSchema = z.object({
    carrier: z.string().optional(),
    status: z.string().optional(),
    trackingNumber: z.string().optional(),
});

// --- Main Order Input Schema (for Forms) ---
// This defines the structure expected from the Create/Edit Order forms.
export const OrderSchema = z.object({
  customer: ShippingInfoSchema,
  items: z.array(OrderItemSchema).min(1, "Order must contain at least one item."),
  status: OrderStatusEnum,
  paymentStatus: PaymentStatusEnum, // Use the updated enum for input
  shippingMethod: z.string().optional().or(z.literal('')),
});

// Type for validating input FORM data (Create/Edit)
export type OrderInput = z.infer<typeof OrderSchema>;

// Define the structure of an Order document READ FROM Firestore
export interface Order {
  id: string;
  items: { // Reflecting DB structure closely
    cartItemId?: string; // Optional from DB
    doorId: string;
    name: string;
    sku: string;
    quantity: number;
    finalPrice: number;
    imageUrl?: string;
    customizations?: z.infer<typeof ItemCustomizationsSchema>;
  }[];
  orderDate: string; // ISO string
  paymentInfo: {
    paymentMethod: string; // Actual DB value is likely a string
  };
  shippingInfo: z.infer<typeof ShippingInfoSchema>;
  status: string; // Actual DB value is likely a string
  totalAmount: number;
  trackingInfo?: z.infer<typeof TrackingInfoSchema>;
  userId: string;

  // Compatibility mappings for potential UI use (optional)
  createdAt?: string;
  updatedAt?: string;
  shipmentId?: string;
  customer?: { // Map from shippingInfo for easier UI access if needed
      name: string;
      email?: string;
      phone?: string;
      address: string;
      city?: string;
      state?: string;
      zipCode?: string;
  };
  total?: number; // Map from totalAmount
  paymentStatus?: string; // Map from paymentInfo.paymentMethod or status
  shippingMethod?: string; // Map from trackingInfo.carrier
}

// Type for creating an order - uses the form input type
export interface CreateOrderInput extends OrderInput {}
