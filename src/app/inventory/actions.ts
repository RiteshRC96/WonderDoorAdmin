'use server';

import { revalidatePath } from 'next/cache';
import { AddItemSchema, type AddItemInput } from '@/schemas/inventory'; // Use AddItemInput directly
import {
    db,
    collection,
    addDoc,
    doc,
    deleteDoc,
    updateDoc,
    serverTimestamp,
    Timestamp,
    getDoc, // Keep getDoc for checking existence in delete
    // Storage related imports are kept as image upload is implemented
    storage,
    storageRef,
    uploadString,
    getDownloadURL,
    deleteObject
} from '@/lib/firebase/firebase'; // Import Firestore instance and functions

// Helper function to check Firestore initialization
function checkFirebaseInitialization() {
  if (!db || !storage) { // Check both Firestore and Storage
    const errorMessage = `Firebase Initialization Error: Firestore database or Storage is not initialized. Check Firebase configuration. Operation cannot proceed.`;
    console.error(errorMessage);
    return { initialized: false, message: "Database/Storage configuration error. Please check setup and restart." };
  }
  return { initialized: true, message: "" };
}


// Server Action to add a new inventory item to Firestore
export async function addItemAction(payload: AddItemInput & { imageDataUrl?: string }): Promise<{ success: boolean; message: string; itemId?: string; errors?: Record<string, string[]> | null }> {
  console.log("addItemAction started. Received payload:", Object.keys(payload)); // Log keys to check payload structure
  const firebaseCheck = checkFirebaseInitialization();
  if (!firebaseCheck.initialized) {
    console.error("Firebase initialization check failed.");
    return { success: false, message: firebaseCheck.message, errors: null };
  }

  // Separate image data URL from the main data for validation
  const { imageDataUrl, ...itemData } = payload;

  // Validate the item data (excluding the image data URL)
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

  let imageUrl: string | undefined = undefined; // Initialize imageUrl as undefined

  // --- Handle Image Upload ---
  if (imageDataUrl && storage) {
      try {
          console.log("Image data URL provided, attempting upload...");
          // Validate Data URL format (basic check)
          if (!imageDataUrl.startsWith('data:image/')) {
              throw new Error("Invalid image data URL format.");
          }

          // Generate a unique filename (e.g., using timestamp and SKU)
          const fileExtension = imageDataUrl.substring(imageDataUrl.indexOf('/') + 1, imageDataUrl.indexOf(';base64'));
          const fileName = `inventory/${validatedData.sku || 'unknown_sku'}-${Date.now()}.${fileExtension}`;
          const imageStorageRef = storageRef(storage, fileName);

          // Upload the image data (extract base64 part)
          const base64Data = imageDataUrl.split(',')[1];
          console.log(`Uploading image to Firebase Storage at: ${fileName}`);
          const uploadResult = await uploadString(imageStorageRef, base64Data, 'base64', {
             contentType: `image/${fileExtension}` // Set content type explicitly
           });

          // Get the download URL
          imageUrl = await getDownloadURL(uploadResult.ref);
          console.log(`Image uploaded successfully. Download URL: ${imageUrl}`);

      } catch (uploadError) {
          console.error("Error uploading image to Firebase Storage:", uploadError);
          // If image upload fails, should we stop the whole process? Or just proceed without the image?
          // Decision: Proceed without image, but log the error and inform the user.
          return {
              success: false,
              message: `Item data is valid, but image upload failed: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}. Please try adding the item without an image or check the file.`,
              errors: null, // Not a validation error on item data itself
          };
      }
  } else {
     console.log("No image data URL provided or storage not initialized, skipping image upload.");
  }

  // Prepare the final data for Firestore
  const newItemData = {
      ...validatedData,
      imageUrl: imageUrl, // Add the obtained imageUrl (or undefined if upload failed/skipped)
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
  };

  // Remove empty/undefined optional fields before sending to Firestore
   Object.keys(newItemData).forEach(key => {
        const typedKey = key as keyof typeof newItemData;
        if (newItemData[typedKey] === undefined || newItemData[typedKey] === "") {
           // Remove undefined/empty fields
           console.log(`Removing empty/undefined field: ${typedKey}`);
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
      message: `Item '${newItemData.name}' added successfully!${imageUrl ? '' : ' (Image upload skipped/failed)'}`,
      itemId: docRef.id,
      errors: null,
    };

  } catch (error) {
     // --- Enhanced Error Logging ---
     let errorMessage = "Failed to add item document to Firestore.";
     let errorCode = "UNKNOWN";

     if (error instanceof Error) {
         const firestoreError = error as any;
         if (firestoreError.code) {
            errorCode = firestoreError.code;
            console.error(`Firestore Error (${firestoreError.code}):`, error.message, error.stack);
            // Simplified switch for common Firestore errors
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
                      errorMessage = `Invalid data provided to Firestore: ${firestoreError.message}`;
                      break;
                  default:
                      errorMessage = `Firestore error (${firestoreError.code}): ${firestoreError.message}`;
                      break;
            }
         } else {
            // Handle generic errors or non-Firebase errors
            errorMessage = `Error adding item document: ${error.message}`;
            console.error("Error adding item to Firestore (non-Firestore error or code missing):", error.message, error.stack);
         }
     } else {
        console.error("An unexpected non-Error object was thrown:", error);
        errorMessage = "An unexpected error occurred while saving the item.";
     }

     // --- Orphaned Image Cleanup ---
      // If Firestore save fails *after* a successful image upload, delete the orphaned image
      if (imageUrl && storage) {
          console.warn(`Firestore save failed after image upload. Deleting orphaned image: ${imageUrl}`);
          try {
              const orphanedImageRef = storageRef(storage, imageUrl); // Get ref from URL
              await deleteObject(orphanedImageRef);
              console.log("Orphaned image deleted successfully.");
          } catch (deleteError) {
               console.error("Failed to delete orphaned image:", deleteError);
               errorMessage += " Failed to clean up uploaded image."; // Append to user message
           }
      }


    // ALWAYS return null for errors when it's not a validation failure
    return {
      success: false,
      message: `${errorMessage}${errorCode !== 'UNKNOWN' ? ` (Code: ${errorCode})` : ''}. Please try again.`,
      errors: null, // Explicitly set errors to null for non-validation errors
    };
  }
}

// Server Action to update an existing inventory item in Firestore
// TODO: Add image update/delete logic here as well
export async function updateItemAction(
  itemId: string,
  data: AddItemInput // Use AddItemInput directly
): Promise<{ success: boolean; message: string; errors?: Record<string, string[]> | null }> {
  const firebaseCheck = checkFirebaseInitialization();
  if (!firebaseCheck.initialized) {
    return { success: false, message: firebaseCheck.message, errors: null };
  }

  if (!itemId) {
      return { success: false, message: "Item ID is required for update.", errors: null };
  }

  // Validate the incoming data
  const validationResult = AddItemSchema.safeParse(data);

  if (!validationResult.success) {
    console.error("Update Validation Errors:", validationResult.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Validation failed. Please check the form fields.",
      errors: validationResult.error.flatten().fieldErrors,
    };
  }

  // --- Image Handling TODO ---
  // Needs logic to:
  // 1. Check if a new image is provided (e.g., via `imageDataUrl` similar to add)
  // 2. If yes, upload new image, get new URL.
  // 3. Check if an old `imageUrl` exists on the item being updated.
  // 4. If yes, delete the old image from Storage using `deleteObject`.
  // 5. Update the `imageUrl` field in Firestore with the new URL.
  // 6. Handle cases where the image is removed (set `imageUrl` to null/delete field and delete from storage).

  // Prepare the data for Firestore update
  const itemDataToUpdate: Partial<AddItemInput & { updatedAt: any }> = {
    ...validationResult.data,
    updatedAt: serverTimestamp(),
  };

  // Remove empty/undefined fields before sending to Firestore
   Object.keys(itemDataToUpdate).forEach(key => {
        const typedKey = key as keyof typeof itemDataToUpdate;
        // Handle imageUrl specifically: remove if empty or undefined
         if (typedKey === 'imageUrl' && (itemDataToUpdate[typedKey] === "" || itemDataToUpdate[typedKey] === undefined)) {
             console.log("Removing empty/undefined imageUrl field during update.");
             delete itemDataToUpdate[typedKey];
         } else if (itemDataToUpdate[typedKey] === undefined || itemDataToUpdate[typedKey] === "") {
            // Remove other undefined/empty fields
            console.log(`Removing empty/undefined field during update: ${typedKey}`);
            delete itemDataToUpdate[typedKey];
         }
   });


  try {
    console.log(`Attempting to update item with ID: ${itemId} with data:`, itemDataToUpdate);
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
      errors: null, // Ensure errors is explicitly null on success
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
                      errorMessage = `Invalid data provided for update: ${firestoreError.message}`;
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

    // Return null for errors for non-validation failures
    return {
      success: false,
      message: `${errorMessage}${errorCode !== 'UNKNOWN' ? ` (Code: ${errorCode})` : ''}. Please try again.`,
      errors: null, // Explicitly null
    };
  }
}


// Server Action to delete an inventory item from Firestore and its image from Storage
export async function deleteItemAction(itemId: string): Promise<{ success: boolean; message: string; }> {
  const firebaseCheck = checkFirebaseInitialization();
  if (!firebaseCheck.initialized) {
    return { success: false, message: firebaseCheck.message };
  }

  if (!itemId) {
      return { success: false, message: "Item ID is required." };
  }

  const itemDocRef = doc(db, 'inventory', itemId);
  let imageUrlToDelete: string | undefined;

  try {
    console.log(`Attempting to delete item document for ID: ${itemId}`);

    // Get the document first to retrieve the imageUrl for deletion
    const docSnap = await getDoc(itemDocRef);
    if (!docSnap.exists()) {
       console.log(`Item ${itemId} not found in Firestore, cannot delete.`);
       // If it doesn't exist in Firestore, no need to proceed.
       // Technically success=true as the end state (item gone) is achieved.
       return { success: true, message: `Item with ID ${itemId} not found or already deleted.` };
    } else {
        // Store the image URL if it exists
        imageUrlToDelete = docSnap.data()?.imageUrl;
    }

    // Delete Firestore document
    await deleteDoc(itemDocRef);
    console.log(`Successfully deleted Firestore document for item ID: ${itemId}`);

    // --- Delete Image from Storage ---
    if (imageUrlToDelete && storage) {
        console.log(`Attempting to delete image from Storage: ${imageUrlToDelete}`);
        try {
            const imageRefToDelete = storageRef(storage, imageUrlToDelete); // Get ref from URL
            await deleteObject(imageRefToDelete);
            console.log("Associated image deleted successfully from Storage.");
        } catch (storageError: any) {
             // Log storage error but don't fail the whole operation if Firestore delete succeeded
             console.warn(`Firestore document deleted, but failed to delete image from Storage (URL: ${imageUrlToDelete}):`, storageError);
             // If error is 'object-not-found', it's okay, maybe already deleted or URL was wrong
             if (storageError.code === 'storage/object-not-found') {
                console.log("Image was not found in Storage (might be already deleted or URL incorrect).");
                 return { success: true, message: "Item deleted successfully (image not found in storage)." };
             } else {
                // For other storage errors, inform the user but still report overall success
                return { success: true, message: "Item deleted, but failed to remove associated image from storage. Manual cleanup might be needed." };
             }
        }
    } else if (imageUrlToDelete) {
        console.warn("Item had an imageUrl, but Storage is not initialized. Cannot delete image.");
        // Inform user, but report success as Firestore doc is deleted
        return { success: true, message: "Item deleted, but Storage is not configured to remove the image." };
    }

    // Revalidate paths after successful deletion
    revalidatePath('/inventory');
    revalidatePath('/'); // Revalidate dashboard

    return { success: true, message: "Item and associated image (if applicable) deleted successfully." };

  } catch (error) {
    // --- Enhanced Error Logging for Firestore delete ---
    let errorMessage = "Failed to delete item due to a database error.";
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
                 // No need to check for 'not-found' here as we getDoc first
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

    // Firestore delete failed
    return {
      success: false,
      message: `${errorMessage}${errorCode !== 'UNKNOWN' ? ` (Code: ${errorCode})` : ''}. Please try again.`,
    };
  }
}