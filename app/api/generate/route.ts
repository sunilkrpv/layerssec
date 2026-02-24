import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `You are an expert software architect specializing in system design diagrams.
When given a description of a system or architecture, output a JSON diagram specification.

RULES:
- Respond with ONLY valid JSON. No markdown, no explanations, no code fences.
- Node types must be one of: service, database, client, gateway, loadbalancer, queue, cache, group, storage, serverless, cdn, external
  - service: microservice or backend API
  - database: SQL/NoSQL database (PostgreSQL, MongoDB, etc.)
  - client: browser, mobile app, CLI
  - gateway: API gateway, entry point, auth proxy
  - loadbalancer: traffic distributor (Nginx, ALB, HAProxy)
  - queue: message broker (Kafka, SQS, RabbitMQ)
  - cache: in-memory cache (Redis, Memcached)
  - group: zone/region container (VPC, availability zone)
  - storage: object/blob storage (S3, GCS, Azure Blob)
  - serverless: function-as-a-service (Lambda, Cloud Functions, Cloud Run)
  - cdn: content delivery network (CloudFront, Fastly, Cloudflare)
  - external: third-party service or external API (Stripe, Twilio, etc.)
- Node IDs must be short slugs: "auth-service", "postgres-db", "redis-cache", etc.
- Layout nodes logically:
  - Clients: left side (x: 50-200, y: 200-400)
  - CDN: left-center (x: 200-350)
  - Gateway/Load Balancer: center-left (x: 300-500)
  - Services/Serverless: center (x: 550-900)
  - Databases/Caches/Storage: right (x: 950-1200)
  - Queues: below services (y: 550-700)
  - External APIs: far right or far left depending on context
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
      "type": "service|database|client|gateway|loadbalancer|queue|cache|group|storage|serverless|cdn|external",
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
      return new Response(JSON.stringify({ error: 'prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream the response from Claude, accumulate, then send as one JSON response
    const stream = await client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Generate a diagram for: ${prompt}` }],
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        let accumulated = '';
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              accumulated += chunk.delta.text;
            }
          }

          // Strip accidental markdown fences
          const raw = accumulated
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim();

          const diagram = JSON.parse(raw);
          console.log('Generated diagram:', diagram);

          if (!Array.isArray(diagram.nodes) || !Array.isArray(diagram.edges)) {
            throw new Error('Invalid diagram structure from Claude');
          }

          controller.enqueue(new TextEncoder().encode(JSON.stringify(diagram)));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          controller.enqueue(
            new TextEncoder().encode(JSON.stringify({ error: msg }))
          );
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('[/api/generate] error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
