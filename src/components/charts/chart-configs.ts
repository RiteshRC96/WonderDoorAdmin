
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
  pending: {
    label: "Pending",
    color: "hsl(var(--chart-4))",
  },
  cancelled: {
    label: "Cancelled",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig
