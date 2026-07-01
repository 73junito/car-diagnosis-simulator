const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

describe("authoring studio", () => {
  test("loads demo scenario preview and JSON export scaffold", async () => {
    const htmlPath = path.join(process.cwd(), "dashboard", "author", "index.html");
    const jsPath = path.join(process.cwd(), "dashboard", "author", "author.js");

    const html = fs.readFileSync(htmlPath, "utf8");
    const script = fs.readFileSync(jsPath, "utf8");

    const dom = new JSDOM(html, {
      url: "http://localhost/dashboard/author",
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true
    });

    dom.window.eval(script);
    dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));

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
  });
});
