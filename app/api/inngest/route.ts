import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { tello } from "@/inngest/functions/tello";
import { helloWorld } from "@/inngest/functions/helloworld";
import { podcastProcessor } from "@/inngest/functions/podcast-processor";

// Create an API that serves Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    /* your functions will be passed here later! */
    tello,
    helloWorld,
    podcastProcessor
  ],
});