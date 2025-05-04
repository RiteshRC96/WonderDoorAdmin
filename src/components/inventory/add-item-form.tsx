
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
      // imageUrl is handled by the server action, don't set default here
      // imageHint is required by schema, default can be empty string
      imageHint: "",
    },
    // Trigger validation on blur and change for better UX
    mode: "onBlur",
  });

  // Function to read file as Data URL
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error); // Pass the error object
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFileError(null); // Clear previous errors
    setSelectedFileName(null);
    setImageDataUrl(null); // Clear previous data URL
     // Also clear the imageHint when a new file is selected, unless user specifically typed one
     const currentHint = form.getValues('imageHint');
     const wasAutoFilled = selectedFileName && currentHint === selectedFileName.split('.').slice(0, -1).join('.').replace(/[^a-zA-Z0-9\s]/g, ' ').substring(0, 50);
     if (wasAutoFilled) {
         form.setValue('imageHint', ''); // Clear auto-filled hint
         // No need to trigger here, auto-filling shouldn't cause validation errors
     }


    if (file) {
      // Validate file type
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          const errorMsg = `Invalid file type. Please select a PNG, JPG, or JPEG image.`;
          setFileError(errorMsg);
          toast({ variant: "destructive", title: "Invalid File Type", description: errorMsg });
          if (fileInputRef.current) fileInputRef.current.value = ""; // Clear the input
          return;
      }

      // Validate file size
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
          const errorMsg = `File is too large (max ${MAX_IMAGE_SIZE_MB}MB).`;
          setFileError(errorMsg);
          toast({ variant: "destructive", title: "File Too Large", description: errorMsg });
          if (fileInputRef.current) fileInputRef.current.value = ""; // Clear the input
          return;
      }

      // If valid, set name and read data URL
      setSelectedFileName(file.name);
       // Auto-populate imageHint if it's empty
       if (!form.getValues('imageHint')) {
            // Basic auto-hint based on filename, limited length
            const autoHint = file.name.split('.').slice(0, -1).join('.').replace(/[^a-zA-Z0-9\s]/g, ' ').substring(0, 50);
            form.setValue('imageHint', autoHint, { shouldValidate: true }); // Validate after setting hint
       }

      try {
          console.log("Reading file as Data URL...");
          const dataUrl = await readFileAsDataURL(file);
          console.log("Data URL read successfully (first 100 chars):", dataUrl.substring(0, 100));
          setImageDataUrl(dataUrl); // Store data URL in state temporarily
          // Clear imageHint error if an image is successfully loaded
          form.clearErrors('imageHint');
      } catch (error) {
          console.error("Error reading file:", error);
          const errorMsg = "Could not read the selected image file. It might be corrupted or unreadable.";
          setFileError(errorMsg);
          toast({ variant: "destructive", title: "File Read Error", description: errorMsg });
          if (fileInputRef.current) fileInputRef.current.value = ""; // Clear the input
          setSelectedFileName(null); // Clear selected file name on error
      }

    }
  };

  async function onSubmit(values: AddItemInput) {
    console.log("Form onSubmit triggered. Values:", values);
    if (fileError) {
         toast({ variant: "destructive", title: "Image Error", description: "Please fix the image selection error before saving." });
         return;
    }

    // Trigger validation manually to ensure all fields are checked before submitting
    const isValid = await form.trigger();
    if (!isValid) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please check the highlighted fields.",
        });
        // Try to focus the first invalid field
        const firstErrorField = Object.keys(form.formState.errors)[0] as keyof AddItemInput | undefined;
        if (firstErrorField) {
            form.setFocus(firstErrorField);
        }
        return; // Stop submission if validation fails
    }

    // Ensure image hint is provided if no image is being uploaded - schema should handle this now, but double-check
    if (!imageDataUrl && !values.imageHint) {
        form.setError('imageHint', { type: 'manual', message: 'Image hint is required if no image is uploaded.' });
        toast({ variant: "destructive", title: "Missing Information", description: "Please provide an image hint if you are not uploading an image." });
         form.setFocus('imageHint');
        return; // Stop submission
    }


    setIsSubmitting(true);
    console.log("Submitting form data...");

    // Create payload, including the image Data URL IF it exists
    // Exclude imageUrl from the payload sent to the action, as it's set server-side
    const { imageUrl, ...formValuesToSend } = values;
    const payload: AddItemPayload = {
        ...formValuesToSend,
        imageDataUrl: imageDataUrl || undefined, // Pass the Data URL if it exists
    };
    console.log("Payload being sent to action:", { ...payload, imageDataUrl: payload.imageDataUrl ? payload.imageDataUrl.substring(0, 100) + '...' : 'None' });


    try {
      console.log("Calling addItemAction...");
      const result = await addItemAction(payload);
      console.log("Action result:", result);

      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        router.push('/inventory'); // Redirect on success
        router.refresh(); // Refresh the inventory page data
      } else {
        // Handle validation or other errors from the server action
        if (result.errors) {
            console.error("Server validation errors:", result.errors); // Log the error object
            let firstErrorField: keyof AddItemInput | null = null;
            Object.entries(result.errors).forEach(([field, messages]) => {
                const fieldName = field as keyof AddItemInput;
                // Check if the field exists in the form before setting error
                if (fieldName in form.getValues()) {
                    form.setError(fieldName, { type: 'server', message: messages?.[0] || "Server validation failed" });
                    if (!firstErrorField) firstErrorField = fieldName;
                } else {
                    console.warn(`Received server error for non-form field or unmapped field: ${field}`);
                    // Show general error for unmapped fields
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

            // Focus the first field with a server error
            if (firstErrorField) {
                form.setFocus(firstErrorField);
            }

        } else {
            // General error message if no specific errors object
            console.error("Server error without specific field errors:", result.message);
            toast({
                variant: "destructive",
                title: "Error",
                description: result.message || "Failed to add item. Please try again.",
            });
        }
      }
    } catch (error) {
       console.error("Submission error caught in component:", error); // Log the actual error
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
                          {/* Ensure value is handled correctly for controlled number input */}
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
                          {/* Ensure value is handled correctly for controlled number input */}
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
                                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer" // Added cursor-pointer
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
                         {/* Label required asterisk logic */}
                         <FormLabel>
                            Image Hint *
                            {!imageDataUrl && <span className="text-destructive ml-1">(Required if no image uploaded)</span>}
                          </FormLabel>
                         <FormControl>
                           <Input placeholder="e.g., modern oak door, minimalist sofa" {...field} aria-invalid={!!form.formState.errors.imageHint} required={!imageDataUrl} aria-required={!imageDataUrl}/>
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
                         <div className="mt-2 p-2 border rounded-md inline-block max-w-xs">
                             <img src={imageDataUrl} alt="Preview" className="max-h-40 w-auto rounded" />
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


    