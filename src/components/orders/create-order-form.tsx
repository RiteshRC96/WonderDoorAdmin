
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import Image from 'next/image';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { createOrderAction } from "@/app/orders/actions";
import { OrderSchema, type CreateOrderInput, type OrderInput } from "@/schemas/order";
import type { AddItemInput } from '@/schemas/inventory';
import { Loader2, PlusCircle, Trash2, DollarSign, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define the structure of an inventory item passed for selection
interface InventorySelectItem extends AddItemInput {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CreateOrderFormProps {
  inventoryItems: InventorySelectItem[];
  fetchError?: string; // Optional error message from server fetching
}

export function CreateOrderForm({ inventoryItems, fetchError }: CreateOrderFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = React.useState<Record<number, InventorySelectItem | null>>({});

  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(OrderSchema),
    defaultValues: {
      customer: {
        name: "",
        email: "",
        phone: "",
        address: "",
      },
      items: [{ itemId: "", name: "", sku: "", quantity: 1, price: 0, image: "", imageHint: "" }], // Start with one item row
      status: "Processing", // Default status
      paymentStatus: "Pending", // Default payment status
      shippingMethod: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Watch items field array to calculate total
  const items = useWatch({
    control: form.control,
    name: 'items',
  });

  const calculateTotal = React.useCallback(() => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [items]);

  const orderTotal = calculateTotal();


  // Handle item selection change
  const handleItemChange = (index: number, selectedItemId: string) => {
    const selectedItem = inventoryItems.find(item => item.id === selectedItemId);
    if (selectedItem) {
      form.setValue(`items.${index}.itemId`, selectedItem.id);
      form.setValue(`items.${index}.name`, selectedItem.name);
      form.setValue(`items.${index}.sku`, selectedItem.sku);
      form.setValue(`items.${index}.price`, selectedItem.price || 0);
       // Ensure price is cleared or set if item changes, triggering re-validation
      form.trigger(`items.${index}.price`); // Trigger validation for price
      // Update image details if available
      form.setValue(`items.${index}.image`, selectedItem.imageUrl || '');
      form.setValue(`items.${index}.imageHint`, selectedItem.imageHint || '');
      setSelectedItemDetails(prev => ({ ...prev, [index]: selectedItem }));
    } else {
       // Clear fields if item is deselected or not found
       form.setValue(`items.${index}.name`, '');
       form.setValue(`items.${index}.sku`, '');
       form.setValue(`items.${index}.price`, 0); // Reset price
       form.trigger(`items.${index}.price`); // Trigger validation
       form.setValue(`items.${index}.image`, '');
       form.setValue(`items.${index}.imageHint`, '');
      setSelectedItemDetails(prev => ({ ...prev, [index]: null }));
    }
  };

  async function onSubmit(values: CreateOrderInput) {
    setIsSubmitting(true);
    try {
        // Ensure all items have a valid itemId before submission
        const hasInvalidItems = values.items.some(item => !item.itemId);
        if (hasInvalidItems) {
            toast({
                variant: "destructive",
                title: "Invalid Item",
                description: "Please select a valid product for all order items.",
            });
            setIsSubmitting(false);
            return;
        }

      const result = await createOrderAction(values);

      if (result.success && result.orderId) {
        toast({
          title: "Success!",
          description: result.message,
        });
        router.push(`/orders/${result.orderId}`); // Redirect to the newly created order's detail page
        // Form reset is not strictly necessary due to redirect

      } else {
        if (result.errors) {
          // Handle specific field errors (less common for orders, more for inventory)
           let firstErrorField: keyof OrderInput | string | null = null;
           // Simplified error handling for order form - focus on customer or items array
           if (result.errors.customer) {
               firstErrorField = `customer.${Object.keys(result.errors.customer)[0]}` as keyof OrderInput;
           } else if (result.errors.items) {
               // Find the first item with an error
               const itemErrorIndex = Object.keys(result.errors.items)[0];
                if (itemErrorIndex && result.errors.items[itemErrorIndex as any]) {
                  const fieldError = Object.keys(result.errors.items[itemErrorIndex as any])[0];
                  firstErrorField = `items.${itemErrorIndex}.${fieldError}`;
                }
           }

           // Generic focus fallback if specific field isn't found easily
           if (firstErrorField) {
             try {
                 form.setError(firstErrorField.split('.')[0] as any, { message: 'Check fields' }); // Mark top level field
                 setTimeout(() => {
                      const firstErrorElement = document.querySelector<HTMLElement>(`[aria-invalid="true"]`);
                      if (firstErrorElement) {
                          firstErrorElement.focus();
                      }
                 }, 0);
             } catch (e) { console.warn("Could not set focus on error field", e); }
           }

          toast({
             variant: "destructive",
             title: "Validation Error",
             description: result.message || "Please check the form fields.",
           });
        } else {
           toast({
             variant: "destructive",
             title: "Error",
             description: result.message || "Failed to create order. Please try again.",
           });
        }
        setIsSubmitting(false); // Keep form active on error
      }
    } catch (error) {
       console.error("Order submission error:", error);
       toast({
         variant: "destructive",
         title: "Submission Error",
         description: "An unexpected error occurred. Please try again.",
       });
       setIsSubmitting(false);
    }
  }

  // Render error message if inventory fetching failed
  if (fetchError) {
      return (
         <Alert variant="destructive" className="mb-6">
             <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Error Loading Inventory Data</AlertTitle>
             <AlertDescription>
                 {fetchError} Cannot create an order without inventory items. Please try refreshing the page or contact support.
                 {fetchError.includes("initialization failed") && (
                     <span className="block mt-2 text-xs">Verify Firebase setup in `.env.local`.</span>
                 )}
             </AlertDescription>
         </Alert>
      );
  }

  return (
    <Card className="max-w-6xl mx-auto shadow-md"> {/* Wider card */}
       <Form {...form}>
         <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            {/* Title handled by page */}
             <CardDescription>Enter customer details and select items to create a new order.</CardDescription>
          </CardHeader>
           <CardContent className="space-y-8">

             {/* Customer Details Section */}
             <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Customer Information</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <FormField
                        control={form.control}
                        name="customer.name"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Customer Name *</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., John Doe" {...field} aria-invalid={!!form.formState.errors.customer?.name} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                     />
                     <FormField
                        control={form.control}
                        name="customer.email"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email (Optional)</FormLabel>
                            <FormControl>
                            <Input type="email" placeholder="e.g., john.doe@example.com" {...field} aria-invalid={!!form.formState.errors.customer?.email} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                     />
                     <FormField
                        control={form.control}
                        name="customer.phone"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Phone (Optional)</FormLabel>
                            <FormControl>
                            <Input type="tel" placeholder="e.g., 555-123-4567" {...field} aria-invalid={!!form.formState.errors.customer?.phone} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                     />
                     <FormField
                        control={form.control}
                        name="customer.address"
                        render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel>Shipping Address *</FormLabel>
                            <FormControl>
                            <Textarea placeholder="e.g., 123 Main St, Anytown, USA 12345" {...field} aria-invalid={!!form.formState.errors.customer?.address}/>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                     />
                 </div>
            </div>

            {/* Order Items Section */}
             <div className="space-y-4">
                 <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-lg font-semibold">Order Items *</h3>
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => append({ itemId: "", name: "", sku: "", quantity: 1, price: 0, image: "", imageHint: "" })}
                        disabled={isSubmitting}
                    >
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                    </Button>
                </div>

                {fields.map((field, index) => (
                    <div key={field.id} className="flex flex-col md:flex-row items-start md:items-center gap-4 border p-4 rounded-md relative">
                         {/* Item Image Thumbnail */}
                         <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-md overflow-hidden border bg-muted">
                            {selectedItemDetails[index]?.imageUrl ? (
                              <Image
                                src={selectedItemDetails[index]?.imageUrl ?? ''}
                                alt={selectedItemDetails[index]?.name ?? 'Product Image'}
                                width={80}
                                height={80}
                                className="object-cover w-full h-full"
                                data-ai-hint={selectedItemDetails[index]?.imageHint || 'product item'}
                              />
                            ) : (
                               <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No Image</div>
                            )}
                         </div>

                         {/* Item Fields */}
                         <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <FormField
                                control={form.control}
                                name={`items.${index}.itemId`}
                                render={({ field }) => (
                                <FormItem className="sm:col-span-2 md:col-span-1">
                                    <FormLabel>Product</FormLabel>
                                    <Select
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            handleItemChange(index, value);
                                        }}
                                        defaultValue={field.value}
                                        disabled={isSubmitting}
                                    >
                                    <FormControl>
                                        <SelectTrigger aria-invalid={!!form.formState.errors.items?.[index]?.itemId}>
                                        <SelectValue placeholder="Select a product..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {inventoryItems.length > 0 ? inventoryItems.map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                            {item.name} ({item.sku}) - Stock: {item.stock}
                                        </SelectItem>
                                        )) : <SelectItem value="no-items" disabled>No inventory items available</SelectItem>}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name={`items.${index}.quantity`}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Quantity</FormLabel>
                                    <FormControl>
                                    <Input
                                        type="number"
                                        min="1"
                                        {...field}
                                        onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)}
                                        aria-invalid={!!form.formState.errors.items?.[index]?.quantity}
                                        disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name={`items.${index}.price`}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unit Price ($)</FormLabel>
                                    <FormControl>
                                    {/* Display price, potentially read-only */}
                                     <Input
                                        type="number"
                                        step="0.01"
                                        readOnly // Price comes from selected item
                                        {...field}
                                        value={field.value || 0} // Ensure value is controlled
                                        className="bg-muted/50"
                                        aria-invalid={!!form.formState.errors.items?.[index]?.price}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            {/* Line Total (Calculated Display) */}
                            <FormItem>
                                <FormLabel>Line Total</FormLabel>
                                <div className="h-10 flex items-center px-3 py-2 text-sm font-medium text-muted-foreground">
                                 ${(form.getValues(`items.${index}.price`) * form.getValues(`items.${index}.quantity`)).toFixed(2)}
                                </div>
                             </FormItem>
                         </div>

                         {/* Remove Button */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 absolute top-1 right-1 md:relative md:top-auto md:right-auto md:self-center"
                            onClick={() => remove(index)}
                            disabled={isSubmitting || fields.length <= 1} // Prevent removing the last item
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                    </div>
                ))}
             </div>

            {/* Order Settings & Summary */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                {/* Order Settings */}
                 <div className="md:col-span-2 space-y-4">
                     <h3 className="text-lg font-semibold border-b pb-2">Order Settings</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                         <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Order Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                                <FormControl>
                                    <SelectTrigger aria-invalid={!!form.formState.errors.status}>
                                    <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {OrderSchema.shape.status.options.map(status => (
                                    <SelectItem key={status} value={status}>{status}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="paymentStatus"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Payment Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                                <FormControl>
                                    <SelectTrigger aria-invalid={!!form.formState.errors.paymentStatus}>
                                    <SelectValue placeholder="Select payment status" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {OrderSchema.shape.paymentStatus.options.map(status => (
                                    <SelectItem key={status} value={status}>{status}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="shippingMethod"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Shipping Method (Optional)</FormLabel>
                                <FormControl>
                                <Input placeholder="e.g., Standard Ground" {...field} aria-invalid={!!form.formState.errors.shippingMethod} disabled={isSubmitting}/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                     </div>
                 </div>

                {/* Order Total */}
                 <div className="space-y-2 self-end">
                    <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2 justify-end"><DollarSign className="h-5 w-5 text-muted-foreground" /> Order Total</h3>
                    <p className="text-3xl font-bold text-primary text-right">${orderTotal.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground text-right">(Excludes tax/shipping for now)</p>
                 </div>
             </div>

           </CardContent>
           <Separator />
           <CardFooter className="flex justify-end space-x-3 p-6">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || items.length === 0}>
                 {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Creating Order..." : "Create Order"}
              </Button>
            </CardFooter>
         </form>
        </Form>
    </Card>
  );
}
