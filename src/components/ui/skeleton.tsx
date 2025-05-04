
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // Updated background color for better contrast in both themes
      className={cn("animate-pulse rounded-md bg-muted/60 dark:bg-muted/40", className)}
      {...props}
    />
  )
}

export { Skeleton }
