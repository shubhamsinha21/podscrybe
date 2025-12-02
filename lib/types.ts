/*

Shared type definitions used across the application

Phase status for processing workflow 
- used by ui components to display current processing state
- matches. conves schema jobStatus field
- status updates flow from Inngest -> Convex -> UI (via subscriptions)
*/

export type PhaseStatus = "pending" | "running" | "completed" | "failed";

/*
upload status for file uploads
*/

export type Uploadstatus = 
| "idle"
| "uploading"
| "processing"
| "completed"
| "error"