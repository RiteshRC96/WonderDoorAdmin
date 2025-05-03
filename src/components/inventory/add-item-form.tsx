"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { FieldElement } from "react-hook-form"; // Import FieldElement type
import { z } from "zod";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { addItemAction, AddItemSchema, AddItemInput } from "@/app/inventory/actions";
import { Loader2 } from "lucide-react";

export function AddItemForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<AddItemInput>({
    resolver: zodResolver(AddItemSchema),
    defaultValues: {
      name: "",
      style: "",
      material: "",
      dimensions: "",
      stock: 0,
      price: 0, // Ensure default price is a number
      description: "",
      sku: "",
      weight: "",
      leadTime: "",
      imageUrl: "",
      imageHint: "",
    },
  });

  async function onSubmit(values: AddItemInput) {
    setIsSubmitting(true);
    try {
      // The action now expects imageUrl to be string | undefined
      const result = await addItemAction(values);

      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        // Redirect to the main inventory page after successful submission
        // Note: The new item won't appear because the inventory list is static.
        router.push('/inventory');
        // Optionally clear the form after success
        // form.reset();

      } else {
        // Handle validation errors returned from the server action
        if (result.errors) {
          let firstErrorField: keyof AddItemInput | null = null;
          Object.entries(result.errors).forEach(([field, messages]) => {
             // Ensure the field exists in the form before setting an error
             if (field in form.getValues() && messages && messages.length > 0) {
                form.setError(field as keyof AddItemInput, {
                  type: 'manual',
                  message: messages[0], // Show the first error message
                });
                if (!firstErrorField) {
                   firstErrorField = field as keyof AddItemInput;
                 }
             } else {
                 console.warn(`Received error for non-existent field: ${field}`);
             }
          });
            // Focus the first field with an error
            if (firstErrorField) {
                // Need to access the actual DOM element via ref if possible,
                // otherwise rely on field name for focus (might not work perfectly depending on setup)
                // For ShadCN/react-hook-form, direct focus might require refs on inputs or a helper.
                 // Attempting direct focus (may need adjustment based on actual component refs)
                 const fieldElement = form.control.getFieldState(firstErrorField).isDirty // Check if field state exists
                 ? document.querySelector<FieldElement>(`[name="${firstErrorField}"]`)
                 : null;

                 // Wait for the next tick to ensure the DOM has updated with errors
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
           // General failure message
           toast({
             variant: "destructive",
             title: "Error",
             description: result.message || "Failed to add item. Please try again.",
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
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Add New Inventory Item</CardTitle>
        <CardDescription>Fill in the details for the new item.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
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
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
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
                    <FormLabel>Style</FormLabel>
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
                    <FormLabel>Material</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Oak, Walnut, Fabric" {...field} aria-invalid={!!form.formState.errors.material} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dimensions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dimensions</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 36x80 or 84x35x32" {...field} aria-invalid={!!form.formState.errors.dimensions} />
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
               <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Quantity</FormLabel>
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
                    <FormLabel>Price ($)</FormLabel>
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
                <FormField
                 control={form.control}
                 name="imageUrl"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel>Image URL (Optional)</FormLabel>
                     <FormControl>
                       <Input type="url" placeholder="https://..." {...field} aria-invalid={!!form.formState.errors.imageUrl} />
                     </FormControl>
                     <FormDescription>Enter the full URL of the product image.</FormDescription>
                     <FormMessage />
                   </FormItem>
                 )}
               />
                 <FormField
                 control={form.control}
                 name="imageHint"
                 render={({ field }) => (
                   <FormItem className="md:col-span-2">
                     <FormLabel>Image Hint (Optional)</FormLabel>
                     <FormControl>
                       <Input placeholder="e.g., wood door" {...field} aria-invalid={!!form.formState.errors.imageHint} />
                     </FormControl>
                      <FormDescription>Keywords for AI image search (if URL not provided).</FormDescription>
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

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                 {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Adding..." : "Add Item"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
