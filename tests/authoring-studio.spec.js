const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

describe("authoring studio", () => {
  test("starts blank and loads user-authored scenario content behind auth", async () => {
    const htmlPath = path.join(process.cwd(), "dashboard", "author", "index.html");
    const jsPath = path.join(process.cwd(), "dashboard", "author", "author.js");

    const html = fs.readFileSync(htmlPath, "utf8");
    const script = fs.readFileSync(jsPath, "utf8");

    const dom = new JSDOM(html, {
      url: "http://localhost/dashboard/author",
      runScripts: "outside-only",
      pretendToBeVisual: true
    });

    dom.window.getAccessToken = () => "test-token";
    dom.window.apiGet = async (requestPath) => {
      if (requestPath === "/api/author/drafts?limit=100") return { drafts: [] };
      throw new Error("unexpected GET " + requestPath);
    };
    dom.window.apiPost = async () => { throw new Error("not expected"); };
    dom.window.apiPatch = async () => { throw new Error("not expected"); };
    dom.window.apiDelete = async () => { throw new Error("not expected"); };

    dom.window.eval(script);
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    const document = dom.window.document;

    expect(document.body.dataset.authoringStudioReady).toBe("true");
    expect(document.querySelector("#authorAccessStatus").textContent).toContain("Verified author");
    expect(document.querySelector("#previewTitle").textContent).toBe("Untitled Diagnostic Scenario");
    expect(document.querySelector("#previewVehicle").textContent).toBe("Not configured");
    expect(document.querySelector("#scenarioLibraryList").textContent).toContain("No saved drafts yet.");

    const initialJson = JSON.parse(document.querySelector("#scenarioJsonPreview").value);
    expect(initialJson.id).toBe("untitled-scenario");
    expect(initialJson.title).toBe("");
    expect(script).not.toContain("seedDemoData");
    expect(script).not.toContain("localStorage");

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
