import { Injectable, Logger } from '@nestjs/common';
import { ChromaService, RagDocument } from './chroma.service';

interface LayerMap {
  [layerId: string]: {
    id?: string;
    name?: string;
    description?: string;
    nodes?: Array<{ id: string; type?: string; data?: { label?: string; description?: string; technology?: string } }>;
    edges?: unknown[];
  };
}

interface ChatMessageItem {
  role: 'user' | 'assistant';
  content: string;
  layerId?: string | null;
  layerName?: string | null;
}

@Injectable()
export class RagIndexingService {
  private readonly logger = new Logger(RagIndexingService.name);

  constructor(private readonly chroma: ChromaService) {}

  /**
   * Called after a diagram is published.
   * Indexes: diagram metadata, all layer metadata, all nodes across all layers.
   * Re-indexes by deleting existing docs for this diagramId first.
   */
  async indexPublishedDiagram(
    diagram: {
      id: string;
      name: string;
      projectId: string;
      status: string;
      version: number;
      publishComment?: string | null;
      publishedAt?: Date | null;
      updatedAt: Date;
      canvasData: unknown;
    },
    userId: string,
  ): Promise<void> {
    if (!this.chroma.isReady) return;

    try {
      // Remove stale docs for this diagram before re-indexing
      await this.chroma.deleteByFilter({ diagramId: diagram.id });

      const docs: RagDocument[] = [];
      const baseMetadata = { userId, projectId: diagram.projectId, diagramId: diagram.id };

      // 1. Diagram-level metadata document
      const publishedDate = diagram.publishedAt
        ? diagram.publishedAt.toISOString().split('T')[0]
        : 'not published';
      docs.push({
        id: `diagram_${diagram.id}`,
        text: `Diagram "${diagram.name}" version ${diagram.version} published on ${publishedDate}. Status: ${diagram.status}. ${diagram.publishComment ? `Note: ${diagram.publishComment}` : ''}`,
        metadata: { ...baseMetadata, type: 'diagram_metadata' },
      });

      // 2. Layer + node documents
      const canvasData = diagram.canvasData as { layers?: LayerMap } | null;
      const layers = canvasData?.layers ?? {};

      for (const [layerId, layer] of Object.entries(layers)) {
        const layerName = layer.name ?? layerId;

        // Layer metadata doc
        docs.push({
          id: `layer_${diagram.id}_${layerId}`,
          text: `Layer "${layerName}"${layer.description ? `: ${layer.description}` : ''}`,
          metadata: { ...baseMetadata, type: 'diagram_layer', layerId },
        });

        // Node docs — one per node
        for (const node of layer.nodes ?? []) {
          const label = node.data?.label ?? node.id;
          const nodeType = node.type ?? 'unknown';
          const tech = node.data?.technology ? ` (${node.data.technology})` : '';
          const desc = node.data?.description ? `: ${node.data.description}` : '';
          docs.push({
            id: `node_${diagram.id}_${layerId}_${node.id}`,
            text: `[${nodeType}] ${label}${tech}${desc} in layer "${layerName}"`,
            metadata: { ...baseMetadata, type: 'diagram_node', layerId, nodeId: node.id },
          });
        }
      }

      if (docs.length > 0) await this.chroma.upsert(docs);
      this.logger.log(`Indexed diagram ${diagram.id}: ${docs.length} documents`);
    } catch (err) {
      this.logger.warn(`Failed to index diagram ${diagram.id}: ${String(err)}`);
    }
  }

  /**
   * Called after chat messages are saved.
   * Indexes each message as a RAG document for conversation memory.
   */
  async indexChatMessages(
    projectId: string,
    userId: string,
    messages: ChatMessageItem[],
  ): Promise<void> {
    if (!this.chroma.isReady) return;

    try {
      const now = Date.now();
      const docs: RagDocument[] = messages
        .filter((m) => m.content.trim().length > 0)
        .map((m, i) => ({
          id: `chat_${projectId}_${now}_${i}`,
          text: `[${m.role === 'user' ? 'User' : 'Assistant'}]: ${m.content}`,
          metadata: {
            userId,
            projectId,
            diagramId: '',
            type: 'chat_message',
            chatRole: m.role,
            layerId: m.layerId ?? '',
            layerName: m.layerName ?? '',
          },
        }));

      if (docs.length > 0) await this.chroma.upsert(docs);
    } catch (err) {
      this.logger.warn(`Failed to index chat messages: ${String(err)}`);
    }
  }
}
