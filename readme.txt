Project: QPU Calibration Visualizer

Team Members:
- Tim Werner

Implemented Visualisation Techniques:
- SVG lattice using D3.js displays the heavy hex QPU topology
- Qubit properties (e.g., T1, T2, gate errors) highlighted using virdis-style colour scale

How to start:
docker build -t qpu . && docker run -p 3000:3000 qpu
# Open http://localhost:3000

Alternatively:
npm install
npm run dev
# Open http://localhost:5173

Source of Data:
IBM Qiskit Runtime REST API

Source of Code (Libraries, Code Examples, etc.):
- Svelte (& SvelteKit)
- D3.js

See ./screenshot.png for a preview of the visualisation.