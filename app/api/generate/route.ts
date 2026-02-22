import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `You are an expert software architect specializing in system design diagrams.
When given a description of a system or architecture, output a JSON diagram specification.

RULES:
- Respond with ONLY valid JSON. No markdown, no explanations, no code fences.
- Node types must be one of: service, database, client, gateway, loadbalancer, queue, cache, group
- Node IDs must be short slugs: "auth-service", "postgres-db", "redis-cache", etc.
- Layout nodes logically:
  - Clients: left side (x: 50-200, y: 200-400)
  - Gateway/Load Balancer: center-left (x: 300-500)
  - Services: center (x: 550-900)
  - Databases/Caches: right (x: 950-1200)
  - Queues: below services (y: 550-700)
  - Groups: large containers — set style.width and style.height
- For child nodes inside groups: set parentNode to the group id and extent to "parent"
  - Child positions are relative to the parent group's top-left corner
- Use animated: true for async message flows (queues), false for synchronous calls
- Edge labels should be concise: "HTTPS", "SQL", "gRPC", "pub/sub", "REST", "TCP"
- Include 4-15 nodes and all relevant edges
- Use realistic technology names in labels: "PostgreSQL", "Redis", "Nginx", "Kafka", etc.
- For group nodes, include "style": { "width": 400, "height": 300 } (adjust size as needed)

SCHEMA:
{
  "nodes": [
    {
      "id": "string",
      "type": "service|database|client|gateway|loadbalancer|queue|cache|group",
      "position": { "x": number, "y": number },
      "data": {
        "label": "string",
        "description": "string",
        "technology": "string"
      },
      "style": { "width": number, "height": number },
      "parentNode": "string",
      "extent": "parent"
    }
  ],
  "edges": [
    {
      "id": "string",
      "source": "string",
      "target": "string",
      "label": "string",
      "animated": boolean,
      "type": "smoothstep"
    }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Generate a diagram for: ${prompt}` }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Strip accidental markdown fences
    const raw = content.text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const diagram = JSON.parse(raw);

    if (!Array.isArray(diagram.nodes) || !Array.isArray(diagram.edges)) {
      throw new Error('Invalid diagram structure from Claude');
    }

    return NextResponse.json(diagram);
  } catch (err: unknown) {
    console.error('[/api/generate] error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
