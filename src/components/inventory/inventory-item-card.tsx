"use client";

import * as React from "react";
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { deleteItemAction } from '@/app/inventory/actions'; // Import the delete action
import type { AddItemInput } from '@/schemas/inventory'; // Import the type for structure

// Expect createdAt as a string (ISO format) from the Server Component
interface InventoryItem extends Omit<AddItemInput, 'createdAt'> { // Omit potential createdAt from schema if it exists
  id: string;
  createdAt?: string; // Expecting ISO string
}

interface InventoryItemCardProps {
  item: InventoryItem;
}

export function InventoryItemCard({ item }: InventoryItemCardProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteItemAction(item.id);
      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        // Revalidation is handled by the action, no need to refresh here
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.message,
        });
      }
    } catch (error) {
      console.error("Delete item error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred while deleting the item.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="overflow-hidden transition-shadow duration-200 hover:shadow-lg group relative">
      <Link href={`/inventory/${item.id}`} className="block">
        <CardHeader className="p-0">
          <div className="relative h-48 w-full">
            <Image
              src={item.imageUrl || `https://picsum.photos/seed/${item.id}/300/200`} // Fallback image
              alt={item.name}
              layout="fill"
              objectFit="cover"
              data-ai-hint={item.imageHint || 'product item'}
              className="transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        </CardHeader>
        <CardContent className="p-4 pb-2"> {/* Adjust padding */}
          <CardTitle className="text-lg mb-1">{item.name}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground mb-2">
            {item.style} / {item.material}
          </CardDescription>
          <p className="text-sm">Dimensions: {item.dimensions}</p>
          <p className="text-sm">Stock: <span className={item.stock < 10 ? 'text-destructive font-medium' : ''}>{item.stock}</span></p>
          <p className="text-lg font-semibold mt-2">${item.price?.toFixed(2) || 'N/A'}</p>
        </CardContent>
      </Link>
       {/* Add Delete Button and Confirmation */}
       <CardFooter className="p-4 pt-2 flex justify-end"> {/* Adjust padding */}
         <AlertDialog>
           <AlertDialogTrigger asChild>
              <Button
                 variant="ghost"
                 size="icon"
                 className="text-destructive hover:bg-destructive/10 h-8 w-8"
                 disabled={isDeleting}
                 aria-label="Delete item"
               >
                 {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
               </Button>
           </AlertDialogTrigger>
           <AlertDialogContent>
             <AlertDialogHeader>
               <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
               <AlertDialogDescription>
                 This action cannot be undone. This will permanently delete the item
                 &quot;{item.name}&quot; from the inventory.
               </AlertDialogDescription>
             </AlertDialogHeader>
             <AlertDialogFooter>
               <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
               <AlertDialogAction
                 onClick={handleDelete}
                 disabled={isDeleting}
                 className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
               >
                 {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                 Delete
               </AlertDialogAction>
             </AlertDialogFooter>
           </AlertDialogContent>
         </AlertDialog>
       </CardFooter>
    </Card>
  );
}