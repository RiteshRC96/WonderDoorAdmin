"use client"; // Make layout client component to use hooks

import type { Metadata } from 'next'; // Use type import
import { Inter } from 'next/font/google'; // Changed font to Inter for a cleaner look
import './globals.css';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation'; // Import usePathname
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
import { Home, Truck, Package, Box, LogOut } from 'lucide-react'; // Line-based icons
import { Toaster } from '@/components/ui/toaster'; // Import Toaster
import { LogoutButton } from '@/components/auth/logout-button'; // Import LogoutButton

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

// Metadata needs to be handled differently in Client Components or moved
// export const metadata: Metadata = {
//   title: 'Showroom Manager',
//   description: 'Manage your furniture showroom inventory, orders, and logistics.',
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          inter.variable
        )}
      >
        {isLoginPage ? (
          // Render only children for the login page, no sidebar/layout
          <>
            {children}
            <Toaster />
          </>
        ) : (
          // Render full layout for authenticated pages
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
                 {/* Logout button moved from here */}
              </SidebarFooter>
            </Sidebar>
            <SidebarInset>
                {/* Increased padding, added relative positioning for logout */}
               <div className="relative min-h-svh">
                 <header className="sticky top-0 z-30 flex h-14 items-center justify-end gap-4 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    {/* Logout button now in top-right header */}
                    <LogoutButton />
                 </header>
                 <main className="flex-1 p-6 md:p-8 lg:p-10">
                    {children}
                 </main>
              </div>
              <Toaster /> {/* Add Toaster for notifications */}
            </SidebarInset>
          </SidebarProvider>
        )}
      </body>
    </html>
  );
}
