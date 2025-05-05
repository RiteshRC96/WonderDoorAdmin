// Add this to functions/src/index.ts

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
          const inventoryItemId = item.doorId;
          const orderedQuantity = item.quantity;

          if (!inventoryItemId || orderedQuantity <= 0) {
            console.warn(`Skipping item restock in cancelled order ${orderId}: Invalid itemId or quantity.`);
            continue;
          }

          const inventoryItemRef = db.collection("inventory").doc(inventoryItemId);
          const inventoryDoc = await transaction.get(inventoryItemRef);

          if (!inventoryDoc.exists) {
            console.error(`Inventory item ${inventoryItemId} for cancelled order ${orderId} not found. Cannot restock.`);
            continue;
          }

          const inventoryData = inventoryDoc.data();
          const currentStock = inventoryData?.stock;

          if (typeof currentStock !== 'number') {
             console.error(`Inventory item ${inventoryItemId} has invalid stock data. Cannot restock.`);
             continue;
          }

          const newStock = currentStock + orderedQuantity; // Add back the quantity

          console.log(`Restocking item ${inventoryItemId}: ${currentStock} -> ${newStock}`);

          updatePromises.push(
            transaction.update(inventoryItemRef, {
              stock: newStock,
              // updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            })
          );
        }
        await Promise.all(updatePromises);
        console.log(`Inventory successfully restocked for cancelled order ${orderId}.`);
      }).catch(error => {
        console.error(`Restock transaction failed for order ${orderId}:`, error);
        return null;
      });
    } else {
      // Status did not change to 'Cancelled'
      return null;
    }
  });
