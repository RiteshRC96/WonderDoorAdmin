
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
// Import the enums along with the types/schema
import { OrderSchema, type CreateOrderInput, type OrderInput, OrderStatusEnum, PaymentStatusEnum } from "@/schemas/order";
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
  imageUrl?: string; // Keep explicit
  name: string; // Ensure required fields
  sku: string;
  stock: number;
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
        city: "",
        state: "",
        zipCode: "",
      },
      items: [{ itemId: "", name: "", sku: "", quantity: 1, price: 0, image: "" }],
      status: "Processing", // Default status from enum
      paymentStatus: "Pending", // Default payment status from enum
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
      form.trigger(`items.${index}.price`);
      form.setValue(`items.${index}.image`, selectedItem.imageUrl || '');
      setSelectedItemDetails(prev => ({ ...prev, [index]: selectedItem }));
      // Clear item-specific error if selection is now valid
      form.clearErrors(`items.${index}.itemId`);
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

      } else {
        if (result.errors) {
           let firstErrorField: keyof OrderInput | string | null = null;
           // Improved error mapping logic
            Object.entries(result.errors).forEach(([key, value]) => {
                if (key === 'customer' && typeof value === 'object' && value !== null) {
                    const customerErrorKey = Object.keys(value)[0];
                    if (customerErrorKey) firstErrorField = `customer.${customerErrorKey}`;
                    Object.entries(value).forEach(([field, messages]: [string, any]) => {
                        form.setError(`customer.${field as keyof CreateOrderInput['customer']}`, { message: messages?.[0] });
                    });
                } else if (key === 'items' && typeof value === 'object' && value !== null) { // Handle object for items error
                    Object.keys(value).forEach(indexKey => { // Iterate through index keys like "0.itemId"
                        const parts = indexKey.split('.');
                        if (parts.length === 2) {
                            const index = parseInt(parts[0], 10);
                            const field = parts[1] as keyof CreateOrderInput['items'][0];
                            const messages = value[indexKey];
                            if (!isNaN(index) && field && Array.isArray(messages)) {
                                form.setError(`items.${index}.${field}`, { message: messages[0] });
                                if (!firstErrorField) firstErrorField = `items.${index}.${field}`;
                            }
                        }
                    });
                } else if (typeof value === 'object' && value !== null && '_errors' in value) {
                    // Handle top-level schema errors
                    form.setError(key as keyof CreateOrderInput, { message: (value as any)._errors?.[0] });
                    if (!firstErrorField) firstErrorField = key;
                } else if (typeof value === 'string') { // Handle direct string errors for fields
                     form.setError(key as keyof CreateOrderInput, { message: value });
                     if (!firstErrorField) firstErrorField = key;
                }
            });


           if (firstErrorField) {
             try {
                 // Focus logic might need refinement depending on field structure
                 const fieldName = firstErrorField.includes('.') ? firstErrorField : firstErrorField;
                 // form.setFocus(fieldName as any); // This might fail for nested array fields
                 // Fallback focus or general error display might be better
                 console.log("Focusing attempt on:", fieldName);
                 setTimeout(() => {
                      const firstErrorElement = document.querySelector<HTMLElement>(`[aria-invalid="true"]`);
                      if (firstErrorElement) {
                          firstErrorElement.focus();
                      }
                 }, 100);
             } catch (e) { console.warn("Could not set focus on error field", e); }
           }

          // Show specific item-not-found error if that was the cause
          if (result.message && result.message.includes("Inventory item") && result.message.includes("not found")) {
              toast({
                  variant: "destructive",
                  title: "Item Not Found",
                  description: result.message,
              });
          } else {
             toast({
                 variant: "destructive",
                 title: "Validation Error",
                 description: result.message || "Please check the form fields.",
             });
          }
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
                                alt={selectedItemDetails[index]?.name ?? 'Product Image'}
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
                                        max={selectedItemDetails[index]?.stock ?? 1} // Set max based on stock
                                        {...field}
                                        onChange={e => {
                                            const maxStock = selectedItemDetails[index]?.stock ?? 1;
                                            let value = parseInt(e.target.value, 10) || 1;
                                            if (value > maxStock) value = maxStock; // Cap at max stock
                                            if (value < 1) value = 1; // Ensure minimum 1
                                            field.onChange(value);
                                        }}
                                        aria-invalid={!!form.formState.errors.items?.[index]?.quantity}
                                        disabled={isSubmitting || !selectedItemDetails[index] || selectedItemDetails[index]?.stock <= 0} // Disable if no item selected or out of stock
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
                                        readOnly
                                        {...field}
                                        value={field.value || 0}
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
                                {/* Use enum values for Select */}
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
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
                                {/* Use enum values for Select */}
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
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
                {isSubmitting ? "Creating Order..." : "Create Order"}
              </Button>
            </CardFooter>
         </form>
        </Form>
    </Card>
  );
}
