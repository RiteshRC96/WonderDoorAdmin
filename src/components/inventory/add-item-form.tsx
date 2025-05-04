"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Card, CardContent, CardHeader, CardDescription, CardFooter } from "@/components/ui/card"; // Removed CardTitle
import { useToast } from "@/hooks/use-toast";
import { addItemAction } from "@/app/inventory/actions";
import { AddItemSchema, type AddItemInput } from "@/schemas/inventory"; // Use AddItemInput directly
import { Loader2, Upload, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle } from "@/components/ui/alert";

export function AddItemForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedFileName, setSelectedFileName] = React.useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = React.useState<string | null>(null); // Store image data URL
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
      imageUrl: "", // Keep imageUrl for potential URL input
      // imageHint removed
    },
    mode: "onBlur",
  });

  // Read file as Data URL
  const readFileAsDataURL = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          resolve(event.target.result);
        } else {
          reject(new Error('Failed to read file as Data URL.'));
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFileError(null); // Clear previous errors
    setSelectedFileName(null);
    setImageDataUrl(null); // Clear previous image data
    form.setValue('imageUrl', ''); // Clear URL field if file is chosen

    if (file) {
      // Validation
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      const maxSize = 5 * 1024 * 1024; // 5 MB

      if (!allowedTypes.includes(file.type)) {
        setFileError('Invalid file type. Please upload a PNG, JPG, or JPEG image.');
        return;
      }
      if (file.size > maxSize) {
        setFileError('File size exceeds 5MB. Please upload a smaller image.');
        return;
      }

      // Read file and set state
      try {
        const dataUrl = await readFileAsDataURL(file);
        setImageDataUrl(dataUrl);
        setSelectedFileName(file.name);
        console.log("File read successfully, Data URL set.");
      } catch (error) {
        console.error("Error reading file:", error);
        setFileError('Failed to read the selected file.');
      }
    }
  };

  // Handle URL change - clear file selection if URL is entered
  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const url = event.target.value;
    form.setValue('imageUrl', url); // Update form value
    if (url && fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear the file input
      setSelectedFileName(null);
      setImageDataUrl(null);
      setFileError(null);
    }
  };


  async function onSubmit(values: AddItemInput) {
    console.log("Form onSubmit triggered. Values:", values);

    // Trigger validation manually
    const isValid = await form.trigger();
    if (!isValid) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please check the highlighted fields.",
        });
        // Focus on the first error field
        const firstErrorField = Object.keys(form.formState.errors)[0] as keyof AddItemInput | undefined;
        if (firstErrorField) {
            form.setFocus(firstErrorField);
        }
        return;
    }

    // Additional check: Ensure either URL or file data is present if desired
    // This logic might be adjusted based on whether an image is strictly required
    // if (!values.imageUrl && !imageDataUrl) {
    //     toast({
    //         variant: "destructive",
    //         title: "Image Required",
    //         description: "Please provide an image URL or upload an image file.",
    //     });
    //     return;
    // }

    setIsSubmitting(true);
    console.log("Submitting form data...");

    // Create payload, including the image Data URL IF it exists
    const payload: AddItemInput & { imageDataUrl?: string } = {
        ...values,
        // Pass the Data URL separately for the action to handle
        imageDataUrl: imageDataUrl || undefined,
    };
    // If imageUrl is provided, make sure imageDataUrl is not sent (action prioritizes dataUrl)
    if (values.imageUrl) {
        delete payload.imageDataUrl;
    }

    console.log("Payload being sent to action (keys):", Object.keys(payload));


    try {
      console.log("Calling addItemAction...");
      const result = await addItemAction(payload); // Pass payload with potential imageDataUrl
      console.log("Action result:", result);

      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        router.push('/inventory');
        router.refresh(); // Ensure the page reloads data
      } else {
        // Handle validation or other errors from the server action
        if (result.errors) {
            console.error("Server validation errors:", result.errors); // Log the error object
            let firstErrorField: keyof AddItemInput | null = null;
            Object.entries(result.errors).forEach(([field, messages]) => {
                const fieldName = field as keyof AddItemInput;
                if (fieldName in form.getValues()) {
                    form.setError(fieldName, { type: 'server', message: messages?.[0] || "Server validation failed" });
                    if (!firstErrorField) firstErrorField = fieldName;
                } else {
                    // Handle errors not directly mapped to form fields (e.g., general server error)
                    console.warn(`Received server error for non-form field or unmapped field: ${field}`);
                    // Display a general error toast for unmapped fields
                     toast({
                        variant: "destructive",
                        title: `Server Error (${field})`,
                        description: messages?.join(', ') || result.message || "An unexpected server error occurred.",
                     });
                }
            });

            // General toast message for validation errors
             const generalErrorMessage = result.message || "Please check the form fields for errors.";
             toast({
                 variant: "destructive",
                 title: "Submission Failed",
                 description: generalErrorMessage,
             });

            // Focus on the first specific field error if available
            if (firstErrorField) {
                form.setFocus(firstErrorField);
            }

        } else {
             // Handle server errors that don't have specific field details
            console.error("Server error without specific field errors:", result.message);
            toast({
                variant: "destructive",
                title: "Error",
                description: result.message || "Failed to add item. Please try again.",
            });
        }
         setIsSubmitting(false); // Keep submitting false on error
      }
    } catch (error) {
       // Handle unexpected client-side errors during submission
       console.error("Submission error caught in component:", error);
       toast({
         variant: "destructive",
         title: "Submission Error",
         description: "An unexpected client-side error occurred. Please try again.",
       });
        setIsSubmitting(false); // Ensure submission state is reset
    }
    // No finally block needed here, handled in success/error cases
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
                        <FormLabel>Price (₹) *</FormLabel>
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

             {/* Media Section - URL Input or File Upload */}
             <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Media (Optional)</h3>
                 <p className="text-sm text-muted-foreground">Provide an image URL OR upload an image file.</p>
                 <FormField
                     control={form.control}
                     name="imageUrl"
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>Image URL</FormLabel>
                         <FormControl>
                           <Input
                                type="url"
                                placeholder="https://drive.google.com/... or https://picsum.photos/..."
                                {...field}
                                value={field.value || ''} // Ensure controlled component
                                onChange={handleUrlChange} // Use custom handler
                                aria-invalid={!!form.formState.errors.imageUrl}
                           />
                         </FormControl>
                         <FormDescription>Enter the full URL of the product image (e.g., from Google Drive, Picsum, Unsplash - ensure public accessibility).</FormDescription>
                         <FormMessage />
                       </FormItem>
                     )}
                   />

                  {/* File Upload Input */}
                  <div className="space-y-2">
                      <FormLabel htmlFor="image-upload">Or Upload Image (PNG, JPG, JPEG - Max 5MB)</FormLabel>
                      <div className="flex items-center gap-3">
                          <FormControl>
                              <Input
                                  id="image-upload"
                                  type="file"
                                  ref={fileInputRef} // Assign ref
                                  accept=".png, .jpg, .jpeg"
                                  onChange={handleFileChange}
                                  className="flex-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                  disabled={isSubmitting}
                               />
                          </FormControl>
                           {/* Removed clear button, clearing handled by URL change */}
                      </div>
                       {selectedFileName && !fileError && (
                           <p className="text-sm text-muted-foreground">Selected file: {selectedFileName}</p>
                       )}
                      {fileError && (
                          <Alert variant="destructive" className="mt-2">
                              <AlertCircle className="h-4 w-4"/>
                              <AlertTitle>Upload Error</AlertTitle>
                              <FormDescription>{fileError}</FormDescription>
                           </Alert>
                      )}
                  </div>

                  {/* Image Preview */}
                  {imageDataUrl && (
                     <div className="mt-4">
                         <FormLabel>Image Preview</FormLabel>
                         <div className="mt-2 border rounded-md p-2 flex justify-center">
                             <Image src={imageDataUrl} alt="Preview" width={200} height={200} className="max-w-full h-auto rounded" />
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
