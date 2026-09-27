const { test, expect } = require("@playwright/test");

test.use({ baseURL: "http://127.0.0.1:3003" });

test.describe("engineering parameter foundation", () => {
  test("browser runtime exposes contracts, profiles, calculator, and training catalog", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/dashboard/student/");
    await page.addScriptTag({ url: "/src/engineering/contracts.js" });
    await page.addScriptTag({ url: "/src/engineering/profiles.js" });
    await page.addScriptTag({ url: "/src/engineering/calculator.js" });
    await page.addScriptTag({ url: "/src/engineering/specifications.js" });
    await page.addScriptTag({ url: "/src/engineering/index.js" });

    const result = await page.evaluate(async () => {
      const current = window.TorqueMindEngineering.calculator.solveOhmsLaw({
        voltage: 12,
        resistance: 6
      });
      const power = window.TorqueMindEngineering.calculator.calculatePower({
        voltage: 12,
        current: current.value
      });
      const response = await fetch("/data/engineering/training-examples.json");
      const catalog = await response.json();
      const authoritativeResponse = await fetch("/data/engineering/authoritative-specifications/delco-remy-starting-charging.json");
      const authoritative = await authoritativeResponse.json();
      const selected50Mt = window.TorqueMindEngineering.specifications.selectMostSpecificSpecification(authoritative,{
        system:"starting",
        systemVoltage:12,
        starterFamily:"50MT",
        parameter:"starter_cable_total_voltage_drop"
      });

      return {
        current,
        power,
        valueRoles: window.TorqueMindEngineering.contracts.VALUE_ROLES,
        profileTypes: window.TorqueMindEngineering.profiles.PROFILE_TYPES,
        catalogRole: catalog.catalogRole,
        profileCount: catalog.profiles.length,
        authoritativeRole: authoritative.catalogRole,
        authoritativeCount: authoritative.specifications.length,
        selected50Mt
      };
    });

    expect(result.current.value).toBe(2);
    expect(result.current.valueRole).toBe("calculated_value");
    expect(result.power.value).toBe(24);
    expect(result.valueRoles).toContain("authoritative_specification");
    expect(result.profileTypes).toContain("conductor");
    expect(result.catalogRole).toBe("generic-training-examples");
    expect(result.profileCount).toBe(3);
    expect(result.authoritativeRole).toBe("authoritative-specifications");
    expect(result.authoritativeCount).toBe(14);
    expect(result.selected50Mt.id).toBe("delco-starter-total-drop-12v-50mt");
    expect(result.selected50Mt.quantity.value).toBe(0.4);
    expect(errors).toEqual([]);
  });
});
