
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
// import { updateOrderStatusAction, cancelOrderAction } from "@/app/orders/actions"; // Actions might need update too
import type { Order } from "@/schemas/order"; // Schema needs update
import { Loader2, Truck, PackageCheck, RotateCcw, XCircle } from "lucide-react";

interface OrderStatusUpdaterProps {
  orderId: string;
  currentStatus: string; // Use string for now as enum might change
}

export function OrderStatusUpdater({ orderId, currentStatus }: OrderStatusUpdaterProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [localStatus, setLocalStatus] = React.useState<string>(currentStatus);

  React.useEffect(() => {
    setLocalStatus(currentStatus);
  }, [currentStatus]);

  const handleStatusChange = async (newStatus: string) => {
    // Basic prevention
    if (isUpdating || isCancelling || newStatus === localStatus || localStatus === 'Cancelled') { // Assuming 'Cancelled' status exists
      return;
    }
    console.warn("Status update logic needs rework for the new data structure.");
    toast({ variant: "destructive", title: "Feature Disabled", description: "Order status update needs rework." });
    // Original logic commented out
    /*
    setIsUpdating(true);
    try {
      // const result = await updateOrderStatusAction(orderId, newStatus); // Action needs update
      // if (result.success) { ... } else { ... }
    } catch (error) { ... } finally { setIsUpdating(false); }
    */
  };

    const handleCancelOrder = async () => {
        if (isUpdating || isCancelling || localStatus === 'Cancelled') {
            return;
        }
        console.warn("Order cancellation logic needs rework for the new data structure.");
        toast({ variant: "destructive", title: "Feature Disabled", description: "Order cancellation needs rework." });
        // Original logic commented out
        /*
        setIsCancelling(true);
        try {
            // const result = await cancelOrderAction(orderId); // Action needs update
            // if (result.success) { ... } else { ... }
        } catch (error) { ... } finally { setIsCancelling(false); }
        */
    };

  // Determine switch states based on simplified logic for now
  const isProcessing = localStatus.toLowerCase().includes('processing') || localStatus.toLowerCase().includes('pending');
  const isShipped = localStatus.toLowerCase().includes('shipped') || localStatus.toLowerCase().includes('transit');
  const isDelivered = localStatus.toLowerCase().includes('delivered');
  const isCancelled = localStatus.toLowerCase().includes('cancelled');

  return (
    <Card className="shadow-md opacity-50 pointer-events-none"> {/* Disable visually and functionally */}
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-muted-foreground"/> Order Status (Disabled)</CardTitle>
        <CardDescription>This component needs updates for the new order data structure.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {isCancelled ? (
             <div className="flex items-center space-x-3 p-4 bg-destructive/10 rounded-md border border-destructive/50">
                <XCircle className="h-5 w-5 text-destructive" />
                <Label className="text-destructive font-medium">Order Cancelled</Label>
             </div>
        ) : (
            <>
                {/* Placeholder switches */}
                <div className="flex items-center justify-between space-x-3 p-4 bg-muted/30 rounded-md border">
                 <div className="flex items-center gap-2">
                    <PackageCheck className={`h-5 w-5 ${isProcessing ? 'text-primary' : 'text-muted-foreground'}`} />
                     <Label htmlFor={`status-processing-${orderId}`} className="font-medium flex-1">
                     Processing/Pending
                     </Label>
                 </div>
                 <Switch id={`status-processing-${orderId}`} checked={isProcessing} disabled />
                </div>

                <div className="flex items-center justify-between space-x-3 p-4 bg-muted/30 rounded-md border">
                 <div className="flex items-center gap-2">
                    <Truck className={`h-5 w-5 ${isShipped ? 'text-primary' : 'text-muted-foreground'}`} />
                     <Label htmlFor={`status-shipped-${orderId}`} className="font-medium flex-1">
                     Shipped/In Transit
                     </Label>
                 </div>
                  <Switch id={`status-shipped-${orderId}`} checked={isShipped} disabled />
                </div>

                <div className="flex items-center justify-between space-x-3 p-4 bg-muted/30 rounded-md border">
                  <div className="flex items-center gap-2">
                     <PackageCheck className={`h-5 w-5 ${isDelivered ? 'text-green-600' : 'text-muted-foreground'}`} />
                     <Label htmlFor={`status-delivered-${orderId}`} className="font-medium flex-1">
                     Delivered
                     </Label>
                  </div>
                  <Switch id={`status-delivered-${orderId}`} checked={isDelivered} disabled />
                 </div>
            </>
        )}

         {!isCancelled && (
             <Button
                variant="destructive"
                size="sm"
                className="w-full mt-4"
                disabled
                >
                 <RotateCcw className="mr-2 h-4 w-4"/>
                 Cancel Order
             </Button>
          )}

      </CardContent>
    </Card>
  );
}

