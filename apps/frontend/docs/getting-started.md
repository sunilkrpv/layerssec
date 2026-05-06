# Getting Started

This guide walks you through signing in, creating your first project, and drawing a simple architecture diagram.

---

## 1. Sign In or Continue Locally

When you open Layers you'll see the startup modal:

| Option | When to use |
|--------|-------------|
| **New Project** | Start a blank local diagram (no account needed) |
| **Open File** | Load a `.json` project file saved earlier |
| **Continue** | Resume the last diagram you were working on |
| **My Cloud Projects** | Browse and open projects saved to your account |

> **Local vs Cloud** — Local diagrams are stored in your browser's `localStorage` and in files you save manually. Cloud projects are stored on the Layers backend and can be versioned, published, and shared. AI security features (Posture Score, Attack Mind) require a cloud project.

To use cloud features, click **Sign In** in the top-right corner and create an account.

---

## 2. Create a Cloud Project

1. Click **My Projects** in the menu bar (or press `Cmd+P`).
2. Click **New Project**, give it a name and optional description.
3. The project opens directly in the diagram editor.

Your project starts with a single blank canvas layer called **Root**.

---

## 3. Draw Your First Diagram

### Add nodes

Drag any shape or service from the left **Node Palette** onto the canvas, or click a palette item to add it at the center.

- **Cloud service nodes** (API Gateway, Lambda, DynamoDB, …) — found in the palette under *Cloud Services*
- **Shape nodes** (Rectangle, Actor, Cylinder, …) — under *Shapes*
- **Trust Boundary** — under *Security*; used to mark trust zones

### Connect nodes

Hover over a node until the blue connection handles appear on its edges, then drag from one handle to another node.

### Label everything

- Double-click a node to edit its label inline.
- Click a connection to select it, then open **Edge Properties** in the right panel to add a label and choose arrow direction.

### Set properties

Select a node to open the **Properties Panel** on the right:

- **Fill color / Border color / Text color** — 9-swatch picker plus a hex field
- **Rotation** — type a degree value or drag the rotate handle
- **Node-specific fields** — e.g., technology, description, trust level (for Trust Boundary nodes)

---

## 4. Save Your Work

| Action | How |
|--------|-----|
| **Auto-save to cloud** | Happens automatically every 2 seconds after a change (cloud projects) |
| **Manual cloud save** | Click **Save** in the toolbar or press `Cmd+S` |
| **Save as file** | File menu → **Save As** — downloads a `.json` project file |
| **Open local file** | File menu → **Open** — loads a `.json` file from disk |

The toolbar shows a **last saved** timestamp after each save.

---

## 5. Undo / Redo

| Action | Shortcut |
|--------|----------|
| Undo | `Cmd+Z` |
| Redo | `Cmd+Shift+Z` |

Up to 50 history steps are kept per session.

---

## Next Steps

- [Diagrams & Canvas](./diagrams-and-canvas.md) — layers, grouping, copy/paste, zoom
- [AI Assistant](./ai-assistant.md) — generate and evaluate diagrams with AI
- [Trust Boundaries](./trust-boundaries.md) — add trust zones before running threat analysis
