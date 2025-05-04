
'use server';

import { revalidatePath } from 'next/cache';
import { AddItemSchema, type AddItemPayload } from '@/schemas/inventory'; // Use AddItemPayload
import {
    db,
    storage, // Import storage
    collection,
    addDoc,
    doc,
    deleteDoc,
    updateDoc,
    serverTimestamp,
    Timestamp,
    storageRef, // Import storageRef
    uploadString, // Import uploadString
    getDownloadURL, // Import getDownloadURL
    getDoc,       // Import getDoc
    deleteObject  // Import deleteObject
} from '@/lib/firebase/firebase'; // Import Firestore instance and functions

// Helper function to check Firestore and Storage initialization
function checkFirebaseInitialization() {
  let errors: string[] = [];
  if (!db) {
    errors.push("Firestore database is not initialized.");
  }
  if (!storage) {
    errors.push("Firebase Storage is not initialized.");
  }

  if (errors.length > 0) {
    const errorMessage = `Firebase Initialization Error: ${errors.join(' ')} Check Firebase configuration. Operation cannot proceed.`;
    console.error(errorMessage);
    // Provide a user-friendly message emphasizing configuration check
    return { initialized: false, message: "Database/Storage configuration error. Please check setup and restart." };
  }
  return { initialized: true, message: "" };
}


// Server Action to add a new inventory item to Firestore, potentially uploading an image
export async function addItemAction(payload: AddItemPayload): Promise<{ success: boolean; message: string; itemId?: string; errors?: Record<string, string[]> | null }> {
  console.log("addItemAction started. Received payload keys:", Object.keys(payload));
  const firebaseCheck = checkFirebaseInitialization();
  if (!firebaseCheck.initialized) {
    console.error("Firebase initialization check failed.");
    return { success: false, message: firebaseCheck.message, errors: null };
  }

  // Separate imageDataUrl from the rest of the data for validation
  const { imageDataUrl, ...itemData } = payload;
  console.log("Item data for validation (excluding image data URL):", itemData);

  const validationResult = AddItemSchema.safeParse(itemData);

  if (!validationResult.success) {
    console.error("Validation Errors:", validationResult.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Validation failed. Please check the form fields.",
      errors: validationResult.error.flatten().fieldErrors,
    };
  }
   console.log("Validation successful.");
   const validatedData = validationResult.data;

    // Double-check image hint requirement if no image data URL is present
   if (!imageDataUrl && !validatedData.imageHint) {
       console.error("Validation Error: Image hint required when no image uploaded.");
       return {
         success: false,
         message: "Image hint is required if no image is uploaded.",
         errors: { imageHint: ["Image hint is required."] }
       };
   }


  let finalImageUrl: string | undefined = undefined;

  // --- Handle Image Upload ---
  // Use && instead of &amp;&amp;
  if (imageDataUrl && storage) { // Ensure storage is initialized
      console.log("Image data URL provided, attempting upload...");
      try {
          // Validate Data URL format (basic check)
          const match = imageDataUrl.match(/^data:(image\/(.+));base64,(.*)$/);
           if (!match) {
               throw new Error("Invalid image Data URL format.");
           }

           const mimeType = match[1]; // e.g., 'image/png'
           const fileExtension = match[2]; // e.g., 'png'
           const base64Data = match[3]; // The Base64 encoded data

           if (!base64Data) {
                throw new Error("Could not extract Base64 data from Data URL.");
           }
            console.log(`Image details: MIME Type=${mimeType}, Extension=${fileExtension}, Base64 Length=${base64Data.length}`);

          // Generate a unique filename (e.g., using SKU and timestamp)
          // Use forward slashes for Storage paths
          const fileName = `inventory/${validatedData.sku || 'unknown_sku'}_${Date.now()}.${fileExtension}`;
          const imageStorageRef = storageRef(storage, fileName);

          console.log(`Uploading image to Storage path: ${fileName}`);

          // Upload the image data as a Base64 string
          const uploadResult = await uploadString(imageStorageRef, base64Data, 'base64', {
             contentType: mimeType // Set content type for proper handling
          });
          console.log("Image uploaded successfully to Storage. Path:", uploadResult.ref.fullPath);

          // Get the public download URL
          finalImageUrl = await getDownloadURL(uploadResult.ref);
          console.log(`Image download URL obtained: ${finalImageUrl}`);

      } catch (uploadError) {
          let userFriendlyMessage = "Image upload failed. Please try again or skip image upload.";
          if (uploadError instanceof Error) {
              console.error(`Image upload error details: ${uploadError.message}`, uploadError);
               if (uploadError.message.includes('storage/unauthorized')) {
                  userFriendlyMessage = "Image upload failed: Unauthorized. Check Storage security rules.";
               } else if (uploadError.message.includes('storage/canceled')) {
                   userFriendlyMessage = "Image upload cancelled.";
               } else if (uploadError.message.includes('storage/unknown')) {
                   userFriendlyMessage = "An unknown error occurred during image upload. Check network or configuration.";
               } else {
                   userFriendlyMessage = `Image upload failed: ${uploadError.message}`;
               }
          } else {
               console.error("An unexpected error occurred during upload:", uploadError);
          }

          return {
              success: false,
              message: userFriendlyMessage,
              // Assign error to a general field or a specific one if possible
              errors: { imageUrl: ["Image upload failed."] } // Generic error for now
          };
      }
  } else if (imageDataUrl && !storage) {
      // This case should be caught by checkFirebaseInitialization, but handle defensively
      console.error("Image data provided, but Firebase Storage is not initialized.");
       return {
           success: false,
           message: "Image upload failed because Storage is not configured correctly.",
           errors: { imageUrl: ["Storage configuration error."] }
       };
  } else {
     console.log("No image data URL provided or storage not initialized, skipping image upload.");
  }


  // Prepare the final data for Firestore, including the obtained imageUrl
  // Important: Use the validatedData from the schema result
  const newItemData = {
      ...validatedData, // Use data parsed by Zod
      imageUrl: finalImageUrl, // Use the URL from Storage or undefined if no upload
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
  };

  // Remove empty/undefined optional fields before sending to Firestore
   Object.keys(newItemData).forEach(key => {
        const typedKey = key as keyof typeof newItemData;
        // Keep imageUrl even if undefined initially, it might be set by upload
        if (typedKey !== 'imageUrl' && (newItemData[typedKey] === undefined || newItemData[typedKey] === "")) {
           console.log(`Removing empty/undefined field: ${typedKey}`);
           delete newItemData[typedKey];
        }
        // Explicitly remove imageUrl if it ended up undefined after potential upload attempt or no upload happened
        if(typedKey === 'imageUrl' && newItemData[typedKey] === undefined) {
            console.log("Removing undefined imageUrl field.");
            delete newItemData[typedKey];
        }
   });

  try {
    console.log("Attempting to add item document to Firestore with data keys:", JSON.stringify(Object.keys(newItemData)), "Data snippet:", JSON.stringify(newItemData).substring(0, 200));
    if (!db) {
        throw new Error("Firestore database instance (db) is null. Cannot add document.");
    }
    const inventoryCollectionRef = collection(db, 'inventory');
    const docRef = await addDoc(inventoryCollectionRef, newItemData);

    console.log(`Successfully added item with ID: ${docRef.id}`);

    // Revalidate the inventory list page cache to show the new item
    revalidatePath('/inventory');
    revalidatePath('/'); // Also revalidate dashboard

    return {
      success: true,
      message: `Item '${newItemData.name}' added successfully! ${finalImageUrl ? 'Image uploaded.' : 'No image uploaded.'}`,
      itemId: docRef.id,
    };

  } catch (error) {
     // --- Enhanced Error Logging ---
     let errorMessage = "Failed to add item document to Firestore.";
     let errorCode = "UNKNOWN"; // Default error code

     if (error instanceof Error) {
         const firestoreError = error as any; // Cast to any to check for 'code' potentially
         if (firestoreError.code) {
            errorCode = firestoreError.code;
            console.error(`Firestore Error (${firestoreError.code}):`, error.message, error.stack);
            // ... [existing Firestore error handling switch case] ...
            switch (firestoreError.code) {
                 case 'permission-denied':
                     errorMessage = "Permission denied. Check Firestore security rules.";
                     break;
                 case 'unauthenticated':
                      errorMessage = "Authentication required. Please log in.";
                      break;
                  case 'resource-exhausted':
                      errorMessage = "Firestore quota exceeded. Please check your Firebase plan limits.";
                      break;
                  case 'invalid-argument':
                      // Check if the error is due to large image data being passed directly (should not happen now)
                      if (error.message.includes('longer than 1048487 bytes')) {
                          errorMessage = "Data size limit exceeded for Firestore document. This shouldn't happen with Storage uploads.";
                      } else {
                          errorMessage = `Invalid data provided to Firestore: ${firestoreError.message}`;
                      }
                      break;
                  default:
                      errorMessage = `Firestore error (${firestoreError.code}): ${firestoreError.message}`;
                      break;
            }
         } else {
            errorMessage = `Error adding item document: ${error.message}`;
            console.error("Error adding item to Firestore (non-Firestore error or code missing):", error.message, error.stack);
         }
     } else {
        console.error("An unexpected non-Error object was thrown:", error);
        errorMessage = "An unexpected error occurred while saving the item.";
     }

     // Attempt to clean up uploaded image if Firestore add fails
     if (finalImageUrl && storage) {
        console.warn(`Firestore save failed for item '${newItemData.name}'. Attempting to delete uploaded image: ${finalImageUrl}`);
         try {
             const imageRefToDelete = storageRef(storage, finalImageUrl);
             await deleteObject(imageRefToDelete);
             console.log(`Successfully deleted orphaned image for failed item add.`);
         } catch (deleteError) {
             console.error(`Failed to delete orphaned image (${finalImageUrl}) after Firestore error:`, deleteError);
         }
     }


    return {
      success: false,
      message: `${errorMessage} (Code: ${errorCode}). Please try again.`,
      errors: null, // Or potentially map specific errors if identifiable
    };
  }
}

// Server Action to update an existing inventory item in Firestore
// TODO: Add image update/delete logic if needed for the edit form
export async function updateItemAction(
  itemId: string,
  data: AddItemPayload // Use payload to potentially handle image updates later
): Promise<{ success: boolean; message: string; errors?: Record<string, string[]> | null }> {
  const firebaseCheck = checkFirebaseInitialization();
  if (!firebaseCheck.initialized) {
    return { success: false, message: firebaseCheck.message, errors: null };
  }

  if (!itemId) {
      return { success: false, message: "Item ID is required for update.", errors: null };
  }

  // Note: This update action currently DOES NOT handle image file updates.
  // It only updates the data fields based on the form submission, potentially including
  // an imageUrl if it was already present or manually entered in the edit form.
  // A more robust implementation would check if a new image is provided,
  // upload it, delete the old one (if exists), and update the URL.

  const { imageDataUrl, ...itemData } = data; // Separate potential data URL - NOT USED YET

  const validationResult = AddItemSchema.safeParse(itemData);

  if (!validationResult.success) {
    console.error("Update Validation Errors:", validationResult.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Validation failed. Please check the form fields.",
      errors: validationResult.error.flatten().fieldErrors,
    };
  }

  // Prepare the data for Firestore update
  // WARNING: Image update/delete logic is NOT implemented here yet.
  // It only updates fields present in AddItemSchema.
  const itemDataToUpdate: Partial<AddItemInput & { updatedAt: any }> = {
    ...validationResult.data,
    // imageUrl: validationResult.data.imageUrl || undefined, // Keep existing or newly entered URL for now
    updatedAt: serverTimestamp(),
  };
   // Ensure imageUrl is either a valid URL string or removed if empty
   if (itemDataToUpdate.imageUrl === "") {
       itemDataToUpdate.imageUrl = undefined; // Use undefined for potential deletion/no update
   }


  // Remove other empty/undefined fields before sending to Firestore
   Object.keys(itemDataToUpdate).forEach(key => {
        const typedKey = key as keyof typeof itemDataToUpdate;
        if (typedKey !== 'imageUrl' && (itemDataToUpdate[typedKey] === undefined || itemDataToUpdate[typedKey] === "")) {
            delete itemDataToUpdate[typedKey];
        }
         // Handle imageUrl specifically - if it's undefined, don't send it in the update payload
         // unless you explicitly want to remove the field (requires different handling).
         // For now, we just won't include it if it's undefined.
         if (typedKey === 'imageUrl' && itemDataToUpdate[typedKey] === undefined) {
             delete itemDataToUpdate[typedKey];
         }
   });


  try {
    console.log(`Attempting to update item with ID: ${itemId}`);
    const itemDocRef = doc(db, 'inventory', itemId);
    await updateDoc(itemDocRef, itemDataToUpdate); // Use updateDoc with partial data

    console.log(`Successfully updated item with ID: ${itemId}`);

    // Revalidate relevant paths
    revalidatePath('/inventory');
    revalidatePath(`/inventory/${itemId}`);
    revalidatePath(`/inventory/${itemId}/edit`);
    revalidatePath('/'); // Revalidate dashboard


    return {
      success: true,
      message: `Item '${itemDataToUpdate.name}' updated successfully!`,
    };

  } catch (error) {
    // --- Enhanced Error Logging ---
    let errorMessage = "Failed to update item due to a database error.";
    let errorCode = "UNKNOWN";

    if (error instanceof Error) {
        const firestoreError = error as any;
        if (firestoreError.code) {
            errorCode = firestoreError.code;
             switch (firestoreError.code) {
                case 'permission-denied':
                    errorMessage = "Permission denied. Check Firestore security rules.";
                    break;
                case 'unauthenticated':
                     errorMessage = "Authentication required. Please log in.";
                     break;
                case 'not-found':
                     errorMessage = `Item with ID ${itemId} not found. Cannot update.`;
                     break;
                 case 'resource-exhausted':
                     errorMessage = "Firestore quota exceeded. Please check your Firebase plan limits.";
                     break;
                 case 'invalid-argument':
                      if (error.message.includes('longer than 1048487 bytes')) {
                          errorMessage = "Data size limit exceeded for Firestore document.";
                      } else {
                         errorMessage = `Invalid data provided for update: ${firestoreError.message}`;
                      }
                     break;
                 default:
                     errorMessage = `Firestore error (${firestoreError.code}): ${firestoreError.message}`;
                     break;
             }
            console.error(`Firestore Error during update (${firestoreError.code}):`, error);
        } else {
            errorMessage = `Error updating item: ${error.message}`;
            console.error("Error updating item in Firestore:", error);
        }
    } else {
        console.error("An unexpected error occurred during update:", error);
    }

    // Note: No specific check for large image data here as update doesn't handle uploads yet.
    return {
      success: false,
      message: `${errorMessage} (Code: ${errorCode}). Please try again.`,
      errors: null,
    };
  }
}


// Server Action to delete an inventory item from Firestore
// Includes deletion of associated image from Firebase Storage.
export async function deleteItemAction(itemId: string): Promise<{ success: boolean; message: string; }> {
  const firebaseCheck = checkFirebaseInitialization();
  if (!firebaseCheck.initialized) {
    return { success: false, message: firebaseCheck.message };
  }


  if (!itemId) {
      return { success: false, message: "Item ID is required." };
  }

  const itemDocRef = doc(db, 'inventory', itemId);

  try {
    console.log(`Attempting to delete item document and potentially image for ID: ${itemId}`);

    // Get the document first to find the image URL for deletion
    let imageUrlToDelete: string | undefined;
    if (storage) { // Only attempt if storage is initialized
        try {
            const docSnap = await getDoc(itemDocRef);
            if (docSnap.exists()) {
                imageUrlToDelete = docSnap.data()?.imageUrl;
                 console.log(`Found image URL to delete: ${imageUrlToDelete}`);
            } else {
                console.log(`Item ${itemId} not found in Firestore, cannot delete.`);
                 // Return success=false or a specific message if the item doesn't exist
                 return { success: false, message: `Item with ID ${itemId} not found.` };
            }
        } catch (getError) {
            console.warn(`Could not fetch item ${itemId} before delete to get image URL:`, getError);
             // Potentially proceed with Firestore delete even if image fetch fails, or return an error
             return { success: false, message: "Failed to fetch item details before deletion." };
        }
    } else {
        // If storage isn't initialized, we can still delete the Firestore doc but warn about the image
        console.warn("Firebase Storage not initialized. Cannot delete associated image.");
    }


    // Delete Firestore document
    await deleteDoc(itemDocRef);
    console.log(`Successfully deleted Firestore document for item ID: ${itemId}`);

    // Delete image from Storage if URL was found and storage is available
    if (imageUrlToDelete && storage) {
        try {
            console.log(`Attempting to delete image from Storage: ${imageUrlToDelete}`);
            // Create a reference from the full URL
            const imageRefToDelete = storageRef(storage, imageUrlToDelete);
            await deleteObject(imageRefToDelete);
            console.log(`Successfully deleted image from Storage for item ID: ${itemId}`);
        } catch (storageError: any) {
            // Log error but don't fail the whole operation if image delete fails
            // Handle 'object-not-found' specifically, as it's not a critical failure
            if (storageError.code === 'storage/object-not-found') {
                 console.log(`Image not found in Storage for item ${itemId} (URL: ${imageUrlToDelete}). It might have been deleted already.`);
            } else {
                 console.error(`Failed to delete image from Storage for item ${itemId} (URL: ${imageUrlToDelete}):`, storageError);
                 // Optionally return a slightly different success message indicating image deletion failed
                 // return { success: true, message: "Item document deleted, but failed to delete associated image." };
            }
        }
    } else if (storage && !imageUrlToDelete) {
        console.log(`No image URL found in Firestore document for item ${itemId}, skipping Storage deletion.`);
    }


    revalidatePath('/inventory');
    // No need to revalidate detail/edit pages as the item is gone
    // revalidatePath(`/inventory/${itemId}`);
    // revalidatePath(`/inventory/${itemId}/edit`);
    revalidatePath('/'); // Revalidate dashboard

    return { success: true, message: "Item deleted successfully." };

  } catch (error) {
    // --- Enhanced Error Logging for Firestore delete ---
    let errorMessage = "Failed to delete item due to a database error.";
    let errorCode = "UNKNOWN";

     if (error instanceof Error) {
         const firestoreError = error as any;
         if (firestoreError.code) {
            errorCode = firestoreError.code;
             switch (firestoreError.code) {
                // ... [existing error handling cases] ...
                case 'permission-denied':
                    errorMessage = "Permission denied. Check Firestore security rules.";
                    break;
                case 'unauthenticated':
                     errorMessage = "Authentication required. Please log in.";
                     break;
                case 'not-found':
                     // This shouldn't happen if we get the doc first, but handle defensively
                     errorMessage = `Item with ID ${itemId} not found. Cannot delete.`;
                     break;
                 default:
                     errorMessage = `Firestore error (${firestoreError.code}): ${firestoreError.message}`;
                     break;
             }
            console.error(`Firestore Error during delete (${firestoreError.code}):`, error);
         } else {
            errorMessage = `Error deleting item: ${error.message}`;
            console.error("Error deleting item from Firestore:", error);
         }
     } else {
        console.error("An unexpected error occurred during delete:", error);
     }

    return {
      success: false,
      message: `${errorMessage} (Code: ${errorCode}). Please try again.`,
    };
  }
}

