
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input"; // For location/notes
import { Button } from "@/components/ui/button"; // For save button
import { useToast } from "@/hooks/use-toast";
import { updateShipmentStatusAction } from "@/app/logistics/actions"; // Import the server action
import type { Shipment } from "@/schemas/shipment";
import { Loader2, PackageCheck, Truck, MapPin, CheckCircle, XCircle } from "lucide-react"; // Added more icons

interface ShipmentStatusUpdaterProps {
  shipmentId: string;
  currentStatus: Shipment['status'];
}

type StatusStep = Shipment['status'];

const statusOrder: StatusStep[] = ['Label Created', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered'];
const exceptionStatuses: StatusStep[] = ['Exception', 'Delayed']; // Non-linear statuses

export function ShipmentStatusUpdater({ shipmentId, currentStatus }: ShipmentStatusUpdaterProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [localStatus, setLocalStatus] = React.useState<StatusStep>(currentStatus);
  const [updateLocation, setUpdateLocation] = React.useState<string>('');
  const [updateNotes, setUpdateNotes] = React.useState<string>('');

  // Keep local state in sync if the prop changes
  React.useEffect(() => {
    setLocalStatus(currentStatus);
    // Reset location/notes when status prop changes externally
    setUpdateLocation('');
    setUpdateNotes('');
  }, [currentStatus]);

  const handleStatusChange = async (newStatus: StatusStep) => {
    if (isUpdating || newStatus === localStatus) {
      return;
    }

    setIsUpdating(true);
    try {
      const result = await updateShipmentStatusAction(shipmentId, newStatus, updateLocation || undefined, updateNotes || undefined);
      if (result.success) {
        toast({
          title: "Status Updated",
          description: `Shipment status changed to ${newStatus}.`,
        });
        setLocalStatus(newStatus); // Update local state
        setUpdateLocation(''); // Clear inputs on success
        setUpdateNotes('');
      } else {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: result.message || "Could not update shipment status.",
        });
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

  const getStatusIcon = (status: StatusStep) => {
     switch (status) {
         case 'Label Created': return <PackageCheck className="h-5 w-5 text-muted-foreground"/>;
         case 'Picked Up': return <Truck className="h-5 w-5 text-blue-500"/>;
         case 'In Transit': return <Truck className="h-5 w-5 text-orange-500 animate-pulse"/>; // Simple pulse animation
         case 'Out for Delivery': return <Truck className="h-5 w-5 text-yellow-500"/>;
         case 'Delivered': return <CheckCircle className="h-5 w-5 text-green-600"/>;
         case 'Exception':
         case 'Delayed': return <XCircle className="h-5 w-5 text-destructive"/>;
         default: return <MapPin className="h-5 w-5 text-muted-foreground"/>;
     }
   };

  const isExceptionStatus = exceptionStatuses.includes(localStatus);
  const currentStatusIndex = statusOrder.indexOf(localStatus);

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            {getStatusIcon(localStatus)}
            Shipment Status
        </CardTitle>
        <CardDescription>Update the shipment's progress. The current status is: <span className="font-semibold">{localStatus}</span></CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Linear Status Updates (Toggles) */}
        {statusOrder.map((status, index) => {
          // Disable switches for future steps unless it's the next logical step
          // Always disable past steps
          const isCurrentOrPast = index <= currentStatusIndex;
          const isNextStep = index === currentStatusIndex + 1;
          const isDisabled = isUpdating || isExceptionStatus || (index > currentStatusIndex && !isNextStep) || (index < currentStatusIndex);

          return (
            <div key={status} className={`flex items-center justify-between space-x-3 p-4 bg-muted/30 rounded-md border ${!isCurrentOrPast && !isNextStep && 'opacity-50'}`}>
              <div className="flex items-center gap-2">
                {getStatusIcon(status)}
                <Label htmlFor={`status-${status.replace(/\s+/g, '-')}-${shipmentId}`} className="font-medium flex-1">
                  {status}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                 {isUpdating && localStatus !== status && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  id={`status-${status.replace(/\s+/g, '-')}-${shipmentId}`}
                  checked={isCurrentOrPast}
                  onCheckedChange={(checked) => {
                    if (checked && isNextStep) { // Only allow toggling the next step on
                       handleStatusChange(status);
                    } else if (!checked && status === localStatus && index > 0) { // Allow reverting the current step
                        handleStatusChange(statusOrder[index - 1]);
                    }
                  }}
                  disabled={isDisabled}
                  aria-label={`Set status to ${status}`}
                />
              </div>
            </div>
          );
        })}

        <Separator />

        {/* Location and Notes for next update */}
        {!isExceptionStatus && localStatus !== 'Delivered' && (
             <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">Add details for the next status update (optional):</p>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <Input
                    placeholder="Location (e.g., City, State)"
                    value={updateLocation}
                    onChange={(e) => setUpdateLocation(e.target.value)}
                    disabled={isUpdating}
                 />
                 <Input
                    placeholder="Notes (e.g., Weather delay)"
                    value={updateNotes}
                    onChange={(e) => setUpdateNotes(e.target.value)}
                    disabled={isUpdating}
                 />
                </div>
             </div>
        )}


        {/* Exception Status Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row gap-2">
          {exceptionStatuses.map(status => (
             <Button
               key={status}
               variant="destructive"
               size="sm"
               className="flex-1"
               onClick={() => handleStatusChange(status)}
               disabled={isUpdating || localStatus === status || localStatus === 'Delivered'} // Disable if delivered
             >
               {isUpdating && localStatus !== status ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : getStatusIcon(status)}
               Mark as {status}
             </Button>
          ))}
           {/* Button to revert from exception to previous linear status */}
          {isExceptionStatus && (
              <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleStatusChange(statusOrder[currentStatusIndex] || 'Label Created')} // Revert to known linear status
                  disabled={isUpdating}
              >
                  {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4"/>}
                  Resolve Issue (Revert Status)
              </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
