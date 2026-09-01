const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const files = [
  'dashboard/student/ARCHITECTURE.md',
  'dashboard/student/scenario/WORKFLOW.md',
  'torquemind-api/ARCHITECTURE.md',
  'data/QUESTION-LIFECYCLE.md',
  'scripts/CITATION-VALIDATOR.md',
  'supabase/DATABASE-ARCHITECTURE.md',
  'db/migrations/MIGRATION-FLOW.md',
  'tests/playwright/TEST-FLOWS.md',
  'docs/SYSTEM-ARCHITECTURE.md'
];

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mermaid-verify-'));
let diagramCount = 0;
const errors = [];

console.log('\nRendering Mermaid Diagrams via mermaid-cli\n');

try {
  for (const file of files) {
    if (!fs.existsSync(file)) {
      throw new Error(`Required architecture file missing: ${file}`);
    }

    const content = fs.readFileSync(file, 'utf8');
    const blocks = [...content.matchAll(/```mermaid\s*([\s\S]*?)```/g)];

    if (blocks.length === 0) {
      throw new Error(`No Mermaid block found: ${file}`);
    }

    blocks.forEach((block, index) => {
      const mermaidContent = block[1].trim();
      const fileName = path.basename(file, '.md');
      const inputFile = path.join(tempDir, `${fileName}-${index}.mmd`);
      const outputFile = path.join(tempDir, `${fileName}-${index}.svg`);

      // Write the Mermaid diagram to .mmd file
      fs.writeFileSync(inputFile, mermaidContent);

      // Render using local mmdc (mermaid CLI)
      try {
        const mmdcPath = path.join(process.cwd(), 'node_modules', '.bin', 'mmdc');
        const cmd = `"${mmdcPath}" -i "${inputFile}" -o "${outputFile}"`;
        execSync(cmd, { stdio: 'pipe', shell: true });
      } catch (err) {
        errors.push(`${file} block ${index + 1}: mermaid-cli failed - ${err.message}`);
        return;
      }

      // Verify SVG output exists and is non-empty
      if (!fs.existsSync(outputFile)) {
        errors.push(`${file} block ${index + 1}: SVG output not created`);
        return;
      }

      const svgSize = fs.statSync(outputFile).size;
      if (svgSize === 0) {
        errors.push(`${file} block ${index + 1}: SVG output is empty`);
        return;
      }

      // Verify SVG contains expected SVG markup
      const svgContent = fs.readFileSync(outputFile, 'utf8');
      if (!svgContent.includes('<svg')) {
        errors.push(`${file} block ${index + 1}: SVG output does not contain valid SVG markup`);
        return;
      }

      diagramCount += 1;
      console.log(`[OK] ${file} block ${index + 1} → ${svgSize} bytes`);
    });
  }

  if (errors.length > 0) {
    console.error(`\n[FAIL] ${errors.length} diagram(s) failed to render:\n`);
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  console.log(`\n[PASS] Successfully rendered ${diagramCount} Mermaid diagrams to SVG\n`);
  process.exit(0);
} catch (err) {
  console.error(`\n[FAIL] ${err.message}\n`);
  process.exit(1);
} finally {
  // Clean up temp directory
  fs.rmSync(tempDir, { recursive: true, force: true });
}
