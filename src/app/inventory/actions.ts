
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
  const firebaseCheck = checkFirebaseInitialization();
  if (!firebaseCheck.initialized) {
    return { success: false, message: firebaseCheck.message, errors: null };
  }

  // Separate imageDataUrl from the rest of the data for validation
  const { imageDataUrl, ...itemData } = payload;

  const validationResult = AddItemSchema.safeParse(itemData);

  if (!validationResult.success) {
    console.error("Validation Errors:", validationResult.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Validation failed. Please check the form fields.",
      errors: validationResult.error.flatten().fieldErrors,
    };
  }

  let finalImageUrl: string | undefined = undefined;

  // --- Handle Image Upload ---
  // Use && instead of &amp;&amp;
  if (imageDataUrl && storage) {
      try {
          console.log("Image data URL provided, attempting upload...");
          // Validate Data URL format (basic check)
          if (!imageDataUrl.startsWith('data:image/')) {
              throw new Error("Invalid image Data URL format.");
          }

          // Generate a unique filename (e.g., using SKU and timestamp)
          const fileExtension = imageDataUrl.substring(imageDataUrl.indexOf('/') + 1, imageDataUrl.indexOf(';base64'));
          // Use forward slashes for Storage paths
          const fileName = `inventory/${validationResult.data.sku || 'unknown_sku'}_${Date.now()}.${fileExtension}`;
          const imageStorageRef = storageRef(storage, fileName);

          console.log(`Uploading image to Storage path: ${fileName}`);

          // Extract Base64 data (remove the 'data:image/...;base64,' part)
          const base64Data = imageDataUrl.split(',')[1];
          if (!base64Data) {
               throw new Error("Could not extract Base64 data from Data URL.");
          }

          // Upload the image data as a Base64 string
          const uploadResult = await uploadString(imageStorageRef, base64Data, 'base64', {
             contentType: `image/${fileExtension}` // Set content type for proper handling
          });
          console.log("Image uploaded successfully to Storage.");

          // Get the public download URL
          finalImageUrl = await getDownloadURL(uploadResult.ref);
          console.log(`Image download URL obtained: ${finalImageUrl}`);

      } catch (uploadError) {
          const errorMessage = `Image upload failed: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`;
          console.error(errorMessage);
          return {
              success: false,
              message: `Failed to upload image. Please try again or skip image upload. Error: ${errorMessage}`,
              errors: { imageUrl: ["Image upload failed."] } // Assign error to imageUrl field
          };
      }
  } else if (!itemData.imageHint && !imageDataUrl) {
      // If no image uploaded AND no hint provided, return error (as hint is required)
      return {
        success: false,
        message: "Image hint is required if no image is uploaded.",
        errors: { imageHint: ["Image hint is required."] }
      };
  }

  // Prepare the final data for Firestore, including the obtained imageUrl
  const newItemData = {
      ...validationResult.data,
      imageUrl: finalImageUrl, // Use the URL from Storage or undefined
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
  };

  // Remove empty/undefined optional fields before sending to Firestore
   Object.keys(newItemData).forEach(key => {
        const typedKey = key as keyof typeof newItemData;
        // Keep imageUrl even if undefined initially, it might be set by upload
        if (typedKey !== 'imageUrl' && (newItemData[typedKey] === undefined || newItemData[typedKey] === "")) {
           delete newItemData[typedKey];
        }
        // Explicitly remove imageUrl if it ended up undefined after potential upload attempt
        if(typedKey === 'imageUrl' && newItemData[typedKey] === undefined) {
            delete newItemData[typedKey];
        }
   });

  try {
    console.log("Attempting to add item document to Firestore with data keys:", JSON.stringify(Object.keys(newItemData)));
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
         const firestoreError = error as any;
         if (firestoreError.code) {
            errorCode = firestoreError.code;
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
                      // Check if the error is due to large image data being passed directly
                      if (error.message.includes('longer than 1048487 bytes')) {
                          errorMessage = "Image data is too large to store directly. Please try a smaller image or check upload logic.";
                      } else {
                          errorMessage = `Invalid data provided to Firestore: ${firestoreError.message}`;
                      }
                      break;
                  default:
                      errorMessage = `Firestore error (${firestoreError.code}): ${firestoreError.message}`;
                      break;
            }
            console.error(`Firestore Error (${firestoreError.code}):`, error);
         } else {
            errorMessage = `Error adding item document: ${error.message}`;
            console.error("Error adding item to Firestore:", error);
         }
     } else {
        console.error("An unexpected error occurred:", error);
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

  const { imageDataUrl, ...itemData } = data; // Separate potential data URL

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
  const itemDataToUpdate: Partial<AddItemPayload & { updatedAt: any }> = {
    ...validationResult.data,
    // imageUrl: validationResult.data.imageUrl || undefined, // Keep existing or newly entered URL for now
    updatedAt: serverTimestamp(),
  };
   // Ensure imageUrl is either a valid URL string or removed
   if (itemDataToUpdate.imageUrl === "") {
       delete itemDataToUpdate.imageUrl;
   }


  // Remove other empty/undefined fields before sending to Firestore
   Object.keys(itemDataToUpdate).forEach(key => {
        const typedKey = key as keyof typeof itemDataToUpdate;
        if (typedKey !== 'imageUrl' && (itemDataToUpdate[typedKey] === undefined || itemDataToUpdate[typedKey] === "")) {
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
                          errorMessage = "Image data is too large to store directly. Please check image update logic.";
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


    