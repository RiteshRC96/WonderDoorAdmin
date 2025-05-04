
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button"; // Import Button component
import { useToast } from "@/hooks/use-toast";
import { updateOrderStatusAction, cancelOrderAction } from "@/app/orders/actions"; // Import the server actions
import type { Order } from "@/schemas/order";
import { Loader2, Truck, PackageCheck, RotateCcw, XCircle } from "lucide-react"; // Added XCircle icon

interface OrderStatusUpdaterProps {
  orderId: string;
  currentStatus: Order['status'];
}

export function OrderStatusUpdater({ orderId, currentStatus }: OrderStatusUpdaterProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false); // State for cancellation
  const [localStatus, setLocalStatus] = React.useState<Order['status']>(currentStatus);

  // Keep local state in sync if the prop changes (e.g., after successful update)
  React.useEffect(() => {
    setLocalStatus(currentStatus);
  }, [currentStatus]);

  const handleStatusChange = async (newStatus: Order['status']) => {
    // Prevent updates if already updating or status is unchanged, or if cancelled
    if (isUpdating || isCancelling || newStatus === localStatus || localStatus === 'Cancelled') {
      return;
    }

    setIsUpdating(true);
    try {
      const result = await updateOrderStatusAction(orderId, newStatus);
      if (result.success) {
        toast({
          title: "Status Updated",
          description: `Order status changed to ${newStatus}.`,
        });
        setLocalStatus(newStatus); // Update local state on success
      } else {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: result.message || "Could not update order status.",
        });
        // Optionally revert the switch visually on failure
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

    const handleCancelOrder = async () => {
        if (isUpdating || isCancelling || localStatus === 'Cancelled') {
            return;
        }

        setIsCancelling(true);
        try {
            const result = await cancelOrderAction(orderId); // Use the specific cancel action
            if (result.success) {
                toast({
                    title: "Order Cancelled",
                    description: result.message, // Includes restocking info
                });
                setLocalStatus('Cancelled'); // Update local state
            } else {
                toast({
                    variant: "destructive",
                    title: "Cancellation Failed",
                    description: result.message || "Could not cancel the order.",
                });
            }
        } catch (error) {
            console.error("Error cancelling order:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "An unexpected error occurred during cancellation.",
            });
        } finally {
            setIsCancelling(false);
        }
    };

  // Determine switch states based on localStatus
  const isProcessing = localStatus === 'Processing';
  const isShipped = localStatus === 'Shipped';
  const isDelivered = localStatus === 'Delivered';
  const isCancelled = localStatus === 'Cancelled'; // Add cancelled state check

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-muted-foreground"/> Order Status</CardTitle>
        <CardDescription>Update the current status of the order.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Prevent interactions if cancelled */}
        {isCancelled ? (
             <div className="flex items-center space-x-3 p-4 bg-destructive/10 rounded-md border border-destructive/50">
                <XCircle className="h-5 w-5 text-destructive" />
                <Label className="text-destructive font-medium">Order Cancelled</Label>
             </div>
        ) : (
            <>
                {/* Processing Switch */}
                <div className="flex items-center justify-between space-x-3 p-4 bg-muted/30 rounded-md border">
                <div className="flex items-center gap-2">
                   <PackageCheck className={`h-5 w-5 ${isProcessing ? 'text-primary' : 'text-muted-foreground'}`} />
                    <Label htmlFor={`status-processing-${orderId}`} className="font-medium flex-1">
                    Processing
                    </Label>
                </div>
                <div className="flex items-center gap-2">
                    {isUpdating && localStatus !== 'Processing' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <Switch
                    id={`status-processing-${orderId}`}
                    checked={isProcessing}
                    onCheckedChange={(checked) => {
                        if (checked) handleStatusChange('Processing');
                        // Cannot uncheck 'Processing' directly, must move to 'Shipped'
                    }}
                    disabled={isUpdating || isShipped || isDelivered || isCancelling} // Disable if shipped, delivered or cancelling
                    aria-label="Set status to Processing"
                    />
                </div>
                </div>

                {/* Shipped Switch */}
                <div className="flex items-center justify-between space-x-3 p-4 bg-muted/30 rounded-md border">
                <div className="flex items-center gap-2">
                   <Truck className={`h-5 w-5 ${isShipped ? 'text-primary' : 'text-muted-foreground'}`} />
                    <Label htmlFor={`status-shipped-${orderId}`} className="font-medium flex-1">
                    Shipped
                    </Label>
                </div>
                 <div className="flex items-center gap-2">
                    {isUpdating && localStatus !== 'Shipped' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <Switch
                    id={`status-shipped-${orderId}`}
                    checked={isShipped}
                    onCheckedChange={(checked) => {
                        if (checked) handleStatusChange('Shipped');
                        else handleStatusChange('Processing'); // Revert to Processing if unchecked
                    }}
                    disabled={isUpdating || isDelivered || isCancelling} // Disable if delivered or cancelling
                    aria-label="Set status to Shipped"
                    />
                 </div>
                </div>

                {/* Delivered Switch */}
                <div className="flex items-center justify-between space-x-3 p-4 bg-muted/30 rounded-md border">
                 <div className="flex items-center gap-2">
                    <PackageCheck className={`h-5 w-5 ${isDelivered ? 'text-green-600' : 'text-muted-foreground'}`} />
                    <Label htmlFor={`status-delivered-${orderId}`} className="font-medium flex-1">
                    Delivered
                    </Label>
                 </div>
                 <div className="flex items-center gap-2">
                    {isUpdating && localStatus !== 'Delivered' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <Switch
                    id={`status-delivered-${orderId}`}
                    checked={isDelivered}
                    onCheckedChange={(checked) => {
                        if (checked) handleStatusChange('Delivered');
                        else handleStatusChange('Shipped'); // Revert to Shipped if unchecked
                    }}
                    disabled={isUpdating || isCancelling} // Disable if cancelling
                    aria-label="Set status to Delivered"
                    />
                 </div>
                </div>
            </>
        )}

         {/* Cancel Button - Only show if not already cancelled */}
          {!isCancelled && (
             <Button
                variant="destructive"
                size="sm"
                className="w-full mt-4"
                onClick={handleCancelOrder} // Use the dedicated cancel handler
                disabled={isUpdating || isCancelling || isShipped || isDelivered} // Disable if updating, cancelling, shipped, or delivered
                >
                 {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4"/>}
                 {isCancelling ? 'Cancelling Order...' : 'Cancel Order'}
             </Button>
          )}

      </CardContent>
    </Card>
  );
}

