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
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { addItemAction } from "@/app/inventory/actions";
import { AddItemSchema, type AddItemInput } from "@/schemas/inventory";
import { Loader2, Upload } from "lucide-react"; // Added Upload icon
import { Separator } from "@/components/ui/separator";

export function AddItemForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedFileName, setSelectedFileName] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
      imageUrl: "", // Will hold the data URL
      imageHint: "",
    },
  });

  // Function to read file as Data URL
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        setSelectedFileName(file.name);
        // Optionally set the imageHint based on filename
        if (!form.getValues('imageHint')) {
             form.setValue('imageHint', file.name.split('.').slice(0, -1).join('.').replace(/[^a-zA-Z0-9\s]/g, ' ').substring(0, 50));
        }
    } else {
        setSelectedFileName(null);
    }
  };

  async function onSubmit(values: AddItemInput) {
    setIsSubmitting(true);
    let dataUrl = "";

    // Read file if selected
    if (fileInputRef.current?.files?.[0]) {
      try {
        dataUrl = await readFileAsDataURL(fileInputRef.current.files[0]);
      } catch (error) {
        console.error("Error reading file:", error);
        toast({
          variant: "destructive",
          title: "File Read Error",
          description: "Could not read the selected image file.",
        });
        setIsSubmitting(false);
        return;
      }
    }

    // Create payload including the dataUrl
    const payload: AddItemInput = {
        ...values,
        imageUrl: dataUrl || undefined, // Use dataUrl or undefined if no file
    };

    try {
        // Make sure imageUrl is undefined if empty string after reading
        if (payload.imageUrl === "") {
            delete payload.imageUrl;
        }

      const result = await addItemAction(payload);

      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        router.push('/inventory');
        // No need to reset form here, redirect handles it.
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
             description: result.message || "Failed to add item. Please try again.",
           });
        }
        setIsSubmitting(false);
      }
    } catch (error) {
       console.error("Submission error:", error);
       toast({
         variant: "destructive",
         title: "Submission Error",
         description: "An unexpected error occurred. Please try again.",
       });
       setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-4xl mx-auto shadow-md">
      <CardHeader>
        <CardDescription>Fill in the details below to add a new item to your inventory catalog.</CardDescription>
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
                      <FormItem>
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
                           <Input placeholder="e.g., 2 weeks, 5-7 days" {...field} aria-invalid={!!form.formState.errors.leadTime} />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                </div>
            </div>

            {/* Media Section - Updated */}
             <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Media</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Hidden File Input */}
                    <input
                        type="file"
                        accept="image/*" // Accept only image files
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden" // Hide the default input
                        id="image-upload"
                    />
                     {/* Custom File Upload Button */}
                     <FormItem>
                        <FormLabel>Product Image (Optional)</FormLabel>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2"
                            aria-controls="image-upload"
                            disabled={isSubmitting}
                         >
                             <Upload className="h-4 w-4" />
                             {selectedFileName ? `Selected: ${selectedFileName}` : "Upload Image"}
                         </Button>
                         <FormDescription>
                            {selectedFileName ? `File: ${selectedFileName}` : "Click to select an image file from your computer."} Max 1MB recommended.
                         </FormDescription>
                         {/* Display file-related errors if needed */}
                         {/* <FormMessage /> */}
                     </FormItem>

                     <FormField
                     control={form.control}
                     name="imageHint"
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>Image Hint *</FormLabel>
                         <FormControl>
                           <Input placeholder="e.g., modern oak door, minimalist sofa" {...field} aria-invalid={!!form.formState.errors.imageHint} required/>
                         </FormControl>
                          <FormDescription>Keywords for AI search if no image uploaded.</FormDescription>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                </div>
            </div>

           </CardContent>
           <Separator />
           <CardFooter className="flex justify-end space-x-3 p-6">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
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