"use strict";

const { createVehicleIdentity } = require("./contracts");

class VehicleIdentityResolver {
  constructor({ vinDecoder = null, cache = null } = {}) {
    this.vinDecoder = vinDecoder;
    this.cache = cache;
  }

  async resolve(input = {}) {
    const direct = createVehicleIdentity(input);

    if (!direct.vin || !this.vinDecoder) {
      return direct;
    }

    const cacheKey = "vehicle-identity:" + direct.vin;
    if (this.cache && typeof this.cache.get === "function") {
      const cached = await this.cache.get(cacheKey);
      if (cached) return createVehicleIdentity({ ...cached, source: cached.source || "cache" });
    }

    const decoded = await this.vinDecoder(direct.vin, { year: direct.year });
    const resolved = createVehicleIdentity({
      ...direct,
      ...decoded,
      vin: direct.vin,
      source: decoded.source || "nhtsa-vpic",
      match: decoded.match || "partial",
    });

    if (this.cache && typeof this.cache.set === "function") {
      await this.cache.set(cacheKey, resolved);
    }

    return resolved;
  }
}

module.exports = VehicleIdentityResolver;
