"use client";

import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set")
}

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProviderWithClerk client={convex} useAuth={useAuth}> {children} 
  </ConvexProviderWithClerk>
}