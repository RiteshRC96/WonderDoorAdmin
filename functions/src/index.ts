// functions/src/index.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

try {
    admin.initializeApp();
    console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
    // If initialization fails, subsequent function executions might fail.
}


const db = admin.firestore();

// --- Function to DECREASE stock when an order is CREATED ---
// This function will now be triggered whenever *any* new order document is created
// in the 'orders' collection, including orders placed from your E-commerce app.
export const decreaseInventoryOnOrderCreate = functions.firestore
  .document("orders/{orderId}")
  .onCreate(async (snap, context) => {
    const orderData = snap.data();
    const orderId = context.params.orderId;

    console.log(`[Order: ${orderId}] New order detected. Processing stock decrease...`);

    if (!orderData || !orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      console.log(`[Order: ${orderId}] Order has no valid items array. No stock decrease needed.`);
      return null;
    }

    console.log(`[Order: ${orderId}] Found ${orderData.items.length} item(s) in the order.`);

    // Use a transaction for atomic updates
    return db.runTransaction(async (transaction) => {
      const updatePromises: Promise<void>[] = [];

      for (const [index, item] of orderData.items.entries()) {
        console.log(`[Order: ${orderId}] Processing item ${index + 1}/${orderData.items.length}...`);

        // Use 'doorId' to match the inventory item ID
        const inventoryItemId = item.doorId;
        const orderedQuantity = item.quantity;

        console.log(`[Order: ${orderId}] Item ${index + 1}: Attempting to use doorId: '${inventoryItemId}', quantity: ${orderedQuantity}`);

        if (!inventoryItemId || typeof inventoryItemId !== 'string' || inventoryItemId.trim() === '') {
          console.warn(`[Order: ${orderId}] Item ${index + 1}: Skipping stock decrease due to invalid or missing doorId.`);
          continue;
        }
         if (typeof orderedQuantity !== 'number' || !Number.isInteger(orderedQuantity) || orderedQuantity <= 0) {
           console.warn(`[Order: ${orderId}] Item ${index + 1} (doorId: ${inventoryItemId}): Skipping stock decrease due to invalid quantity: ${orderedQuantity}. Must be a positive integer.`);
           continue;
         }

        const inventoryItemRef = db.collection("inventory").doc(inventoryItemId);

        try {
            console.log(`[Order: ${orderId}] Item ${index + 1}: Getting inventory document: inventory/${inventoryItemId}`);
            const inventoryDoc = await transaction.get(inventoryItemRef);

            if (!inventoryDoc.exists) {
              console.error(`[Order: ${orderId}] Item ${index + 1}: Inventory item '${inventoryItemId}' not found in 'inventory' collection. Cannot decrease stock. Check if doorId is correct.`);
              // Decide how to handle: Continue? Throw error to fail transaction?
              // Continuing for now, but this should be monitored.
              continue;
            }

            const inventoryData = inventoryDoc.data();
            const currentStock = inventoryData?.stock;

            console.log(`[Order: ${orderId}] Item ${index + 1} (doorId: ${inventoryItemId}): Found inventory item. Current stock: ${currentStock}`);

            if (typeof currentStock !== 'number' || !Number.isInteger(currentStock)) {
               console.error(`[Order: ${orderId}] Item ${index + 1} (doorId: ${inventoryItemId}): Inventory item has invalid stock data type or value: ${currentStock}. Cannot decrease stock.`);
               continue; // Skip this item
            }

            const newStock = currentStock - orderedQuantity;

            if (newStock < 0) {
                // This should ideally be prevented by checks in the ordering system (Ecomm app)
                console.warn(`[Order: ${orderId}] Item ${index + 1} (doorId: ${inventoryItemId}): Order quantity (${orderedQuantity}) exceeds current stock (${currentStock}). Setting stock to 0.`);
                 updatePromises.push(
                   transaction.update(inventoryItemRef, {
                     stock: 0,
                     // Consider adding an 'outOfStock' flag or similar
                     updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                   })
                 );
            } else {
                console.log(`[Order: ${orderId}] Item ${index + 1} (doorId: ${inventoryItemId}): Decreasing stock from ${currentStock} to ${newStock}.`);
                updatePromises.push(
                  transaction.update(inventoryItemRef, {
                    stock: newStock,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  })
                );
            }
        } catch (error) {
            console.error(`[Order: ${orderId}] Item ${index + 1} (doorId: ${inventoryItemId}): Error processing item in transaction:`, error);
            // Throw the error to abort the transaction if any single item fails critically
            throw new Error(`[Order: ${orderId}] Failed to process stock for item ${inventoryItemId}`);
        }
      } // end for loop

      await Promise.all(updatePromises);
      console.log(`[Order: ${orderId}] Transaction committed. Inventory successfully updated for new order.`);

    }).catch(error => {
      console.error(`[Order: ${orderId}] Stock decrease transaction failed:`, error);
      // Consider adding retry logic or logging for monitoring
      return null; // Indicate failure, but don't crash the function execution unless necessary
    });
  });


// --- Existing Function to RESTOCK inventory when an order is CANCELLED ---
// Ensure this function also uses 'doorId' correctly.
export const restockInventoryOnOrderCancel = functions.firestore
  .document("orders/{orderId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const orderId = context.params.orderId;

    // Check if status changed to 'Cancelled'
    if (beforeData?.status !== 'Cancelled' && afterData?.status === 'Cancelled') {
      console.log(`[Order: ${orderId}] Order status changed to 'Cancelled'. Processing inventory restock...`);

      if (!afterData.items || !Array.isArray(afterData.items) || afterData.items.length === 0) {
        console.log(`[Order: ${orderId}] Cancelled order has no valid items array. No restock needed.`);
        return null;
      }
       console.log(`[Order: ${orderId}] Found ${afterData.items.length} item(s) in the cancelled order.`);

      // Use a transaction for atomic updates
      return db.runTransaction(async (transaction) => {
        const updatePromises: Promise<void>[] = [];

        for (const [index, item] of afterData.items.entries()) {
           console.log(`[Order: ${orderId}] Processing item ${index + 1}/${afterData.items.length} for restock...`);
          const inventoryItemId = item.doorId; // Use doorId
          const orderedQuantity = item.quantity;

          console.log(`[Order: ${orderId}] Item ${index + 1}: Attempting restock for doorId: '${inventoryItemId}', quantity: ${orderedQuantity}`);

          if (!inventoryItemId || typeof inventoryItemId !== 'string' || inventoryItemId.trim() === '') {
            console.warn(`[Order: ${orderId}] Item ${index + 1}: Skipping restock due to invalid or missing doorId.`);
            continue;
          }
           if (typeof orderedQuantity !== 'number' || !Number.isInteger(orderedQuantity) || orderedQuantity <= 0) {
             console.warn(`[Order: ${orderId}] Item ${index + 1} (doorId: ${inventoryItemId}): Skipping restock due to invalid quantity: ${orderedQuantity}. Must be a positive integer.`);
             continue;
           }

          const inventoryItemRef = db.collection("inventory").doc(inventoryItemId);

          try {
              console.log(`[Order: ${orderId}] Item ${index + 1}: Getting inventory document: inventory/${inventoryItemId}`);
              const inventoryDoc = await transaction.get(inventoryItemRef);

              if (!inventoryDoc.exists) {
                // If item doesn't exist anymore, we can't restock it. Log an error.
                console.error(`[Order: ${orderId}] Item ${index + 1}: Inventory item '${inventoryItemId}' not found in 'inventory' collection. Cannot restock.`);
                continue; // Skip this item
              }

              const inventoryData = inventoryDoc.data();
              const currentStock = inventoryData?.stock;

              console.log(`[Order: ${orderId}] Item ${index + 1} (doorId: ${inventoryItemId}): Found inventory item. Current stock: ${currentStock}`);

              if (typeof currentStock !== 'number' || !Number.isInteger(currentStock)) {
                 console.error(`[Order: ${orderId}] Item ${index + 1} (doorId: ${inventoryItemId}): Inventory item has invalid stock data type or value: ${currentStock}. Cannot restock.`);
                 continue; // Skip this item
              }

              const newStock = currentStock + orderedQuantity; // Add back the quantity

              console.log(`[Order: ${orderId}] Item ${index + 1} (doorId: ${inventoryItemId}): Restocking inventory from ${currentStock} to ${newStock}.`);

              updatePromises.push(
                transaction.update(inventoryItemRef, {
                  stock: newStock,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(), // Use Admin SDK timestamp
                })
              );
          } catch (error) {
               console.error(`[Order: ${orderId}] Item ${index + 1} (doorId: ${inventoryItemId}): Error processing item in restock transaction:`, error);
               throw new Error(`[Order: ${orderId}] Failed to process restock for item ${inventoryItemId}`);
          }
        } // end for loop

        await Promise.all(updatePromises);
        console.log(`[Order: ${orderId}] Transaction committed. Inventory successfully restocked for cancelled order.`);
      }).catch(error => {
        console.error(`[Order: ${orderId}] Restock transaction failed:`, error);
        return null;
      });
    } else {
      // Status did not change to 'Cancelled' or other irrelevant update
      // console.log(`Order ${orderId} update detected, but not a cancellation to 'Cancelled'. No restock needed.`);
      return null;
    }
  });

    