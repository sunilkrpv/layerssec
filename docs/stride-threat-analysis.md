# STRIDE Threat Analysis

Drafter's threat analysis engine applies the STRIDE methodology to your architecture diagram. It identifies threats per node and data flow, streams results in real time, and lets you save, manage, and export findings.

> **Requires:** A cloud project (not local mode) with a signed-in account.

---

## What is STRIDE?

STRIDE is a threat categorization framework developed by Microsoft. It covers six threat categories:

| Letter | Category | Example threat |
|--------|----------|----------------|
| **S** | Spoofing | Attacker impersonates a legitimate service |
| **T** | Tampering | Data is modified in transit or at rest |
| **R** | Repudiation | Actions cannot be traced back to a user |
| **I** | Information Disclosure | Sensitive data is exposed to unauthorized parties |
| **D** | Denial of Service | Service is made unavailable |
| **E** | Elevation of Privilege | User gains permissions they shouldn't have |

---

## Run a Threat Analysis

1. Open the AI Assistant (`Cmd+I`).
2. Click the **Threat Analysis** button (shield icon with crosshair) in the assistant panel.
3. The AI analyzes all nodes and edges in the current layer and streams structured threat cards.

Each threat card shows:
- **STRIDE category badge** (color-coded)
- **Severity** (CRITICAL / HIGH / MEDIUM / LOW / INFO)
- **Target node or edge** name
- **Title** and **Description** of the specific threat

---

## How the AI Applies STRIDE

The analysis engine applies different STRIDE checks based on node type:

| Node type | STRIDE categories checked |
|-----------|--------------------------|
| Process nodes (service, gateway, serverless) | All 6 categories |
| Data store nodes (database, cache, queue, storage) | S, T, R, I, D, E |
| External nodes (actors, external services) | S, I, E — highest priority |
| Edges crossing trust boundaries | All 6 categories, elevated severity |
| Edges within the same trust zone | T, I only |

> Add **Trust Boundary** nodes to your diagram before running analysis for the most accurate results. See [Trust Boundaries](./trust-boundaries.md).

---

## Save a Threat Model

After analysis completes, a **Save Threat Model** button and name field appear below the results.

1. Optionally edit the auto-generated name (e.g., *"v3 Analysis — Jan 12"*).
2. Click **Save**.
3. The threats are saved as a named snapshot tied to the current diagram version.

**Unsaved results are transient** — they live in the panel until you navigate away or close the browser. Save explicitly to persist them.

---

## View the Threat Model Overlay (⌘⇧M)

Press `Cmd+Shift+M` or use **Threat Model → View** in the toolbar to open the **Threat Model Panel** docked on the right.

The panel shows:
- A live list of threats from the current analysis or last loaded model
- Threats grouped and filterable by the current layer
- Each threat card with STRIDE badge, severity, and action buttons

### Threat badges on the canvas

While the Threat Model Panel is open, colored severity badges appear on every node that has threats:
- **Red** — CRITICAL or HIGH threat present
- **Yellow** — MEDIUM threat present
- **Green** — only LOW / INFO threats

Click any badge to jump to that node's threats in the panel.

---

## Manage Threats

### Change threat status

Each saved threat can be set to one of:

| Status | Meaning |
|--------|---------|
| Identified | Newly found, not yet acted on |
| In Progress | Being worked on |
| Mitigated | Fixed or remediated |
| Accepted | Risk accepted, no action taken |
| False Positive | Not a real threat in this context |

Click the status dropdown in a threat card to update it.

### Add mitigation notes

Click the **edit** icon on any threat card to add free-text mitigation notes — documenting what control was put in place.

### Add a threat manually

In the Threat Model Panel, click **+ Add Threat** to create a user-defined threat not identified by the AI. Assign it to any node, set the STRIDE category, severity, and description.

### Dismiss or delete

- **Dismiss** — marks as false positive and hides from active view
- **Delete** — permanently removes the threat from the saved model

---

## Threat History

The Threat Model Panel shows a **History** tab listing all saved threat models for the current project:
- Name, diagram version, save date
- Total threat count and severity summary
- Mitigated count

Click any saved model to load it into the panel for review. Models are read-only once loaded from history — switch to the latest model to make changes.

---

## Next Steps

- [Threat Dashboard](./threat-dashboard.md) — full-page table view, search, filter, and export
- [Security Posture Score](./security-posture-score.md) — overall health score based on your architecture
- [Attack Mind Simulator](./attack-mind-simulator.md) — simulate how an attacker would traverse your diagram
