
"use server";

import { cookies } from "next/headers";
import { z } from "zod";

// Hardcoded credentials (NOT RECOMMENDED FOR PRODUCTION)
const ADMIN_USERNAME = "admin@wonderDoors";
const ADMIN_PASSWORD = "admin@123"; // Store passwords securely in real apps

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

type LoginInput = z.infer<typeof loginSchema>;

export async function loginAction(
  values: LoginInput
): Promise<{ success: boolean; message: string }> {
  // Basic validation (more robust validation can be added)
  if (!values.username || !values.password) {
    return { success: false, message: "Username and password are required." };
  }

  // Check credentials
  if (
    values.username === ADMIN_USERNAME &&
    values.password === ADMIN_PASSWORD
  ) {
    // Set a session cookie (simple example, consider more secure methods)
    const cookieStore = cookies();
    cookieStore.set("session-token", "user-logged-in", {
      // httpOnly: true, // Recommended for security, but needs API route/server component for JS access check
      // secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      // sameSite: 'strict', // Protect against CSRF
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });

    console.log("Login action: Credentials valid, setting cookie.");
    return { success: true, message: "Login successful!" };
  } else {
    console.log("Login action: Invalid credentials.");
    return { success: false, message: "Invalid username or password." };
  }
}

export async function logoutAction(): Promise<void> {
    console.log("Logout action: Clearing session cookie.");
    const cookieStore = cookies();
    cookieStore.delete('session-token');
    // No need to redirect here, client-side will handle after action completes
}
