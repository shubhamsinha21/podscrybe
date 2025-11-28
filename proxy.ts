import { auth, clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// protectedRoutes with routematcher
// if anyone goes to dashboard and forward, they need to login first or signup (if not)
const protectedRoutes = createRouteMatcher(["/dashboard(.*)"]) 

export default clerkMiddleware(async(auth, req)=> {
    if (protectedRoutes(req)) {
        await auth.protect() // we throw an offscreen in front of them to signup/login
    }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}