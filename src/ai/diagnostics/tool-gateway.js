"use strict";

const { createToolResult } = require("./contracts");

class ToolGateway {
  constructor() {
    this.adapters = new Map();
  }

  register(adapter) {
    if (!adapter || typeof adapter.id !== "string" || !adapter.id.trim()) {
      throw new Error("Tool adapter requires a non-empty id");
    }
    if (typeof adapter.execute !== "function") {
      throw new Error("Tool adapter " + adapter.id + " requires execute()");
    }
    if (this.adapters.has(adapter.id)) {
      throw new Error("Tool adapter " + adapter.id + " is already registered");
    }
    this.adapters.set(adapter.id, adapter);
    return adapter;
  }

  async execute(id, input = {}, context = {}) {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error("Unknown tool adapter " + id);

    const result = await adapter.execute(input, context);
    return createToolResult({
      tool: id,
      sourceType: adapter.sourceType || id,
      retrievedAt: result.retrievedAt,
      vehicleMatch: result.vehicleMatch,
      canonicalUrl: result.canonicalUrl,
      cacheStatus: result.cacheStatus,
      normalizedData: result.normalizedData,
    });
  }

  list() {
    return Array.from(this.adapters.keys()).sort();
  }
}

module.exports = ToolGateway;
