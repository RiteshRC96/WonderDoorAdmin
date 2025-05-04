
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
import { addItemAction } from "@/app/inventory/actions";
import { AddItemSchema, type AddItemInput } from "@/schemas/inventory"; // Use AddItemInput directly
import { Loader2 } from "lucide-react"; // Removed Upload, AlertCircle
import { Separator } from "@/components/ui/separator";

// Removed image validation constants

export function AddItemForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // Removed file-related state
  // const [selectedFileName, setSelectedFileName] = React.useState<string | null>(null);
  // const [imageDataUrl, setImageDataUrl] = React.useState<string | null>(null);
  // const [fileError, setFileError] = React.useState<string | null>(null);
  // const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<AddItemInput>({
    resolver: zodResolver(AddItemSchema),
    defaultValues: {
      name: "",
      sku: "",
      style: "",
      material: "",
      dimensions: "",
      weight: "",
      stock: 0,
      price: 0,
      leadTime: "",
      description: "",
      imageUrl: "", // Initialize imageUrl as empty string
      // imageHint is removed
    },
    mode: "onBlur",
  });

  // Removed file handling logic (readFileAsDataURL, handleFileChange)

  async function onSubmit(values: AddItemInput) {
    console.log("Form onSubmit triggered. Values:", values);
    // Removed fileError check

    // Trigger validation manually
    const isValid = await form.trigger();
    if (!isValid) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please check the highlighted fields.",
        });
        const firstErrorField = Object.keys(form.formState.errors)[0] as keyof AddItemInput | undefined;
        if (firstErrorField) {
            form.setFocus(firstErrorField);
        }
        return;
    }

    // Removed image hint check

    setIsSubmitting(true);
    console.log("Submitting form data...");

    // Payload is now just the validated form values
    const payload: AddItemInput = values;
    console.log("Payload being sent to action:", payload);


    try {
      console.log("Calling addItemAction...");
      const result = await addItemAction(payload);
      console.log("Action result:", result);

      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        router.push('/inventory');
        router.refresh();
      } else {
        if (result.errors) {
            console.error("Server validation errors:", result.errors);
            let firstErrorField: keyof AddItemInput | null = null;
            Object.entries(result.errors).forEach(([field, messages]) => {
                const fieldName = field as keyof AddItemInput;
                if (fieldName in form.getValues()) {
                    form.setError(fieldName, { type: 'server', message: messages?.[0] || "Server validation failed" });
                    if (!firstErrorField) firstErrorField = fieldName;
                } else {
                    console.warn(`Received server error for non-form field or unmapped field: ${field}`);
                     toast({
                        variant: "destructive",
                        title: `Server Error (${field})`,
                        description: messages?.join(', ') || result.message || "An unexpected server error occurred.",
                     });
                }
            });

             const generalErrorMessage = result.message || "Please check the form fields for errors.";
             toast({
                 variant: "destructive",
                 title: "Submission Failed",
                 description: generalErrorMessage,
             });

            if (firstErrorField) {
                form.setFocus(firstErrorField);
            }

        } else {
            console.error("Server error without specific field errors:", result.message);
            toast({
                variant: "destructive",
                title: "Error",
                description: result.message || "Failed to add item. Please try again.",
            });
        }
      }
    } catch (error) {
       console.error("Submission error caught in component:", error);
       toast({
         variant: "destructive",
         title: "Submission Error",
         description: "An unexpected client-side error occurred. Please try again.",
       });
    } finally {
        console.log("Setting isSubmitting to false.");
        setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-4xl mx-auto shadow-md">
      <CardHeader>
        <CardDescription>Fill in the details below to add a new item to your inventory catalog. Fields marked with * are required.</CardDescription>
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
                            placeholder="Provide a brief description of the item, its features, and selling points..."
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
                          <Input placeholder="e.g., 36 W x 80 H or 84 L x 35 W x 32 H" {...field} aria-invalid={!!form.formState.errors.dimensions} />
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
                          <Input placeholder="e.g., 55 lbs or 25 kg" {...field} aria-invalid={!!form.formState.errors.weight} />
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
                          <Input type="number" placeholder="0" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} aria-invalid={!!form.formState.errors.stock}/>
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
                          <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} aria-invalid={!!form.formState.errors.price}/>
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
                           <Input placeholder="e.g., 2 weeks, 5-7 days" {...field} aria-invalid={!!form.formState.errors.leadTime} />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                </div>
            </div>

            {/* Media Section - Simplified */}
             <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Media</h3>
                 <FormField
                     control={form.control}
                     name="imageUrl"
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>Image URL (Optional)</FormLabel>
                         <FormControl>
                           {/* Use type="url" for basic browser validation */}
                           <Input type="url" placeholder="https://your-image-host.com/image.jpg or Google Drive share link" {...field} aria-invalid={!!form.formState.errors.imageUrl} />
                         </FormControl>
                          <FormDescription>Enter the full URL of the product image (e.g., from Google Drive - ensure link sharing is enabled).</FormDescription>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 {/* Removed file input and image hint input */}
                 {/* Removed image preview based on data URL */}
            </div>

           </CardContent>
           <Separator />
           <CardFooter className="flex justify-end space-x-3 p-6">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
              {/* Removed fileError check from disabled condition */}
              <Button type="submit" disabled={isSubmitting}>
                 {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Saving Item..." : "Save Item"}
              </Button>
            </CardFooter>
         </form>
        </Form>
    </Card>
  );
}
