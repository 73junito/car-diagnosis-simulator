# Theoretical DC calculator (separate developmental page)

Open `calculator.html` alongside this folder's existing asset showcase. The new page is deliberately separate from Cline's instrument mock and does not depend on a simulated fault scenario or change the current dashboard navigation.

The browser bundle `calculator.bundle.js` is built from `src/calculator-entry.js` using esbuild and imports the **existing** `engine/circuitLabCalculations.js` logic without duplicating formulas. Rebuild after changes to either source:

```powershell
node -e "require('esbuild').buildSync({entryPoints:['dashboard/student/aut250-lab-assets/src/calculator-entry.js'],bundle:true,platform:'browser',format:'iife',target:'es2020',outfile:'dashboard/student/aut250-lab-assets/calculator.bundle.js'})"
```

The page accepts input explicitly when Calculate is selected, shows predictions with units, and permits an optional independent current measurement. Missing measurements and OEM criteria are declared unavailable. It makes no pass/fail determination, persists no data, and does not affect R1/R2 scenarios or student grades.

Automated unit tests cover calculations, boundaries, and page contracts. Human keyboard and screen-reader audits and deployment route verification are still required before declaring accessibility or student availability. Production access is not claimed.
