#!/usr/bin/env node
const { OrpheusPlugin } = require("../sdk/javascript/sdk");

new OrpheusPlugin()
  .addHook("on_init", async (_params, { callHost }) => {
    await callHost("notify_user", { message: "Example plugin initialized" });
  })
  .addHook("on_user_message", (message) => ({
    ...message,
    content: typeof message.content === "string"
      ? message.content.toUpperCase()
      : message.content.map((block) => block.type === "text"
        ? { ...block, text: { ...block.text, text: block.text.text.toUpperCase() } }
        : block),
  }))
  .addTool("echo", "Echo text back to the assistant.", {
      type: "object",
      properties: { text: { type: "string", description: "Text to echo." } },
      required: ["text"],
      additionalProperties: false,
    }, ({ text }) => text)
  .start();
