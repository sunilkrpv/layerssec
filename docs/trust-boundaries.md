# Trust Boundaries

A **Trust Boundary** is a visual zone on your diagram that marks where data crosses between different trust levels — for example, from the public internet into your internal network, or from a user-facing service into a privileged data tier.

Trust Boundaries are the foundation of Data Flow Diagram (DFD) based threat modeling. Every edge that crosses a boundary is a potential attack surface, and the STRIDE AI uses them to prioritize threats.

---

## Add a Trust Boundary

1. Open the **Node Palette** on the left.
2. Under **Security**, drag **Trust Boundary** onto the canvas.
3. The boundary appears as a large resizable container with a dashed border and shield icon.

---

## Resize the Boundary

- Drag the corner or edge handles to resize.
- Position the boundary so that the nodes it encloses are visually inside it.

> Trust boundaries are **visual containers only** — nodes placed inside are not technically parented to the boundary in React Flow. The AI reads node labels and trust level metadata, not visual containment.

---

## Set the Trust Level

Select a Trust Boundary node to open the **Properties Panel** on the right. Use the **Trust Level** dropdown to choose:

| Trust Level | Typical use | Border color |
|-------------|-------------|--------------|
| **Internal** | Services inside your private network | Green |
| **DMZ** | Services exposed to the internet but behind a firewall | Amber |
| **External** | Third-party services or partner systems | Red |
| **Internet** | Completely public / untrusted internet | Dark red |

The badge label and border tint update immediately to reflect the selected trust level.

---

## Label the Boundary

Double-click the Trust Boundary to rename it — for example: `"Internal Network"`, `"DMZ"`, `"AWS VPC"`, `"Customer Browser"`.

Clear labels help the AI produce more accurate threat descriptions.

---

## Best Practices

### Cover all trust level changes
Draw a boundary for every place trust changes in your system:
- Between the internet and your load balancer (Internet → DMZ)
- Between your DMZ and internal services (DMZ → Internal)
- Between application tier and database tier (Internal → Privileged Internal)

### Keep boundaries non-overlapping where possible
Overlapping boundaries make the diagram harder to read and can confuse the AI. Use separate, clearly demarcated zones.

### Connect nodes across boundaries with labeled edges
When a service in the DMZ calls a service in the internal network, draw a labeled arrow between them. The AI treats every such edge as a high-priority threat surface.

### Example layout

```
┌──────────────────────────────────────────────────────┐
│  Internet                                            │
│  ┌─────────────────────────────────────────────────┐ │
│  │  DMZ                                            │ │
│  │  [Load Balancer] → [API Gateway]                │ │
│  └──────────────────────────┬──────────────────────┘ │
│                             │ (trust crossing)        │
│  ┌──────────────────────────▼──────────────────────┐ │
│  │  Internal Network                               │ │
│  │  [Auth Service]  [User Service]  [DB]           │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## How the AI Uses Trust Boundaries

When you run **STRIDE Threat Analysis**, **Security Posture Score**, or **Attack Mind Simulator**, the AI:

1. Identifies every node's trust level from its enclosing boundary label
2. Flags every edge that crosses a trust boundary as a high-priority data flow
3. Applies all 6 STRIDE categories to cross-boundary edges (vs. fewer for intra-zone edges)
4. Uses the trust level to calibrate severity — `External → Internal` crossings default to HIGH severity

---

## Next Steps

- [STRIDE Threat Analysis](./stride-threat-analysis.md) — run AI analysis on your DFD
- [Security Posture Score](./security-posture-score.md) — get an overall security health score
- [Attack Mind Simulator](./attack-mind-simulator.md) — simulate red-team attacks
