# TorqueMind — Diagnostic Training Platform

TorqueMind is a lightweight browser-based training platform for automotive diagnostic reasoning. It provides evidence-driven scenarios, system isolation workflows, and teacher analytics to help trainees build reliable troubleshooting skills.
TorqueMind is a lightweight browser-based training platform for automotive diagnostic reasoning. It provides evidence-driven scenarios, system isolation workflows, and teacher analytics to help trainees build reliable troubleshooting skills.

Overview
TorqueMind helps technicians and instructors practice evidence-based diagnostic reasoning using realistic vehicle scenarios. Students collect evidence, isolate systems, and make confidence-weighted diagnoses while instructors get aggregated insights.

Features
- Scenario-based diagnostic exercises with simulated tools
- System isolation and evidence tracking for structured reasoning
- Confidence-weighted decisions and instant feedback
- Teacher dashboard with exports, insights, and scenario assignment

Demo
Visit the live demo: https://car-diagnosis-simulator.vercel.app/

Run locally
```bash
cd "d:/Car Diagnosis Simulator/car-diagnosis-sim"
python -m http.server 8000
# open http://localhost:8000 in your browser
```

Development notes
- The app is a single-page static site (HTML/CSS/JS). No build step required.
- Diagnostic logic lives in `engine/diagnosticEngine.js` and is loaded before `script.js`.
- Keep `firebase-config.js` untracked — it's excluded by `.gitignore` for security.

Who it's for
- Technical instructors, vocational trainers, and learners preparing for ASE-style assessments.

Contributing
- Open a PR against `main` or create feature branches. This repo favors small, focused commits.

License
- MIT
