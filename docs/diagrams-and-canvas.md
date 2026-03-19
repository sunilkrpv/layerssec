# Diagrams & Canvas

Everything you need to work effectively on the Drafter canvas — layers, node operations, keyboard shortcuts, and more.

---

## Canvas Controls

| Action | Method |
|--------|--------|
| Pan | Click and drag on empty canvas space |
| Zoom in / out | Scroll wheel, or `+` / `-` buttons in the toolbar |
| Fit to screen | `Cmd+Shift+F` or the **Fit** button in the toolbar |
| Select multiple | Click and drag a selection box, or hold `Shift` and click nodes |
| Delete selected | `Backspace` or `Delete` key |

---

## Node Operations

### Add a node
- **Drag** from the left palette onto the canvas, or
- **Click** a palette item to add it at the canvas center.

### Move a node
Click and drag any node to reposition it. Alignment guides (red dotted lines) appear automatically when the node's center or edge aligns with another node — release when the guide appears to snap into position.

### Resize a node
Every non-line node has a resize handle. Drag the corner handle to resize.

### Rotate a node
Hover over a node and drag the circular **rotate handle** that appears above it. Rotation snaps to 5° increments. Press `Cmd+Z` to undo.

### Edit a label
Double-click a node to open the inline editor. Press `Enter` or click outside to confirm.

### Node colors
Select a node and use the **Properties Panel** (right side) to pick:
- **Fill color** — background; choose `∅` for transparent
- **Border color**
- **Text color**

Colors can be chosen from the 9-swatch quick-picker or typed as any CSS color value.

### Right-click menu
Right-click any node to access:

| Option | Description |
|--------|-------------|
| Drill Down / Open Layer | Navigate into or create a sub-layer |
| Group / Ungroup | Group selected nodes into a container |
| Assign Layer | Link an orphaned layer to this node |
| Reassign Layer | Move a child layer to a different node |
| Bring to Front / Send to Back | Change z-order |
| Simulate Attack from here | Open Attack Mind Simulator pre-seeded with this node as entry point *(cloud projects only)* |
| Delete Node | Remove node and its child layer if present |

---

## Lines & Connections

### Draw a connection
Hover over a source node → drag from a blue handle to a target node.

### Line types
Three line shapes are available in the palette:
- **Line** — plain line
- **Arrow Line** — directed arrow
- **Dotted Line** — dashed style

### Edit a connection
Click a connection to select it. The **Edge Properties Panel** (right side) lets you:
- Add or edit a **label**
- Change **arrow direction**: one-way (`→`), reverse (`←`), bidirectional (`↔`), or none (`—`)
- Change **stroke color**

### Line endpoint snapping
For line/arrow/dotted-line shapes, small blue dots appear at both endpoints when selected. Drag an endpoint to snap it to a nearby node boundary (snaps within 40 px). When the attached node moves, the line follows automatically.

---

## Grouping Nodes

1. Select **2 or more nodes**.
2. Right-click → **Group N nodes**.
3. A group container is created. Nodes inside stay contained when the group is moved or resized.

To ungroup: right-click the group → **Ungroup**.

---

## Copy & Paste

| Action | Shortcut |
|--------|----------|
| Copy selected nodes | `Cmd+C` |
| Paste | `Cmd+V` |

Pasted nodes appear offset by 30 px from the originals. The clipboard persists across layer navigation.

---

## Layer System

Drafter uses a **layered diagram** model. Every node can optionally link to a sub-layer, letting you drill into subsystems without cluttering the parent diagram.

### Navigate layers

| Action | How |
|--------|-----|
| Drill down | Right-click a node → **Drill Down** (creates a new child layer) or **Open Layer** |
| Go back | Click **←** in the breadcrumb bar at the top |
| Jump to any layer | Click its name in the breadcrumb bar |

### Manage layers

Press `Cmd+L` to open the **Layers Panel**. From here you can:
- Rename or add a description to any layer
- Navigate to a layer directly
- Delete a layer (cascades to all descendant layers)
- View orphaned layers (layers not attached to any node)

### Assign an orphaned layer

If a layer exists but isn't linked to any node, right-click any node → **Assign Layer** to attach it.

---

## Zoom & View

| Action | Shortcut / Button |
|--------|------------------|
| Zoom in | `Cmd++` or toolbar `+` |
| Zoom out | `Cmd+-` or toolbar `-` |
| Fit to view | `Cmd+Shift+F` or toolbar **Fit** |
| Toggle edge animations | Toolbar **⚡** button |

---

## Versioning (Cloud Projects)

Cloud projects support a **draft → publish** workflow.

| Action | How |
|--------|-----|
| Publish | Toolbar → **Publish** (adds a read-only snapshot with an optional comment) |
| View published versions | My Projects → click a project → **Version History** side panel |
| Check out a version | Open a published version → **Check Out to Edit** banner → creates a new draft |
| Compare versions | Toolbar → **Diff** → split-view showing added/removed/changed nodes |

> Only the latest published version can be checked out. If a draft already exists, you must save or discard it first.

---

## Keyboard Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Cmd+C` | Copy selected |
| `Cmd+V` | Paste |
| `Cmd+S` | Save |
| `Cmd+L` | Toggle Layers panel |
| `Cmd+P` | Open My Projects |
| `Cmd+I` | Toggle AI Assistant |
| `Cmd+Shift+M` | Toggle Threat Model panel |
| `Backspace` / `Delete` | Delete selected node(s) |
| `Cmd++` / `Cmd+-` | Zoom in / out |
| `Cmd+Shift+F` | Fit to view |
