"use strict";

const DEFAULT_ALLOWED_TOOLS = Object.freeze(["circuit-engine", "electrical-measurement"]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error("Tool execution timed out");
        error.code = "tool_timeout";
        reject(error);
      }, timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

async function executeBoundedTool({
  gateway,
  toolId,
  input = {},
  context = {},
  allowedTools = DEFAULT_ALLOWED_TOOLS,
  maxAttempts = 1,
  timeoutMs = 2500,
  onEvent = null
} = {}) {
  if (!gateway || typeof gateway.execute !== "function") {
    throw new Error("bounded tool execution requires a tool gateway");
  }
  if (!allowedTools.includes(toolId)) {
    const error = new Error("Tool is not allowlisted");
    error.code = "tool_not_allowed";
    throw error;
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 2) {
    throw new Error("maxAttempts must be 1 or 2");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 5000) {
    throw new Error("timeoutMs must be between 250 and 5000");
  }

  const emit = async (eventType, event = {}) => {
    if (typeof onEvent === "function") {
      await onEvent({ eventType, ...event });
    }
  };

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await emit("attempt_started", { attempt, toolId });

    try {
      const result = await withTimeout(
        gateway.execute(toolId, input, context),
        timeoutMs
      );
      await emit("attempt_succeeded", { attempt, toolId });
      return {
        status: "succeeded",
        toolId,
        attemptCount: attempt,
        result
      };
    } catch (error) {
      lastError = error;
      const code = error && error.code ? String(error.code) : "tool_execution_failed";
      await emit("attempt_failed", {
        attempt,
        toolId,
        errorCode: code
      });
      if (attempt < maxAttempts) await delay(25);
    }
  }

  const failure = new Error(lastError?.message || "Tool execution failed");
  failure.code = lastError?.code || "tool_execution_failed";
  failure.attemptCount = maxAttempts;
  throw failure;
}

module.exports = {
  DEFAULT_ALLOWED_TOOLS,
  executeBoundedTool
};
