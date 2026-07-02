const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

describe("authoring studio", () => {
  test("loads demo scenario preview and JSON export scaffold", () => {
    const htmlPath = path.join(process.cwd(), "dashboard", "author", "index.html");
    const jsPath = path.join(process.cwd(), "dashboard", "author", "author.js");

    const html = fs.readFileSync(htmlPath, "utf8");
    const script = fs.readFileSync(jsPath, "utf8");

    const dom = new JSDOM(html, {
      url: "http://localhost/dashboard/author",
      runScripts: "outside-only",
      pretendToBeVisual: true
    });

    dom.window.eval(script);

    const document = dom.window.document;

    expect(document.body.dataset.authoringStudioReady).toBe("true");
    expect(document.querySelector("#previewTitle").textContent).toContain("No-start after overnight soak");
    expect(document.querySelector("#previewVehicle").textContent).toContain("2018 Ford F-150");
    expect(document.querySelector("#previewDtcs").textContent).toContain("P0335");
    expect(document.querySelector("#previewLiveData").textContent).toContain("12.1V");
    expect(document.querySelector("#previewAse").textContent).toContain("A8 Engine Performance");

    const json = JSON.parse(document.querySelector("#scenarioJsonPreview").value);
    expect(json.id).toBe("no-start-after-overnight-soak");
    expect(json.vehicle.make).toBe("Ford");
    expect(json.evidence.dtcs[0].code).toBe("P0335");
    expect(json.rubric.aseArea).toBe("A8 Engine Performance");

    const checklist = Array.from(document.querySelectorAll("#validationChecklist li"));
    expect(checklist).toHaveLength(5);
    expect(checklist.every((item) => item.dataset.valid === "true")).toBe(true);

    const importedScenario = {
      title: "Imported EVAP leak scenario",
      vehicle: {
        year: "2020",
        make: "Toyota",
        model: "Camry",
        engine: "2.5L",
        mileage: "61500",
        system: "Engine Performance"
      },
      complaint: {
        customer: "Customer states the check engine light is on after refueling."
      },
      evidence: {
        dtcs: [{ code: "P0455", description: "EVAP System Large Leak" }],
        freezeFrame: "Fuel level 86%, ambient 72°F.",
        liveData: {
          rpm: "720",
          voltage: "13.8",
          coolant: "190°F",
          fuelTrim: "+4%"
        }
      },
      diagnosticPath: {
        initialTest: "Inspect fuel cap and EVAP hoses",
        expectedFinding: "Loose fuel cap seal",
        rootCause: "Loose fuel cap",
        recommendedRepair: "Tighten or replace fuel cap and run EVAP monitor."
      },
      rubric: {
        aseArea: "A8 Engine Performance",
        safety: "Uses safe EVAP testing procedures.",
        diagnosis: "Confirms leak before repair.",
        verification: "Verifies monitor readiness."
      }
    };

    dom.window.TorqueMindAuthoring.loadScenario(importedScenario);

    expect(document.querySelector("#previewTitle").textContent).toContain("Imported EVAP leak scenario");
    expect(document.querySelector("#previewVehicle").textContent).toContain("2020 Toyota Camry");
    expect(document.querySelector("#previewDtcs").textContent).toContain("P0455");
    expect(document.querySelector("#previewLiveData").textContent).toContain("13.8V");

    const importedJson = JSON.parse(document.querySelector("#scenarioJsonPreview").value);
    expect(importedJson.id).toBe("imported-evap-leak-scenario");
    expect(importedJson.vehicle.make).toBe("Toyota");
    expect(importedJson.evidence.dtcs[0].code).toBe("P0455");

    dom.window.close();
  });
});

