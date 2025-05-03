import type {Metadata} from 'next';
import {Inter} from 'next/font/google'; // Changed font to Inter for a cleaner look
import './globals.css';
import { cn } from '@/lib/utils';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Home, Truck, Package, Box } from 'lucide-react'; // Line-based icons
import { Toaster } from '@/components/ui/toaster'; // Import Toaster

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Showroom Manager',
  description: 'Manage your furniture showroom inventory, orders, and logistics.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          inter.variable
        )}
      >
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>
              <div className="flex items-center gap-2 p-2">
                <Box className="h-6 w-6 text-primary" /> {/* Example icon */}
                <h1 className="text-lg font-semibold text-foreground group-data-[collapsible=icon]:hidden">
                  Showroom Manager
                </h1>
                 <div className="ml-auto flex items-center gap-1">
                  <SidebarTrigger className="ml-auto md:hidden" />
                 </div>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                 <SidebarMenuItem>
                   <SidebarMenuButton asChild>
                     <Link href="/">
                       <Home />
                       Dashboard
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                   <SidebarMenuButton asChild>
                     <Link href="/inventory">
                       <Box />
                       Inventory
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/orders">
                      <Package />
                      Orders
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/logistics">
                      <Truck />
                      Logistics
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
               {/* Footer content can be added here later if needed */}
            </SidebarFooter>
          </Sidebar>
          <SidebarInset>
            {/* Increased padding for better spacing within the main content area */}
            <main className="flex-1 p-6 md:p-8 lg:p-10">
              {children}
            </main>
            <Toaster /> {/* Add Toaster for notifications */}
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  );
}
