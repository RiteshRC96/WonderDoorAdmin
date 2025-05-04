
"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"

export interface OrderStatusData {
  status: string;
  count: number;
  fill: string; // Expect fill color from data
}

interface OrderStatusBarChartProps {
  data: OrderStatusData[];
  config: ChartConfig;
}

export function OrderStatusBarChart({ data, config }: OrderStatusBarChartProps) {
  return (
     <ChartContainer config={config} className="min-h-[200px] w-full">
        <BarChart
          accessibilityLayer
          data={data}
          margin={{
             top: 20,
             right: 20,
             left: 0, // Adjusted left margin
             bottom: 20, // Increased bottom margin for rotated labels
          }}
        >
          <CartesianGrid vertical={false} />
           {/* YAxis with count */}
           <YAxis
              dataKey="count"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.toLocaleString()} // Format number
              allowDecimals={false} // Ensure integer ticks
           />
           {/* XAxis with status labels */}
           <XAxis
            dataKey="status"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={0} // Show all labels
            // Rotate labels to prevent overlap
            angle={-30}
            textAnchor="end" // Anchor rotated text at the end
            height={50} // Allocate more height for rotated labels
            dy={10} // Adjust vertical position of rotated labels
          />
          <ChartTooltip
             cursor={false} // Disable cursor line on hover
             content={<ChartTooltipContent hideLabel />} // Use custom tooltip content
          />
          {/* Define the bars */}
          <Bar
             dataKey="count"
             radius={4} // Rounded corners
             fill="var(--color-primary)" // Fallback fill, should be overridden by data 'fill'
             barSize={40} // Adjust bar width
          />
          {/* Optional Legend - if needed */}
          {/* <ChartLegend content={<ChartLegendContent />} /> */}
        </BarChart>
     </ChartContainer>
  )
}

