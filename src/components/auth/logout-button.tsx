"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { logoutAction } from "@/app/login/actions"; // Import the logout action
import { LogOut, Loader2 } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutAction();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
       // Force a refresh to ensure middleware redirects to login
      router.refresh();
      // Explicitly push to login just in case refresh/middleware doesn't trigger immediately
      router.push('/login');
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "An error occurred while logging out.",
      });
       setIsLoggingOut(false); // Reset loading state on error
    }
    // No need to reset loading state on success as page will redirect

  };

  return (
    <Button
      variant="ghost" // Keep ghost variant for subtle look
      size="sm"
      onClick={handleLogout}
      disabled={isLoggingOut}
      // Removed w-full and sidebar-specific styles
      className="text-foreground/80 hover:text-foreground hover:bg-accent"
    >
      {isLoggingOut ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="mr-2 h-4 w-4" />
      )}
      {isLoggingOut ? "Logging out..." : "Logout"}
    </Button>
  );
}
