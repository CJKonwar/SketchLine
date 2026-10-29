# How Sketchline works

Think of the app as five small jobs working together.

## 1. Understand the writing

The notebook page contains your title and source text. The text area grows as you write. Generate visual creates a separate editable diagram directly below that writing. The left sidebar switches between notes; the right panel changes the layout, colors, or selected object.

Generation has three explicit routes:

- **Local generator**: a text parser turns lines and explicit branches into nodes and connections. Public builds run it in the browser; the private Mac version can run it on the local server.
- **Your Gemini key**: the browser sends your notes and diagram type directly to Google’s `generateContent` endpoint. The key is in a request header. A paginated models.list request populates the Gemini model selector, filtering out non-text/specialized models. The selected model ID determines the generateContent URL. Model preference is separate browser storage; the credential is never saved with it. Gemini returns structured JSON, not a PNG.
- **On this Mac**: the optional private server reads a configured Gemini or OpenAI key from `.env` and calls that selected provider. Public mode never uses this route or the Mac’s saved workspace.

The AI supplies the meaning: labels, descriptions, supported shapes, and which steps connect. It does not decide every pixel’s position. Failed requests show an error instead of silently substituting a different generator.

## 2. Check the diagram data

For example, an approval process can be represented as:

```json
{
  "nodes": [
    {"id":"request","label":"Receive request","description":"","kind":"start"},
    {"id":"review","label":"Approved?","description":"","kind":"decision"},
    {"id":"fulfil","label":"Fulfil request","description":"","kind":"process"},
    {"id":"notify","label":"Notify the customer","description":"","kind":"process"}
  ],
  "edges": [
    {"source":"request","target":"review","label":""},
    {"source":"review","target":"fulfil","label":"Yes"},
    {"source":"review","target":"notify","label":"No"}
  ]
}
```

Shared validation in the browser and server checks that IDs are unique, connections point to real nodes, text lengths are reasonable, and shapes are supported. Invalid output becomes an error message rather than executable browser code.

## 3. Arrange the picture

The layout engine estimates how much room each label and description needs. Dagre handles Landscape and Portrait. Other layout functions arrange an ordered row or list, a card grid, an outline, radial branches, a circle, or widening/tapering layers. All ten preserve labels and connections. Text length affects card height; Pyramid and Funnel also vary card width.

Grid, Mind map, and Circle choose connection sides from the relative positions of the cards. Moving a card can change its connection side. If that changes the line’s orientation, its manual bends reset so the line remains attached; Undo restores the earlier state.

Themes supply colors and borders separately. Changing a theme does not ask the AI to regenerate the content. Auto arrange changes positions while preserving labels and connections.

## 4. Edit objects directly

React Flow renders a separate card for every node and an arrow for every edge. A card’s saved data includes its label, shape, description, and position.

When you change “Pack order” to “Pack carefully,” the app changes one label in that data. It does not repaint a flat screenshot or ask an image model to recreate the diagram.

Dragging a card changes its coordinates. Its arrows stay connected because they refer to the node’s ID.

Connections are separate editable objects too. Their optional `route` stores the middle rail position and the distances of the two endpoint leads. Pointer capture keeps a line drag attached to the same section as it moves; screen-to-canvas conversion accounts for zoom. A drag records one Undo snapshot, and keyboard adjustments use the same routing data. React Flow handles endpoint reconnection, while the app rejects self-connections and duplicate connections.

The editor and image exporter share `src/lib/connections.mjs` for orthogonal paths and rounded corners. Export bounds include custom bends outside the boxes, preventing them from being cropped. Saved/imported route values are validated as finite, bounded numbers. Layout changes and Auto arrange clear custom routes. Undo and redo retain recent document snapshots. They cover the active editing session, not a permanent cross-session revision history.

Generation creates a candidate first. Your existing diagram remains stored until you accept the candidate. Selecting a new preview never silently overwrites your manual work.

## 5. Save and export

Both versions save the workspace in browser local storage. In the private Mac version, a short delay also saves it to `data/workspace.json` through a temporary file and atomic rename. The public version uses a separate browser workspace and makes no `/api/workspace`, `/api/status`, or `/api/generate` requests. It has no shared cloud database. Keys are held separately from the workspace and are never part of a diagram export.

PNG export draws an image of the diagram. SVG export writes vector shapes, paths, and real text from the same node data and positions. A Sketchline backup preserves the source text and all editable diagram information so the app can import it again. SVG is for vector tools; the Sketchline file preserves this app’s complete document model.

The SVG exporter uses a separate vector rendering path, so connector bends and exact line wrapping can differ slightly from the interactive canvas. Check your exported visual when preparing something to share.

## Where to find each part

| File | Responsibility |
| --- | --- |
| `src/App.jsx` | Notebook workspace, inline diagram editor, history, previews, and saving |
| `src/NotebookEditor.jsx`, `src/NotebookNav.jsx` | Growing note editor, generation controls, and note navigation |
| `src/GeminiKeyForm.jsx`, `src/lib/gemini-client.mjs` | Visitor key form, direct Google requests, validation, timeouts, and optional tab storage |
| `src/lib/runtime.mjs` | Public/private mode and separate browser workspace keys |
| `shared/gemini.mjs` | Shared Gemini instructions, strict output schema, and response parsing |
| `src/style.css` | Colors, typography, responsive layout, focus states, and motion |
| `src/lib/layout.mjs` | Themes, text sizing, and automatic node arrangement |
| `src/lib/export.mjs` | SVG, PNG, and backup downloads |
| `src/DiagramEdge.jsx` | Pointer/keyboard line editing and visible connection controls |
| `src/lib/connections.mjs` | Shared line routing, section movement, and reconnection rules |
| `shared/diagram.mjs` | Diagram schema, validation, examples, and local generation |
| `server/index.mjs` | Local file storage and the server-only generation route |
| `server/ai.mjs` | Gemini/OpenAI request formats, response parsing, and provider errors |
| `tests/diagram.test.mjs` | Checks for branches, invalid output, layout overlap, and safe SVG export |

## Current boundaries

This version concentrates on flowcharts and mind maps. It does not yet provide accounts, internet hosting, real-time collaboration, PowerPoint/PDF export, or Napkin’s broader illustration catalogue. A language model may still misunderstand text; review the suggested labels and connections before keeping a visual.
