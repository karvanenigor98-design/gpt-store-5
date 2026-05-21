#!/usr/bin/env node
/**
 * Устаревший алиас — предпочтительно: npm run dev:subs (3055) или npm run dev:gpt (3056).
 */
process.env.PORT = process.env.PORT || "3055";
process.env.GPT_STORE_STRICT_PORT = "1";
require("./run-next-dev.js");
