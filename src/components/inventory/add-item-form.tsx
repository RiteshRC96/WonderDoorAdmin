"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
      price: 0,
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
      const result = await addItemAction(values);

      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        // Redirect to the main inventory page after successful submission
        router.push('/inventory');
         // Optionally, redirect to the new item's detail page if ID is available
         // if (result.itemId) {
         //   router.push(`/inventory/${result.itemId}`);
         // } else {
         //   router.push('/inventory');
         // }
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.message || "Failed to add item.",
        });
         // Optionally display field-specific errors if provided by the action
         if (result.errors) {
           Object.entries(result.errors).forEach(([field, messages]) => {
             if (messages && messages.length > 0) {
               form.setError(field as keyof AddItemInput, {
                 type: 'manual',
                 message: messages[0], // Show the first error message for the field
               });
             }
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
                      <Input placeholder="e.g., Modern Oak Door" {...field} />
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
                      <Input placeholder="e.g., MOD-OAK-3680" {...field} />
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
                      <Input placeholder="e.g., Modern, Classic" {...field} />
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
                      <Input placeholder="e.g., Oak, Walnut, Fabric" {...field} />
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
                      <Input placeholder="e.g., 36x80 or 84x35x32" {...field} />
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
                      <Input placeholder="e.g., 55 lbs" {...field} />
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
                      <Input type="number" placeholder="0" {...field} />
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
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
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
                       <Input placeholder="e.g., 2 weeks" {...field} />
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
                       <Input type="url" placeholder="https://..." {...field} />
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
                       <Input placeholder="e.g., wood door" {...field} />
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