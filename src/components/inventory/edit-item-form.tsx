
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

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
import { Card, CardContent, CardHeader, CardDescription, CardFooter } from "@/components/ui/card"; // Removed CardTitle
import { useToast } from "@/hooks/use-toast";
import { updateItemAction } from "@/app/inventory/actions"; // Import update action
import { AddItemSchema, type AddItemInput } from "@/schemas/inventory";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

// Define the structure of an inventory item as passed from the edit page
interface InventoryItem extends AddItemInput {
  id: string;
  createdAt?: string; // Expect ISO string from server component
}

interface EditItemFormProps {
  item: InventoryItem; // Receive the full item data
}

export function EditItemForm({ item }: EditItemFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Initialize the form with the existing item data
  const form = useForm<AddItemInput>({
    resolver: zodResolver(AddItemSchema),
    defaultValues: {
      name: item.name || "",
      sku: item.sku || "",
      style: item.style || "",
      material: item.material || "",
      dimensions: item.dimensions || "",
      weight: item.weight || "",
      stock: item.stock ?? 0,
      price: item.price ?? 0,
      leadTime: item.leadTime || "",
      description: item.description || "",
      imageUrl: item.imageUrl || "",
      // imageHint is removed from schema and form
    },
  });

  async function onSubmit(values: AddItemInput) {
    setIsSubmitting(true);
    try {
      const result = await updateItemAction(item.id, values);

      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        router.push(`/inventory/${item.id}`);
        router.refresh();

      } else {
        if (result.errors) {
          let firstErrorField: keyof AddItemInput | null = null;
          Object.entries(result.errors).forEach(([field, messages]) => {
             if (field in form.getValues() && messages && messages.length > 0) {
                form.setError(field as keyof AddItemInput, {
                  type: 'manual',
                  message: messages[0],
                });
                if (!firstErrorField) {
                   firstErrorField = field as keyof AddItemInput;
                 }
             } else {
                 console.warn(`Received error for non-existent field: ${field}`);
             }
          });
            if (firstErrorField) {
                 setTimeout(() => {
                      const firstErrorElement = document.querySelector<HTMLElement>(`[aria-invalid="true"]`);
                      if (firstErrorElement) {
                          firstErrorElement.focus();
                      }
                 }, 0);
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
             description: result.message || "Failed to update item. Please try again.",
           });
        }
      }
    } catch (error) {
       console.error("Submission error:", error);
       toast({
         variant: "destructive",
         title: "Submission Error",
         description: "An unexpected error occurred. Please try again.",
       });
    } finally {
       setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-4xl mx-auto shadow-md">
      <CardHeader>
        <CardDescription>Update the details for item "{item.name}". Fields marked with * are required.</CardDescription>
      </CardHeader>
       <Form {...form}>
         <form onSubmit={form.handleSubmit(onSubmit)}>
           <CardContent className="space-y-8">

             {/* Basic Information Section */}
             <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Modern Oak Door" {...field} aria-invalid={!!form.formState.errors.name} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem title="Stock Keeping Unit: A unique identifier for each distinct product and service that can be purchased.">
                        <FormLabel>SKU *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., MOD-OAK-3680" {...field} aria-invalid={!!form.formState.errors.sku} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="style"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Style *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Modern, Classic" {...field} aria-invalid={!!form.formState.errors.style} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="material"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Material *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Oak, Walnut, Fabric" {...field} aria-invalid={!!form.formState.errors.material} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Provide a brief description of the item..."
                            className="resize-y min-h-[100px]"
                            {...field}
                            aria-invalid={!!form.formState.errors.description}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
            </div>

            {/* Specifications Section */}
             <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Specifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="dimensions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dimensions *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 36 W x 80 H" {...field} aria-invalid={!!form.formState.errors.dimensions} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 55 lbs" {...field} aria-invalid={!!form.formState.errors.weight} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
             </div>

            {/* Inventory & Pricing Section */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Inventory & Pricing</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock Quantity *</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} aria-invalid={!!form.formState.errors.stock}/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price ($) *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} aria-invalid={!!form.formState.errors.price}/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                    <FormField
                     control={form.control}
                     name="leadTime"
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>Lead Time (Optional)</FormLabel>
                         <FormControl>
                           <Input placeholder="e.g., 2 weeks" {...field} aria-invalid={!!form.formState.errors.leadTime} />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                </div>
            </div>

            {/* Media Section */}
             <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Media</h3>
                <FormField
                     control={form.control}
                     name="imageUrl"
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>Image URL (Optional)</FormLabel>
                         <FormControl>
                           <Input type="url" placeholder="https://..." {...field} value={field.value ?? ''} aria-invalid={!!form.formState.errors.imageUrl} />
                         </FormControl>
                         <FormDescription>Enter the full URL of the main product image (e.g., from Google Drive - ensure link sharing is enabled).</FormDescription>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 {/* Removed imageHint field */}
            </div>

           </CardContent>
           <Separator />
           <CardFooter className="flex justify-end space-x-3 p-6">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                 {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Saving Changes..." : "Save Changes"}
              </Button>
            </CardFooter>
         </form>
        </Form>
    </Card>
  );
}
