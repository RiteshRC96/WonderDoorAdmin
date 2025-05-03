"use client";

import * as React from "react";
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Eye } from 'lucide-react'; // Added Eye icon
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
import { Badge } from "@/components/ui/badge"; // Import Badge
import { cn } from "@/lib/utils"; // Import cn utility

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
  const isLowStock = item.stock < 10;

  const handleDelete = async (event: React.MouseEvent) => {
    event.preventDefault(); // Prevent link navigation when clicking delete
    event.stopPropagation(); // Stop event bubbling
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
    <Card className="overflow-hidden transition-shadow duration-300 ease-in-out hover:shadow-xl group relative flex flex-col h-full">
       <Link href={`/inventory/${item.id}`} className="block flex-grow">
        <CardHeader className="p-0">
          <div className="relative h-52 w-full overflow-hidden"> {/* Increased height, added overflow hidden */}
            <Image
              src={item.imageUrl || `https://picsum.photos/seed/${item.id}/400/300`} // Fallback image
              alt={item.name}
              layout="fill"
              objectFit="cover"
              data-ai-hint={item.imageHint || 'product item'}
              className="transition-transform duration-300 ease-in-out group-hover:scale-105"
            />
            {/* Overlay for View Details button */}
             <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
               <Button variant="outline" size="sm" className="bg-white/80 hover:bg-white text-foreground">
                 <Eye className="mr-2 h-4 w-4"/> View Details
               </Button>
             </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pb-2 flex-grow"> {/* Adjust padding, make content grow */}
          <CardTitle className="text-lg mb-1 line-clamp-1">{item.name}</CardTitle> {/* Clamp long names */}
          <CardDescription className="text-sm text-muted-foreground mb-2">
            {item.style} / {item.material}
          </CardDescription>
          <div className="text-sm text-muted-foreground mb-1">SKU: {item.sku}</div>
          <div className="text-sm text-muted-foreground">Dim: {item.dimensions}</div>
           {/* Stock Badge */}
           <div className="mt-2">
              <Badge variant={isLowStock ? "destructive" : "secondary"}>
                 Stock: {item.stock} units {isLowStock ? '(Low)' : ''}
               </Badge>
           </div>
        </CardContent>
      </Link>

       {/* Footer: Price and Delete Button */}
       <CardFooter className="p-4 pt-2 flex justify-between items-center border-t mt-auto"> {/* Added border-t and mt-auto */}
           <p className="text-xl font-bold text-primary">${item.price?.toFixed(2) || 'N/A'}</p>
         <AlertDialog>
           <AlertDialogTrigger asChild>
              <Button
                 variant="ghost"
                 size="icon"
                 className={cn(
                    "text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 rounded-full", // Rounded icon button
                    isDeleting && "text-destructive" // Keep icon red while deleting
                 )}
                 disabled={isDeleting}
                 aria-label="Delete item"
                 onClick={(e) => { e.stopPropagation(); }} // Prevent link navigation
               >
                 {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
               </Button>
           </AlertDialogTrigger>
           <AlertDialogContent>
             <AlertDialogHeader>
               <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
               <AlertDialogDescription>
                 This action cannot be undone. This will permanently delete the item
                 &quot;{item.name}&quot; ({item.sku}) from the inventory.
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
                 Delete Item
               </AlertDialogAction>
             </AlertDialogFooter>
           </AlertDialogContent>
         </AlertDialog>
       </CardFooter>
    </Card>
  );
}
