
import type { ChartConfig } from "@/components/ui/chart"

export const inventoryChartConfig = {
  count: {
    label: "Items",
  },
  modern: {
    label: "Modern",
    color: "hsl(var(--chart-1))",
  },
  classic: {
    label: "Classic",
    color: "hsl(var(--chart-2))",
  },
  industrial: {
    label: "Industrial",
    color: "hsl(var(--chart-3))",
  },
  bohemian: {
    label: "Bohemian",
    color: "hsl(var(--chart-4))",
  },
  other: {
    label: "Other",
    color: "hsl(var(--chart-5))",
  },
  uncategorized: { // Added for items without a style
      label: "Uncategorized",
      color: "hsl(var(--muted))", // Use muted color
   },
} satisfies ChartConfig

export const orderStatusChartConfig = {
  count: {
    label: "Orders",
  },
  processing: {
    label: "Processing",
    color: "hsl(var(--chart-1))",
  },
  shipped: {
    label: "Shipped",
    color: "hsl(var(--chart-2))",
  },
  delivered: {
    label: "Delivered",
    color: "hsl(var(--chart-3))",
  },
  pending: { // Renamed from 'pending payment' for simplicity if needed, or add both
    label: "Pending",
    color: "hsl(var(--chart-4))",
  },
  'pending payment': { // Keep specific status if used
    label: "Pending Payment",
    color: "hsl(var(--chart-4))", // Same color as pending for example
  },
  cancelled: {
    label: "Cancelled",
    color: "hsl(var(--chart-5))",
  },
  paid: { // Added payment statuses if they should be shown
      label: "Paid",
      color: "hsl(var(--chart-3))", // Example: Same color as delivered
   },
   refunded: {
      label: "Refunded",
      color: "hsl(var(--chart-5))", // Example: Same color as cancelled
   },
   failed: {
      label: "Failed",
      color: "hsl(var(--destructive))", // Use destructive color
   },
   // Fallback for any other status
   other: {
      label: "Other",
      color: "hsl(var(--muted))",
   }
} satisfies ChartConfig
