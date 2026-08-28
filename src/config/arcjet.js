import arcjet, { shield, detectBot, slidingWindow } from "@arcjet/node";


const aj = arcjet({
    // Get your site key from https://console.arcjet.com and set it as an environment
    // variable rather than hard coding.
    key: process.env.ARCJET_KEY,
    rules: [
        // Shield protects your app from common attacks e.g. SQL injection
        shield({ mode: "LIVE" }),
        // Create a bot detection rule
        detectBot({
            mode: "LIVE", // Blocks requests. Use "DRY_RUN" to log only
            // Block all bots except the following
            allow: [
                "CATEGORY:SEARCH_ENGINE",
                "CATEGORY:PREVIEW",// Google, Bing, etc

            ],
        }),
        slidingWindow({
            mode: "LIVE",
                interval: '2s',
                max: 5,
        })
    ],
});

export default aj;