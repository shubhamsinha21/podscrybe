import { inngest } from "../client";

export const tello = inngest.createFunction(
    {id: "tello"},
    {event: "test/tello"},
    async ({event, step}) => {
        await step.sleep("wait-a-moment","1s");
        return {message: `Hello ${event.data.email}!` };
    }

)