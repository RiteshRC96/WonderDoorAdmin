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
import { Card, CardContent, CardHeader, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { updateOrderAction } from "@/app/orders/actions"; // Use update action
// Import the enums along with the types/schema
import { OrderSchema, type OrderInput, type Order, OrderStatusEnum, PaymentStatusEnum } from "@/schemas/order";
import type { AddItemInput } from '@/schemas/inventory';
import { Loader2, PlusCircle, Trash2, DollarSign } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {z} from "zod";

// Structure for inventory items used in selection dropdown
interface InventorySelectItem extends AddItemInput {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  imageUrl?: string; // Keep explicit
  name: string; // Ensure required fields
  sku: string;
  stock: number;
  price: number; // Add price to InventorySelectItem
}

// Define a type for the Order object with serializable dates (matching the Server Component)
interface SerializableOrder extends Omit<Order, 'orderDate' | 'createdAt' | 'updatedAt'> {
  orderDate: string; // ISO string
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string or undefined
}


interface EditOrderFormProps {
  order: SerializableOrder; // Expect the serializable order data
  inventoryItems: InventorySelectItem[];
}

export function EditOrderForm({ order, inventoryItems }: EditOrderFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = React.useState<Record<number, InventorySelectItem | null>>(() => {
      const initialDetails: Record<number, InventorySelectItem | null> = {};
      order.items.forEach((item, index) => {
          // Find the matching inventory item based on 'doorId' from DB
          const foundItem = inventoryItems.find(invItem => invItem.id === item.doorId);
          initialDetails[index] = foundItem || null;
      });
      return initialDetails;
  });

  const form = useForm<OrderInput>({
    resolver: zodResolver(OrderSchema),
    defaultValues: {
      // Map DB structure (Order) to Form structure (OrderInput)
       customer: {
           name: order.shippingInfo.name,
           email: order.shippingInfo.email || "",
           phone: order.shippingInfo.phone || "",
           address: order.shippingInfo.address,
           city: order.shippingInfo.city,
           state: order.shippingInfo.state,
           zipCode: order.shippingInfo.zipCode,
       },
      items: order.items.map(item => ({
          itemId: item.doorId, // Map doorId from DB to itemId in form
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          price: item.finalPrice, // Map finalPrice from DB to price in form
          image: item.imageUrl || '', // Map imageUrl from DB to image in form
          customizations: item.customizations, // Pass customizations through
      })),
      status: order.status as z.infer<typeof OrderStatusEnum>, // Cast existing status to enum type
      paymentStatus: order.paymentInfo.paymentMethod as z.infer<typeof PaymentStatusEnum>, // Cast payment method to enum type
      shippingMethod: order.trackingInfo?.carrier || "", // Map carrier to shippingMethod
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
      form.setValue(`items.${index}.price`, selectedItem.price || 0); // Use price from selected inventory item
      form.trigger(`items.${index}.price`);
      form.setValue(`items.${index}.image`, selectedItem.imageUrl || '');
      setSelectedItemDetails(prev => ({ ...prev, [index]: selectedItem }));
    } else {
       form.setValue(`items.${index}.name`, '');
       form.setValue(`items.${index}.sku`, '');
       form.setValue(`items.${index}.price`, 0);
       form.trigger(`items.${index}.price`);
       form.setValue(`items.${index}.image`, '');
      setSelectedItemDetails(prev => ({ ...prev, [index]: null }));
    }
      // Trigger validation for the item ID field after selection
      form.trigger(`items.${index}.itemId`);
  };

  async function onSubmit(values: OrderInput) {
    setIsSubmitting(true);
    try {
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
      // Use the Order ID from the passed `order` prop
      const result = await updateOrderAction(order.id, values);

      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        router.push(`/orders/${order.id}`);
        router.refresh();

      } else {
         if (result.errors) {
             let firstErrorField: keyof OrderInput | string | null = null;
              // Improved error mapping logic
             Object.entries(result.errors).forEach(([key, value]) => {
                 if (key === 'customer' && typeof value === 'object' && value !== null) {
                     const customerErrorKey = Object.keys(value)[0];
                     if (customerErrorKey) firstErrorField = `customer.${customerErrorKey}`;
                     Object.entries(value).forEach(([field, messages]: [string, any]) => {
                         form.setError(`customer.${field as keyof OrderInput['customer']}`, { message: messages?.[0] });
                     });
                 } else if (key === 'items' && Array.isArray(value)) {
                     value.forEach((itemErrors, index) => {
                         if (typeof itemErrors === 'object' && itemErrors !== null) {
                             const itemErrorKey = Object.keys(itemErrors)[0];
                              if (itemErrorKey && !firstErrorField) firstErrorField = `items.${index}.${itemErrorKey}`;
                             Object.entries(itemErrors).forEach(([field, messages]: [string, any]) => {
                                 form.setError(`items.${index}.${field as keyof OrderInput['items'][0]}`, { message: messages?.[0] });
                             });
                         }
                     });
                 } else if (typeof value === 'object' && value !== null && '_errors' in value) {
                      // Handle top-level schema errors
                      form.setError(key as keyof OrderInput, { message: (value as any)._errors?.[0] });
                      if (!firstErrorField) firstErrorField = key;
                 } else if (typeof value === 'string') { // Handle direct string errors for fields
                      form.setError(key as keyof OrderInput, { message: value });
                      if (!firstErrorField) firstErrorField = key;
                 }
             });


             if (firstErrorField) {
                 try {
                      // Focus logic might need refinement depending on field structure
                      const fieldName = firstErrorField.includes('.') ? firstErrorField : firstErrorField;
                      console.log("Focusing attempt on:", fieldName);
                     setTimeout(() => {
                          const firstErrorElement = document.querySelector<HTMLElement>(`[aria-invalid="true"]`);
                          if (firstErrorElement) {
                              firstErrorElement.focus();
                          }
                     }, 100);
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
             description: result.message || "Failed to update order. Please try again.",
           });
        }
        setIsSubmitting(false);
      }
    } catch (error) {
       console.error("Order update error:", error);
       toast({
         variant: "destructive",
         title: "Submission Error",
         description: "An unexpected error occurred during update. Please try again.",
       });
       setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-6xl mx-auto shadow-md">
       <Form {...form}>
         <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
             <CardDescription>Update customer details and items for Order #{order.id.substring(0, 8)}...</CardDescription>
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
                            <FormLabel>Email *</FormLabel>
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
                        <FormItem>
                            <FormLabel>Address Line *</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., 123 Main St, Apt 4B" {...field} aria-invalid={!!form.formState.errors.customer?.address}/>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="customer.city"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>City *</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., Anytown" {...field} aria-invalid={!!form.formState.errors.customer?.city}/>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="customer.state"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>State *</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., CA" {...field} aria-invalid={!!form.formState.errors.customer?.state}/>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="customer.zipCode"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Zip Code *</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., 90210" {...field} aria-invalid={!!form.formState.errors.customer?.zipCode}/>
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
                        onClick={() => append({ itemId: "", name: "", sku: "", quantity: 1, price: 0, image: "" })}
                        disabled={isSubmitting}
                    >
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                    </Button>
                </div>

                {fields.map((field, index) => (
                    <div key={field.id} className="flex flex-col md:flex-row items-start md:items-center gap-4 border p-4 rounded-md relative">
                         {/* Item Image Thumbnail */}
                         <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-md overflow-hidden border bg-muted">
                             {(selectedItemDetails[index]?.imageUrl || form.getValues(`items.${index}.image`)) ? (
                              <Image
                                src={selectedItemDetails[index]?.imageUrl || form.getValues(`items.${index}.image`) || ''}
                                alt={selectedItemDetails[index]?.name || form.getValues(`items.${index}.name`) || 'Product Image'}
                                width={80}
                                height={80}
                                className="object-cover w-full h-full"
                                data-ai-hint={selectedItemDetails[index]?.name || selectedItemDetails[index]?.style || 'product item'}
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
                                    <FormLabel>Product *</FormLabel>
                                    <Select
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            handleItemChange(index, value);
                                        }}
                                        value={field.value} // Use value for controlled component
                                        disabled={isSubmitting}
                                    >
                                    <FormControl>
                                        <SelectTrigger aria-invalid={!!form.formState.errors.items?.[index]?.itemId}>
                                        <SelectValue placeholder="Select a product..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {inventoryItems.length > 0 ? inventoryItems.map((item) => (
                                        <SelectItem key={item.id} value={item.id} disabled={item.stock <= 0}>
                                            {item.name} ({item.sku}) - Stock: {item.stock <= 0 ? 'Out of Stock' : item.stock}
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
                                    <FormLabel>Quantity *</FormLabel>
                                    <FormControl>
                                    <Input
                                        type="number"
                                        min="1"
                                        // Consider original quantity + current stock for max in edit? Complex logic.
                                        // For simplicity, just using current stock. May need adjustment based on workflow.
                                        max={selectedItemDetails[index]?.stock ?? 1}
                                        {...field}
                                        onChange={e => {
                                            // Recalculate max based on current selection
                                            const maxStock = selectedItemDetails[index]?.stock ?? 1;
                                            let value = parseInt(e.target.value, 10) || 1;
                                            if (value > maxStock) value = maxStock;
                                            if (value < 1) value = 1;
                                            field.onChange(value);
                                        }}
                                        aria-invalid={!!form.formState.errors.items?.[index]?.quantity}
                                        disabled={isSubmitting || !selectedItemDetails[index] || selectedItemDetails[index]?.stock <= 0}
                                        />
                                    </FormControl>
                                     {selectedItemDetails[index] && field.value > selectedItemDetails[index]!.stock && (
                                        <p className="text-sm font-medium text-destructive">Cannot exceed available stock ({selectedItemDetails[index]!.stock}).</p>
                                     )}
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name={`items.${index}.price`}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unit Price (₹)</FormLabel>
                                    <FormControl>
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
                            {/* Line Total */}
                            <FormItem>
                                <FormLabel>Line Total</FormLabel>
                                <div className="h-10 flex items-center px-3 py-2 text-sm font-medium text-muted-foreground">
                                 ₹{(form.getValues(`items.${index}.price`) * form.getValues(`items.${index}.quantity`)).toFixed(2)}
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
                            disabled={isSubmitting || fields.length <= 1}
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
                                <FormLabel>Order Status *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                                <FormControl>
                                    <SelectTrigger aria-invalid={!!form.formState.errors.status}>
                                    <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                     {OrderStatusEnum.options.map(status => (
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
                                <FormLabel>Payment Status *</FormLabel>
                                {/* Use UPDATED enum values for Select */}
                                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                                <FormControl>
                                    <SelectTrigger aria-invalid={!!form.formState.errors.paymentStatus}>
                                    <SelectValue placeholder="Select payment status" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                     {PaymentStatusEnum.options.map(status => (
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
                                <Input placeholder="e.g., Standard Ground" {...field} value={field.value ?? ''} aria-invalid={!!form.formState.errors.shippingMethod} disabled={isSubmitting}/>
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
                    <p className="text-3xl font-bold text-primary text-right">₹{orderTotal.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground text-right">(Excludes tax/shipping for now)</p>
                 </div>
             </div>

           </CardContent>
           <Separator />
           <CardFooter className="flex justify-end space-x-3 p-6">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || items.length === 0 || items.some(item => !item.itemId)}>
                 {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Saving Changes..." : "Save Changes"}
              </Button>
            </CardFooter>
         </form>
        </Form>
    </Card>
  );
}
