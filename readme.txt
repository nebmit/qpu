Project: QPU Calibration Visualizer

Team Members:
- Tim Werner

Implemented Visualisation Techniques:
- Interactive SVG lattice, positioned with D3.js scales, displays the 156-qubit heavy-hex QPU topology
- Qubit properties (T1, T2, readout error) are encoded with a viridis-inspired OKLCH colour scale
- Edge opacity and width encode 2Q gate quality, with separate styling for filtered/dead couplings
- Inline legends, median summaries, cluster history bars, and per-qubit sparklines summarize quality trends

View deployed version:
https://qpu.timben.net

How to start:
docker build -t qpu . && docker run -p 3000:3000 qpu
# Open http://localhost:3000

Local development (requires Node.js >= 24):
npm ci
npm run dev
# Open http://localhost:5173

Source of Data:
Bundled calibration snapshots derived from the IBM Qiskit Runtime REST API.
The app loads static dataset.json and positions.json files at runtime.

Source of Code (Libraries, Code Examples, etc.):
- Svelte (& SvelteKit)
- D3.js
- Tailwind CSS

See ./screenshot.png for a preview of the visualisation.
