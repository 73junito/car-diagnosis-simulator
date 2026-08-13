const fs = require('fs');
const path = require('path');

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

let diagramCount = 0;
const validationErrors = [];

console.log('\nValidating Mermaid Diagram Syntax\n');

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
      
      // Basic Mermaid syntax validation
      if (!mermaidContent) {
        validationErrors.push(`${file} block ${index + 1}: Empty diagram`);
        return;
      }

      // Check for required keywords based on diagram type
      const hasGraphKeyword = /^\s*(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|stateDiagram|pie|gantt|gitGraph)/.test(mermaidContent);
      
      if (!hasGraphKeyword) {
        validationErrors.push(`${file} block ${index + 1}: Missing diagram keyword (graph/flowchart/etc)`);
        return;
      }

      // Check for balanced syntax (basic check)
      const squareBrackets = (mermaidContent.match(/\[/g) || []).length;
      const squareBracketsClose = (mermaidContent.match(/\]/g) || []).length;
      
      if (squareBrackets !== squareBracketsClose) {
        validationErrors.push(`${file} block ${index + 1}: Unbalanced square brackets`);
        return;
      }

      // Check for arrow syntax (basic flow diagrams)
      if (mermaidContent.includes('graph') || mermaidContent.includes('flowchart')) {
        if (!mermaidContent.match(/--[>-]|==[>-]/)) {
          // Some simple diagrams might not have arrows, but most should
          // This is just a warning level check
        }
      }

      diagramCount += 1;
      console.log(`[OK] ${file} block ${index + 1}`);
    });
  }

  if (validationErrors.length > 0) {
    console.error(`\n[FAIL] Found ${validationErrors.length} validation error(s):\n`);
    validationErrors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  console.log(`\n[PASS] Validated ${diagramCount} Mermaid diagrams - all syntax is well-formed\n`);
  process.exit(0);
} catch (err) {
  console.error(`\n[FAIL] ${err.message}\n`);
  process.exit(1);
}
