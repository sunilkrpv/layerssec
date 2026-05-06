# Attack Mind Simulator

The Attack Mind Simulator generates **realistic multi-hop attack paths** through your architecture — the way a sophisticated attacker (think APT-level) would actually traverse your system to reach its most valuable assets.

Each simulation produces 3 ranked attack paths with step-by-step kill chains, MITRE ATT&CK technique IDs, crown jewel identification, and concrete mitigations.

> **Requires:** A cloud project with a signed-in account.

---

## Open the Simulator

Two ways to open Attack Mind:

**Option A — Toolbar**
: Toolbar → **Threat Model** → **Attack Mind**

**Option B — Right-click a node**
: Right-click any node on the canvas → **Simulate Attack from here**
: This pre-fills that node as the entry point for all 3 attack paths.

The panel docks to the right of the canvas.

---

## Run a Simulation

1. (Optional) Set an **entry node ID** in the footer field, or leave it empty to let the AI choose the 3 most dangerous entry points across the diagram.
2. (Optional) Enable **Extended thinking** for deeper analysis.
3. Click **Run Simulation**.

The AI streams back JSON progressively. A byte counter shows progress during streaming. When complete, the 3 attack paths appear as expandable cards.

---

## Reading the Results

### Entry Point Analysis

At the top, a brief paragraph identifies the single most dangerous entry point in the diagram and explains why — useful for quickly understanding where to focus defenses.

### Attack Path Cards

Each of the 3 paths shows:

| Field | Description |
|-------|-------------|
| **Severity badge** | CRITICAL / HIGH / MEDIUM |
| **Title** | A concise scenario name (e.g., *"API Gateway to Database via Credential Theft"*) |
| **Entry Point** | Which node the attacker starts from |
| **Likelihood** | HIGH / MEDIUM / LOW — how plausible this path is |
| **Kill Chain** | Step-by-step actions with ATT&CK technique IDs |
| **Crown Jewels** | The high-value assets the attacker ultimately reaches |
| **Mitigations** | 2 specific architectural mitigations for this path |
| **Summary** | 2–3 sentence narrative of the full attack chain |

Paths are sorted most severe first.

---

## Kill Chain Steps

Expand a path to see its step-by-step kill chain. Each step shows:

```
  1  Exploit Public-Facing Application                     ●HIGH
     T1190 - Exploit Public-Facing Application
     The attacker sends malformed input to the API Gateway to
     bypass input validation and gain initial access.
```

- **Step number** — sequential position in the attack
- **Action** — concise description (max 60 characters)
- **ATT&CK technique** — MITRE technique ID + name
- **Description** — 2–3 sentence concrete narrative
- **Success likelihood dot** — green (LOW), amber (MEDIUM), red (HIGH)

### Canvas highlighting

**Hover over any step** to highlight the nodes involved on the canvas. Step number badges (red pills with a sword icon) appear on the affected nodes, making it easy to see exactly which part of your architecture is at risk.

Move your mouse off the step to clear the highlights.

---

## ATT&CK Techniques Referenced

The simulator uses real MITRE ATT&CK IDs. Common ones you'll see:

| ID | Technique |
|----|-----------|
| T1190 | Exploit Public-Facing Application |
| T1566 | Phishing |
| T1078 | Valid Accounts |
| T1021 | Remote Services |
| T1550 | Use Alternate Authentication Material |
| T1110 | Brute Force |
| T1552 | Unsecured Credentials |
| T1083 | File and Directory Discovery |
| T1046 | Network Service Discovery |
| T1041 | Exfiltration Over C2 Channel |
| T1486 | Data Encrypted for Impact |
| T1059 | Command and Scripting Interpreter |
| T1055 | Process Injection |

---

## Simulate Attack from a Specific Node

If you want all 3 paths to start from a particular node (e.g., your public-facing API):

1. Right-click the node on the canvas → **Simulate Attack from here**.
   — The panel opens with that node's ID pre-filled in the **Entry node ID** field.
2. Click **Run Simulation**.

Alternatively, type any node ID directly into the **Entry node ID** field in the panel footer.

To return to auto-selection (AI chooses the 3 most dangerous entry points), clear the entry node ID field.

---

## Extended Thinking

Check **"Use extended thinking"** in the panel footer before running. Extended thinking mode:

- Performs more deliberate, multi-step reasoning before generating paths
- Produces more architecturally grounded attack narratives
- Takes longer (30–90 seconds) but is more accurate for complex diagrams
- Does not stream progressively — the full result appears at once when complete

Recommended for: large diagrams with many trust boundaries, or when preparing for a security review.

---

## Save a Simulation

After simulation completes, a **Save this simulation** bar appears at the bottom of the panel.

1. Edit the auto-generated name (e.g., *"Pre-launch red team — March 2025"*).
2. Click **Save**.

The simulation is stored in the database linked to this project.

---

## View Saved Simulations

Click the **Flag** icon in the panel header to open the saved simulations list. Each entry shows:
- Name and date
- Number of paths and CRITICAL path count

Click **👁 Load** to display a past simulation in the panel (read-only).
Click **🗑 Delete** to permanently remove it.

---

## Act on the Results

Use attack path findings to:

1. **Add mitigations to your diagram** — the simulator suggests 2 concrete architectural mitigations per path. Add the suggested controls as nodes or labels to your diagram.

2. **Run STRIDE Threat Analysis** — cross-reference the attack paths with your STRIDE threats. Nodes that appear in attack paths and have CRITICAL STRIDE threats are your highest priority.

3. **Raise your Posture Score** — implementing the suggested mitigations (trust boundaries, auth nodes, monitoring) directly improves your Security Posture Score dimensions.

4. **Export a report** — go to the [Threat Dashboard](./threat-dashboard.md) and export a PDF that includes your threat model alongside your architectural diagram.

---

## Tips for Better Simulations

| Tip | Why it helps |
|-----|-------------|
| Add Trust Boundary nodes | Gives the AI clear lateral movement targets |
| Label edges (e.g., "HTTPS", "internal RPC", "JWT") | Helps the AI identify trust relationships |
| Add descriptions to nodes | Gives the AI context to craft realistic narratives |
| Mark node types accurately | Databases, caches, and auth services get different attack treatment |
| Add external actor nodes | Gives the AI explicit entry points to start from |

---

## Next Steps

- [Security Posture Score](./security-posture-score.md) — measure the overall impact of improvements
- [STRIDE Threat Analysis](./stride-threat-analysis.md) — per-node threat breakdown
- [Threat Dashboard](./threat-dashboard.md) — track remediation status
