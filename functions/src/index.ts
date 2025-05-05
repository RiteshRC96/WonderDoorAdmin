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

    console.log(`New order ${orderId} detected. Decreasing inventory...`);

    if (!orderData || !orderData.items || orderData.items.length === 0) {
      console.log(`Order ${orderId} has no items. No stock decrease needed.`);
      return null;
    }

    // Use a transaction for atomic updates
    return db.runTransaction(async (transaction) => {
      const updatePromises: Promise<void>[] = [];

      for (const item of orderData.items) {
        // Use 'doorId' to match the inventory item ID
        const inventoryItemId = item.doorId;
        const orderedQuantity = item.quantity;

        if (!inventoryItemId || typeof orderedQuantity !== 'number' || orderedQuantity <= 0) {
          console.warn(`Skipping item stock decrease in order ${orderId}: Invalid doorId (${inventoryItemId}) or quantity (${orderedQuantity}).`);
          continue;
        }

        const inventoryItemRef = db.collection("inventory").doc(inventoryItemId);

        try {
            const inventoryDoc = await transaction.get(inventoryItemRef);

            if (!inventoryDoc.exists) {
              console.error(`Inventory item ${inventoryItemId} for order ${orderId} not found. Cannot decrease stock. Potential data inconsistency.`);
              // Decide how to handle: Continue? Throw error to fail transaction?
              // Continuing for now, but this should be monitored.
              continue;
            }

            const inventoryData = inventoryDoc.data();
            const currentStock = inventoryData?.stock;

            if (typeof currentStock !== 'number') {
               console.error(`Inventory item ${inventoryItemId} has invalid stock data (${currentStock}). Cannot decrease stock.`);
               continue; // Skip this item
            }

            const newStock = currentStock - orderedQuantity;

            if (newStock < 0) {
                // This should ideally be prevented by checks in the ordering system (Ecomm app)
                console.warn(`Order ${orderId} item ${inventoryItemId} quantity (${orderedQuantity}) exceeds current stock (${currentStock}). Setting stock to 0.`);
                 updatePromises.push(
                   transaction.update(inventoryItemRef, {
                     stock: 0,
                     // Consider adding an 'outOfStock' flag or similar
                     updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                   })
                 );
            } else {
                console.log(`Decreasing stock for inventory item ${inventoryItemId}: ${currentStock} -> ${newStock}`);
                updatePromises.push(
                  transaction.update(inventoryItemRef, {
                    stock: newStock,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  })
                );
            }
        } catch (error) {
            console.error(`Error processing inventory item ${inventoryItemId} in transaction for order ${orderId}:`, error);
            // Throw the error to abort the transaction if any single item fails critically
            throw new Error(`Failed to process stock for item ${inventoryItemId}`);
        }
      } // end for loop

      await Promise.all(updatePromises);
      console.log(`Inventory successfully updated for new order ${orderId}.`);

    }).catch(error => {
      console.error(`Stock decrease transaction failed for order ${orderId}:`, error);
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
      console.log(`Order ${orderId} cancelled. Restocking inventory...`);

      if (!afterData.items || afterData.items.length === 0) {
        console.log(`Cancelled order ${orderId} has no items. No restock needed.`);
        return null;
      }

      // Use a transaction for atomic updates
      return db.runTransaction(async (transaction) => {
        const updatePromises: Promise<void>[] = [];

        for (const item of afterData.items) {
          const inventoryItemId = item.doorId; // Use doorId
          const orderedQuantity = item.quantity;

          if (!inventoryItemId || typeof orderedQuantity !== 'number' || orderedQuantity <= 0) {
            console.warn(`Skipping item restock in cancelled order ${orderId}: Invalid doorId (${inventoryItemId}) or quantity (${orderedQuantity}).`);
            continue;
          }

          const inventoryItemRef = db.collection("inventory").doc(inventoryItemId);

          try {
              const inventoryDoc = await transaction.get(inventoryItemRef);

              if (!inventoryDoc.exists) {
                // If item doesn't exist anymore, we can't restock it. Log an error.
                console.error(`Inventory item ${inventoryItemId} for cancelled order ${orderId} not found. Cannot restock.`);
                continue; // Skip this item
              }

              const inventoryData = inventoryDoc.data();
              const currentStock = inventoryData?.stock;

              if (typeof currentStock !== 'number') {
                 console.error(`Inventory item ${inventoryItemId} has invalid stock data (${currentStock}). Cannot restock.`);
                 continue; // Skip this item
              }

              const newStock = currentStock + orderedQuantity; // Add back the quantity

              console.log(`Restocking inventory item ${inventoryItemId}: ${currentStock} -> ${newStock}`);

              updatePromises.push(
                transaction.update(inventoryItemRef, {
                  stock: newStock,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(), // Use Admin SDK timestamp
                })
              );
          } catch (error) {
               console.error(`Error processing item ${inventoryItemId} in restock transaction for order ${orderId}:`, error);
               throw new Error(`Failed to process restock for item ${inventoryItemId}`);
          }
        } // end for loop

        await Promise.all(updatePromises);
        console.log(`Inventory successfully restocked for cancelled order ${orderId}.`);
      }).catch(error => {
        console.error(`Restock transaction failed for order ${orderId}:`, error);
        return null;
      });
    } else {
      // Status did not change to 'Cancelled' or other irrelevant update
      // console.log(`Order ${orderId} update detected, but not a cancellation to 'Cancelled'. No restock needed.`);
      return null;
    }
  });

