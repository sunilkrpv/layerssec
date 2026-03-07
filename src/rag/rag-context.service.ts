import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChromaService } from './chroma.service';

interface NodeSummary {
  type: string;
  label: string;
  technology?: string;
  layerName: string;
}

interface DiagramInfo {
  name: string;
  status: string;
  version: number;
  updatedAt: Date;
  publishedAt: Date | null;
  publishComment: string | null;
}

interface VersionSummary {
  versionNumber: number;
  publishedAt: string | null;
  publishComment: string | null;
}

@Injectable()
export class RagContextService {
  private readonly logger = new Logger(RagContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chroma: ChromaService,
  ) {}

  /**
   * Gathers all relevant context for the contextual chat endpoint.
   * Runs all four tools in parallel and returns a formatted context block.
   */
  async gatherContext(
    userId: string,
    projectId: string,
    diagramId: string | undefined,
    userMessage: string,
  ): Promise<string> {
    const [semanticResults, diagramInfo, nodes, versions] = await Promise.all([
      this.semanticSearch(userMessage, userId, projectId),
      diagramId ? this.getDiagramInfo(diagramId, userId) : Promise.resolve(null),
      diagramId ? this.getDiagramNodes(diagramId) : Promise.resolve([]),
      this.listProjectVersions(projectId, userId),
    ]);

    return this.buildContextString(semanticResults, diagramInfo, nodes, versions);
  }

  // ── Tools ─────────────────────────────────────────────────────────────────

  private async semanticSearch(
    query: string,
    userId: string,
    projectId: string,
  ) {
    return this.chroma.query(query, { userId, projectId }, 6);
  }

  private async getDiagramInfo(diagramId: string, userId: string): Promise<DiagramInfo | null> {
    try {
      const diagram = await this.prisma.diagram.findUnique({
        where: { id: diagramId },
        select: {
          name: true,
          status: true,
          version: true,
          updatedAt: true,
          publishedAt: true,
          publishComment: true,
          project: { select: { ownerId: true } },
        },
      });
      if (!diagram || diagram.project.ownerId !== userId) return null;
      return {
        name: diagram.name,
        status: diagram.status,
        version: diagram.version,
        updatedAt: diagram.updatedAt,
        publishedAt: diagram.publishedAt,
        publishComment: diagram.publishComment,
      };
    } catch {
      return null;
    }
  }

  private async getDiagramNodes(diagramId: string): Promise<NodeSummary[]> {
    try {
      const diagram = await this.prisma.diagram.findUnique({
        where: { id: diagramId },
        select: { canvasData: true },
      });
      if (!diagram?.canvasData) return [];

      const canvasData = diagram.canvasData as {
        layers?: Record<string, {
          name?: string;
          nodes?: Array<{ id: string; type?: string; data?: { label?: string; technology?: string } }>;
        }>;
      };

      const nodes: NodeSummary[] = [];
      for (const [, layer] of Object.entries(canvasData?.layers ?? {})) {
        const layerName = layer.name ?? 'Unknown Layer';
        for (const node of layer.nodes ?? []) {
          nodes.push({
            type: node.type ?? 'unknown',
            label: node.data?.label ?? node.id,
            technology: node.data?.technology,
            layerName,
          });
        }
      }
      return nodes;
    } catch {
      return [];
    }
  }

  private async listProjectVersions(projectId: string, userId: string): Promise<VersionSummary[]> {
    try {
      const diagrams = await this.prisma.diagram.findMany({
        where: { projectId, status: 'published' },
        orderBy: { publishedAt: 'asc' },
        select: { publishedAt: true, publishComment: true },
      });
      return diagrams.map((d, i) => ({
        versionNumber: i + 1,
        publishedAt: d.publishedAt?.toISOString() ?? null,
        publishComment: d.publishComment,
      }));
    } catch {
      return [];
    }
  }

  // ── Context string builder ─────────────────────────────────────────────────

  private buildContextString(
    semanticResults: Awaited<ReturnType<typeof this.semanticSearch>>,
    diagramInfo: DiagramInfo | null,
    nodes: NodeSummary[],
    versions: VersionSummary[],
  ): string {
    const sections: string[] = [];

    // Diagram metadata
    if (diagramInfo) {
      const isReadOnly = diagramInfo.status === 'published';
      const lastUpdated = diagramInfo.updatedAt.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      });
      sections.push(`=== DIAGRAM INFO ===
Name: ${diagramInfo.name}
Status: ${isReadOnly ? 'published (read-only)' : 'draft (editable)'}
Version: ${diagramInfo.version}
Last updated: ${lastUpdated}${diagramInfo.publishedAt ? `\nPublished at: ${diagramInfo.publishedAt.toLocaleDateString()}` : ''}${diagramInfo.publishComment ? `\nPublish note: ${diagramInfo.publishComment}` : ''}`);
    }

    // Nodes across all layers
    if (nodes.length > 0) {
      const nodeLines = nodes.map((n) =>
        `  • [${n.type}] ${n.label}${n.technology ? ` (${n.technology})` : ''} — in layer "${n.layerName}"`,
      );
      sections.push(`=== DIAGRAM NODES (${nodes.length} total) ===\n${nodeLines.join('\n')}`);
    }

    // Version history
    if (versions.length > 0) {
      const vLines = versions.map((v) => {
        const date = v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : 'unknown date';
        return `  • v${v.versionNumber} — published ${date}${v.publishComment ? `: "${v.publishComment}"` : ''}`;
      });
      sections.push(`=== VERSION HISTORY (${versions.length} published version${versions.length !== 1 ? 's' : ''}) ===\n${vLines.join('\n')}`);
    }

    // Semantic memory (past conversations + similar diagram content)
    const relevantMemories = semanticResults.filter((r) => r.distance < 0.8);
    if (relevantMemories.length > 0) {
      const memLines = relevantMemories.map((r) => `  • ${r.text}`);
      sections.push(`=== RELEVANT MEMORIES ===\n${memLines.join('\n')}`);
    }

    return sections.join('\n\n');
  }
}
