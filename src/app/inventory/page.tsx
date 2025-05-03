import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card"; // Added CardDescription
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Filter, Search, Box } from "lucide-react"; // Added Box icon for placeholder
import Image from 'next/image';
import Link from 'next/link'; // Added Link for navigation

// Placeholder data - replace with actual data fetching
const inventoryItems = [
  { id: "1", name: "Modern Oak Door", style: "Modern", material: "Oak", dimensions: "36x80", stock: 15, price: 450, image: "https://picsum.photos/300/200", hint: "wood door" },
  { id: "2", name: "Classic Walnut Panel", style: "Classic", material: "Walnut", dimensions: "32x80", stock: 8, price: 620, image: "https://picsum.photos/300/200", hint: "panel door" },
  { id: "3", name: "Minimalist Pine Door", style: "Minimalist", material: "Pine", dimensions: "30x78", stock: 22, price: 300, image: "https://picsum.photos/300/200", hint: "simple door" },
  { id: "4", name: "Mid-Century Sofa", style: "Mid-Century", material: "Fabric", dimensions: "84x35x32", stock: 5, price: 1200, image: "https://picsum.photos/300/200", hint: "retro sofa" },
  { id: "5", name: "Industrial Coffee Table", style: "Industrial", material: "Metal, Wood", dimensions: "48x24x18", stock: 12, price: 350, image: "https://picsum.photos/300/200", hint: "metal table" },
];

export default function InventoryPage() {
  return (
    <div className="container mx-auto py-6 animate-subtle-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or SKU..." className="pl-10" />
        </div>
        <Select>
          <SelectTrigger className="w-full md:w-[180px]">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
            <SelectValue placeholder="Filter by Style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Styles</SelectItem>
            <SelectItem value="modern">Modern</SelectItem>
            <SelectItem value="classic">Classic</SelectItem>
            <SelectItem value="minimalist">Minimalist</SelectItem>
            <SelectItem value="mid-century">Mid-Century</SelectItem>
            <SelectItem value="industrial">Industrial</SelectItem>
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger className="w-full md:w-[180px]">
             <Filter className="mr-2 h-4 w-4 text-muted-foreground inline" />
            <SelectValue placeholder="Filter by Material" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Materials</SelectItem>
            <SelectItem value="oak">Oak</SelectItem>
            <SelectItem value="walnut">Walnut</SelectItem>
            <SelectItem value="pine">Pine</SelectItem>
            <SelectItem value="fabric">Fabric</SelectItem>
            <SelectItem value="metal">Metal</SelectItem>
            <SelectItem value="wood">Wood</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inventory Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {inventoryItems.map((item) => (
          <Card key={item.id} className="overflow-hidden transition-shadow duration-200 hover:shadow-lg group"> {/* Added group class */}
            <Link href={`/inventory/${item.id}`} className="block"> {/* Wrap Card content in Link */}
              <CardHeader className="p-0">
                <div className="relative h-48 w-full">
                  <Image
                    src={item.image}
                    alt={item.name}
                    layout="fill"
                    objectFit="cover"
                    data-ai-hint={item.hint}
                    className="transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <CardTitle className="text-lg mb-1">{item.name}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground mb-2">
                  {item.style} / {item.material}
                </CardDescription>
                <p className="text-sm">Dimensions: {item.dimensions}</p>
                <p className="text-sm">Stock: <span className={item.stock < 10 ? 'text-destructive font-medium' : ''}>{item.stock}</span></p>
                <p className="text-lg font-semibold mt-2">${item.price.toFixed(2)}</p>
              </CardContent>
               {/* Remove Button from CardFooter to make the whole card clickable */}
            </Link>
             {/* Optionally keep a footer for actions if needed, but link is above */}
             {/* <CardFooter className="p-4 pt-0">
               <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/inventory/${item.id}`}>View Details</Link>
               </Button>
             </CardFooter> */}
          </Card>
        ))}
      </div>
       {/* Placeholder for when no items match filter/search */}
       {inventoryItems.length === 0 && (
         <div className="text-center py-12 text-muted-foreground col-span-full"> {/* Ensure placeholder spans full width */}
           <Box className="mx-auto h-12 w-12 mb-4" />
           <p>No inventory items found matching your criteria.</p>
         </div>
       )}
    </div>
  );
}
