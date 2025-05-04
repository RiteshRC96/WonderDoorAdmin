"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Image from 'next/image'; // Keep Image import for preview

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
import { Loader2, Upload, AlertCircle } from "lucide-react"; // Add icons
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle } from "@/components/ui/alert"; // Add Alert


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
  const [selectedFileName, setSelectedFileName] = React.useState<string | null>(null);
  // Initialize imageDataUrl with existing item.imageUrl if it looks like a data URL, otherwise null
  const [imageDataUrl, setImageDataUrl] = React.useState<string | null>(
     item.imageUrl && item.imageUrl.startsWith('data:image/') ? item.imageUrl : null
  );
  const [fileError, setFileError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);


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
      // Use imageUrl only if it's not a data URL
      imageUrl: item.imageUrl && !item.imageUrl.startsWith('data:image/') ? item.imageUrl : "",
      // imageHint is removed from schema and form
    },
  });

  // Read file as Data URL - Reuse from add-item-form
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

  // Handle file change - Reuse from add-item-form
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFileError(null);
    setSelectedFileName(null);
    setImageDataUrl(null);
    form.setValue('imageUrl', ''); // Clear URL field

    if (file) {
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

      try {
        const dataUrl = await readFileAsDataURL(file);
        setImageDataUrl(dataUrl);
        setSelectedFileName(file.name);
      } catch (error) {
        console.error("Error reading file:", error);
        setFileError('Failed to read the selected file.');
      }
    }
  };

  // Handle URL change - Reuse from add-item-form
  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
     const url = event.target.value;
     form.setValue('imageUrl', url);
     if (url && fileInputRef.current) {
       fileInputRef.current.value = '';
       setSelectedFileName(null);
       setImageDataUrl(null);
       setFileError(null);
     }
   };


  async function onSubmit(values: AddItemInput) {
    setIsSubmitting(true);

     // Create payload, including the image Data URL IF it exists and is different from initial
     const payload: AddItemInput & { imageDataUrl?: string } = {
         ...values,
         // Pass the Data URL only if it's new or changed
         imageDataUrl: imageDataUrl && (!item.imageUrl || !item.imageUrl.startsWith('data:image/') || imageDataUrl !== item.imageUrl) ? imageDataUrl : undefined,
     };
      // If imageUrl is provided (and not a data URL), don't send imageDataUrl
      if (values.imageUrl && !values.imageUrl.startsWith('data:image/')) {
          delete payload.imageDataUrl;
      }
      // If imageDataUrl is undefined AND the original item had a DataURL,
      // we might need a way to signal deletion, but update action should handle absence.

      console.log("Update payload (keys):", Object.keys(payload));


    try {
      // The updateItemAction needs to handle both imageUrl and imageDataUrl appropriately
      const result = await updateItemAction(item.id, payload);

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
         setIsSubmitting(false); // Keep submitting false on error
      }
    } catch (error) {
       console.error("Submission error:", error);
       toast({
         variant: "destructive",
         title: "Submission Error",
         description: "An unexpected error occurred. Please try again.",
       });
        setIsSubmitting(false); // Ensure submission state is reset
    }
  }

  // Determine the preview source: new data URL or existing item URL (if not a data URL)
  const previewSource = imageDataUrl || (item.imageUrl && !item.imageUrl.startsWith('data:image/') ? item.imageUrl : null);


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
                        <FormLabel>Price (₹) *</FormLabel>
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

             {/* Media Section - URL Input or File Upload */}
             <div className="space-y-4">
                 <h3 className="text-lg font-semibold border-b pb-2">Media (Optional)</h3>
                 <p className="text-sm text-muted-foreground">Provide an image URL OR upload a new image file (PNG, JPG, JPEG - Max 5MB).</p>
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
                                     value={field.value || ''}
                                     onChange={handleUrlChange}
                                     aria-invalid={!!form.formState.errors.imageUrl}
                                 />
                             </FormControl>
                             <FormDescription>Enter the full URL of the main product image (ensure public accessibility).</FormDescription>
                             <FormMessage />
                         </FormItem>
                     )}
                 />

                 {/* File Upload Input */}
                 <div className="space-y-2">
                     <FormLabel htmlFor="image-upload">Or Upload New Image</FormLabel>
                     <div className="flex items-center gap-3">
                         <FormControl>
                             <Input
                                 id="image-upload"
                                 type="file"
                                 ref={fileInputRef}
                                 accept=".png, .jpg, .jpeg"
                                 onChange={handleFileChange}
                                 className="flex-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                 disabled={isSubmitting}
                             />
                         </FormControl>
                     </div>
                     {selectedFileName && !fileError && (
                         <p className="text-sm text-muted-foreground">Selected file: {selectedFileName} (will replace existing image)</p>
                     )}
                     {fileError && (
                         <Alert variant="destructive" className="mt-2">
                             <AlertCircle className="h-4 w-4" />
                             <AlertTitle>Upload Error</AlertTitle>
                             <FormDescription>{fileError}</FormDescription>
                         </Alert>
                     )}
                 </div>

                 {/* Image Preview */}
                  {previewSource && (
                     <div className="mt-4">
                         <FormLabel>Current Image Preview</FormLabel>
                         <div className="mt-2 border rounded-md p-2 flex justify-center">
                             <Image src={previewSource} alt="Preview" width={200} height={200} className="max-w-full h-auto rounded" />
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
                {isSubmitting ? "Saving Changes..." : "Save Changes"}
              </Button>
            </CardFooter>
         </form>
        </Form>
    </Card>
  );
}
