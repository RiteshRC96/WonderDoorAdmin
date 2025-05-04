
import { z } from 'zod';

// Schema for shipment history events - Keep as is
const ShipmentHistoryEventSchema = z.object({
  timestamp: z.string(), // ISO string representation of Timestamp
  status: z.string(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

// Define possible shipment statuses, including the initial one
const shipmentStatuses = ['Label Created', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered', 'Exception', 'Delayed'] as const;

// Schema for creating/updating a shipment
export const ShipmentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required."),
  customerName: z.string().min(1, "Customer name is required."),
  carrier: z.string().min(1, "Carrier name is required.").optional().or(z.literal('TBD')), // Allow 'TBD' initially
  trackingNumber: z.string().min(1, "Tracking number is required.").optional().or(z.literal('Pending')), // Allow 'Pending' initially
  status: z.enum(shipmentStatuses),
  origin: z.string().min(1, "Origin address is required."),
  destination: z.string().min(1, "Destination address is required."),
  estimatedDelivery: z.string().optional().or(z.literal('')), // Allow empty string
  pieces: z.coerce.number().int().min(1, "Number of pieces must be at least 1.").optional(),
  weight: z.string().optional().or(z.literal('')), // Allow empty string
  dimensions: z.string().optional().or(z.literal('')), // Allow empty string
  notes: z.string().optional(),
  // history: z.array(ShipmentHistoryEventSchema).optional(), // Defined in interface, managed server-side
  // actualDelivery: z.string().optional(), // Defined in interface, managed server-side
  // createdAt: z.string(), // Defined in interface
  // updatedAt: z.string().optional(), // Defined in interface
});

export type ShipmentInput = z.infer<typeof ShipmentSchema>;

// Define the structure of a Shipment document stored in Firestore, including ID and Timestamps
export interface Shipment extends ShipmentInput {
  id: string;
  createdAt: string; // ISO string representation of Timestamp
  updatedAt?: string; // ISO string representation of Timestamp
  actualDelivery?: string | null; // ISO string representation of Timestamp or null
  history: z.infer<typeof ShipmentHistoryEventSchema>[]; // Array of history events
}

// Define the structure for creating a new shipment (used internally by createOrderAction)
// This should match the data structure being written to Firestore in the action
export interface CreateShipmentInternal extends ShipmentInput {
    createdAt: Timestamp; // Use Firestore Timestamp type here
    updatedAt: Timestamp; // Use Firestore Timestamp type here
    history: { timestamp: string; status: string; location?: string; notes?: string }[]; // Match event structure
    actualDelivery: null; // Explicitly null
}

