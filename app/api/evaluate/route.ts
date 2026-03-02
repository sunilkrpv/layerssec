import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const EVAL_SYSTEM_PROMPT = `You are an expert software architect and system design reviewer.

When given an architecture diagram (as a list of nodes and edges), provide a clear, concise evaluation covering:

1. **Architecture Correctness** — Is the overall design sound? Are components used correctly for their purpose?
2. **LLD (Low-Level Design)** — Any implementation flaws, missing components, anti-patterns, or single points of failure at the component level?
3. **HLD (High-Level Design)** — Any missing concerns like scalability, availability, security, observability, or fault tolerance?
4. **Recommendations** — Concrete, actionable suggestions to improve the design.

If the diagram is too sparse, too abstract, or you genuinely cannot draw conclusions, say so plainly — "No idea" is a valid answer.

Keep your response focused and practical. Use bullet points where helpful. Do not pad with filler text.`;

const QA_SYSTEM_PROMPT = `You are an expert software architect. You have been given an architecture diagram and the user has a specific question about it.

Answer the question directly and concisely based on what the diagram shows. If the diagram doesn't contain enough information to fully answer the question, say so and provide what insights you can.

Use markdown formatting where helpful (bullet points, bold for key terms, code for technology names). Keep your response focused and practical.`;

interface SimplifiedNode {
  id: string;
  type: string;
  label: string;
  technology?: string;
  description?: string;
}

interface SimplifiedEdge {
  from: string;
  to: string;
  label?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      nodes?: Array<{ id: string; type?: string; data?: { label?: string; technology?: string; description?: string } }>;
      edges?: Array<{ id: string; source: string; target: string; label?: string }>;
      layerName?: string;
      userQuestion?: string;
    };

    const { nodes = [], edges = [], layerName = 'Diagram', userQuestion } = body;

    if (!nodes.length) {
      return new Response(
        JSON.stringify({ error: 'No nodes provided — add some nodes to the canvas first.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Strip positional / style data — only send semantically meaningful info
    const simplifiedNodes: SimplifiedNode[] = nodes.map((n) => ({
      id: n.id,
      type: n.type ?? 'unknown',
      label: n.data?.label ?? n.id,
      technology: n.data?.technology,
      description: n.data?.description,
    }));

    const simplifiedEdges: SimplifiedEdge[] = edges.map((e) => ({
      from: e.source,
      to: e.target,
      label: e.label as string | undefined,
    }));

    const diagramContext = `Layer: ${layerName}

Nodes:
${JSON.stringify(simplifiedNodes, null, 2)}

Connections:
${simplifiedEdges.length ? JSON.stringify(simplifiedEdges, null, 2) : '(no edges)'}`;

    const isQA = !!userQuestion;
    const userContent = isQA
      ? `${diagramContext}\n\nQuestion: ${userQuestion}`
      : diagramContext;

    const stream = await client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: isQA ? QA_SYSTEM_PROMPT : EVAL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    // Stream text chunks directly to the client
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(new TextEncoder().encode(chunk.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          controller.enqueue(new TextEncoder().encode(`\n\n[Error: ${msg}]`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err: unknown) {
    console.error('[/api/evaluate] error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
