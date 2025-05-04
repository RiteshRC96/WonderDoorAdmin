
import type { ChartConfig } from "@/components/ui/chart"

export const inventoryChartConfig = {
  count: {
    label: "Items",
  },
  modern: {
    label: "Modern",
    color: "hsl(var(--chart-1))", // Now yellow
  },
  classic: {
    label: "Classic",
    color: "hsl(var(--chart-2))", // Green
  },
  industrial: {
    label: "Industrial",
    color: "hsl(var(--chart-3))", // Blue
  },
  bohemian: {
    label: "Bohemian",
    color: "hsl(var(--chart-4))", // Purple
  },
  other: {
    label: "Other",
    color: "hsl(var(--chart-5))", // Orange
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
    color: "hsl(var(--chart-1))", // Now yellow
  },
  shipped: {
    label: "Shipped",
    color: "hsl(var(--chart-2))", // Green
  },
  delivered: {
    label: "Delivered",
    color: "hsl(var(--chart-3))", // Blue
  },
  pending: {
    label: "Pending",
    color: "hsl(var(--chart-4))", // Purple
  },
  'pending payment': {
    label: "Pending Payment",
    color: "hsl(var(--chart-4))", // Purple
  },
  cancelled: {
    label: "Cancelled",
    color: "hsl(var(--chart-5))", // Orange
  },
  paid: {
      label: "Paid",
      color: "hsl(var(--chart-3))", // Blue (like delivered)
   },
   refunded: {
      label: "Refunded",
      color: "hsl(var(--chart-5))", // Orange (like cancelled)
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
