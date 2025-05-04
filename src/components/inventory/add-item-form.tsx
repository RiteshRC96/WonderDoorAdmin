
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
import { AddItemSchema, type AddItemInput, type AddItemPayload } from "@/schemas/inventory"; // Import AddItemPayload
import { Loader2, Upload, AlertCircle } from "lucide-react"; // Added AlertCircle
import { Separator } from "@/components/ui/separator";

// Define allowed image types and max size (e.g., 5MB)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export function AddItemForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedFileName, setSelectedFileName] = React.useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = React.useState<string | null>(null); // Store Data URL here
  const [fileError, setFileError] = React.useState<string | null>(null);
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
      imageUrl: "", // Will hold the FINAL download URL from Storage, cleared initially
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFileError(null); // Clear previous errors
    setSelectedFileName(null);
    setImageDataUrl(null); // Clear previous data URL

    if (file) {
      // Validate file type
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          setFileError(`Invalid file type. Please select a PNG, JPG, or JPEG image.`);
          toast({ variant: "destructive", title: "Invalid File Type", description: "Please select a PNG, JPG, or JPEG image." });
          if (fileInputRef.current) fileInputRef.current.value = ""; // Clear the input
          return;
      }

      // Validate file size
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
          setFileError(`File is too large (max ${MAX_IMAGE_SIZE_MB}MB).`);
          toast({ variant: "destructive", title: "File Too Large", description: `Please select an image smaller than ${MAX_IMAGE_SIZE_MB}MB.` });
          if (fileInputRef.current) fileInputRef.current.value = ""; // Clear the input
          return;
      }

      // If valid, set name and read data URL
      setSelectedFileName(file.name);
      if (!form.getValues('imageHint')) {
           form.setValue('imageHint', file.name.split('.').slice(0, -1).join('.').replace(/[^a-zA-Z0-9\s]/g, ' ').substring(0, 50));
      }
      try {
          const dataUrl = await readFileAsDataURL(file);
          setImageDataUrl(dataUrl); // Store data URL in state temporarily
      } catch (error) {
          console.error("Error reading file:", error);
          setFileError("Could not read the selected image file.");
          toast({ variant: "destructive", title: "File Read Error", description: "Could not read the selected image file." });
          if (fileInputRef.current) fileInputRef.current.value = ""; // Clear the input
      }

    }
  };

  async function onSubmit(values: AddItemInput) {
    if (fileError) {
         toast({ variant: "destructive", title: "Image Error", description: "Please fix the image selection error before saving." });
         return;
    }
    setIsSubmitting(true);

    // Create payload, including the image Data URL IF it exists
    const payload: AddItemPayload = { // Use AddItemPayload type which includes imageDataUrl
        ...values,
        // Pass the Data URL separately for the action to handle
        imageDataUrl: imageDataUrl || undefined,
        imageUrl: undefined, // Ensure imageUrl (for final URL) is not submitted from form
    };
     // Remove the property if undefined
     if (!payload.imageDataUrl) {
         delete payload.imageDataUrl;
     }


    try {
      // The action now handles the upload and gets the final URL
      const result = await addItemAction(payload);

      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        router.push('/inventory');
        // No need to reset form here, redirect handles it.
      } else {
        // Handle validation or other errors from the server action
        if (result.errors) {
            let firstErrorField: keyof AddItemInput | null = null;
            Object.entries(result.errors).forEach(([field, messages]) => {
                const fieldName = field as keyof AddItemInput;
                if (fieldName in form.getValues() && messages && messages.length > 0) {
                    form.setError(fieldName, { type: 'manual', message: messages[0] });
                    if (!firstErrorField) firstErrorField = fieldName;
                } else {
                    console.warn(`Received server error for non-form field: ${field}`);
                     // Display general error if field mapping fails
                     if(!toast.isActive('general-server-error')){
                        toast({
                          id: 'general-server-error',
                          variant: "destructive",
                          title: "Server Error",
                          description: result.message || "An unexpected server error occurred.",
                       });
                     }
                }
            });
            if (firstErrorField) {
                 setTimeout(() => {
                      const firstErrorElement = document.querySelector<HTMLElement>(`[aria-invalid="true"]`);
                      if (firstErrorElement) firstErrorElement.focus();
                 }, 0);
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
                    {/* File Input */}
                     <FormItem>
                        <FormLabel>Product Image (Optional, Max {MAX_IMAGE_SIZE_MB}MB)</FormLabel>
                         <FormControl>
                            <Input
                                type="file"
                                accept={ALLOWED_IMAGE_TYPES.join(',')} // Only allow specific image types
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" // Basic styling
                                id="image-upload"
                                aria-describedby="image-file-description"
                                aria-invalid={!!fileError}
                                disabled={isSubmitting}
                            />
                         </FormControl>
                         <FormDescription id="image-file-description">
                            {selectedFileName ? `Selected: ${selectedFileName}` : "Upload a PNG, JPG, or JPEG file."}
                         </FormDescription>
                         {/* Display file validation error */}
                         {fileError && (
                            <p className="text-sm font-medium text-destructive flex items-center gap-1">
                                <AlertCircle className="h-4 w-4" /> {fileError}
                            </p>
                         )}
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
                 {/* Image Preview */}
                 {imageDataUrl && (
                     <div className="mt-4">
                         <FormLabel>Image Preview</FormLabel>
                         <div className="mt-2 p-2 border rounded-md inline-block">
                             <img src={imageDataUrl} alt="Preview" className="max-h-40 max-w-full rounded" />
                         </div>
                     </div>
                 )}
            </div>

           </CardContent>
           <Separator />
           <CardFooter className="flex justify-end space-x-3 p-6">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !!fileError}>
                 {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Saving Item..." : "Save Item"}
              </Button>
            </CardFooter>
         </form>
        </Form>
    </Card>
  );
}

