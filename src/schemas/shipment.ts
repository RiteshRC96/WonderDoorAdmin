
import { z } from 'zod';

// Schema for shipment history events
const ShipmentHistoryEventSchema = z.object({
  timestamp: z.string(), // ISO string representation of Timestamp
  status: z.string(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

// Schema for creating/updating a shipment
export const ShipmentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required."),
  customerName: z.string().min(1, "Customer name is required."), // Denormalized
  carrier: z.string().min(1, "Carrier name is required."),
  trackingNumber: z.string().min(1, "Tracking number is required."),
  status: z.enum(['Label Created', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered', 'Exception', 'Delayed']),
  origin: z.string().min(1, "Origin address is required."),
  destination: z.string().min(1, "Destination address is required."),
  estimatedDelivery: z.string().optional(), // Store as string, potentially parse later
  // actualDelivery: z.string().optional(), // Will be Timestamp on server
  pieces: z.coerce.number().int().min(1, "Number of pieces must be at least 1.").optional(),
  weight: z.string().optional(),
  dimensions: z.string().optional(),
  notes: z.string().optional(),
  // history: z.array(ShipmentHistoryEventSchema).optional(), // History added server-side
});

export type ShipmentInput = z.infer<typeof ShipmentSchema>;

// Define the structure of a Shipment document stored in Firestore, including ID and Timestamps
export interface Shipment extends ShipmentInput {
  id: string;
  createdAt: string; // ISO string representation of Timestamp
  updatedAt?: string; // ISO string representation of Timestamp
  actualDelivery?: string; // ISO string representation of Timestamp
  history: z.infer<typeof ShipmentHistoryEventSchema>[]; // Array of history events
}

// Define the structure for creating a new shipment
export interface CreateShipmentInput extends ShipmentInput {}
