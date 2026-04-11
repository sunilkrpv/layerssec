import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaClient, Collection } from 'chromadb';

export interface RagDocument {
  id: string;
  text: string;
  metadata: Record<string, string | number | boolean>;
}

export interface RagQueryResult {
  id: string;
  text: string;
  metadata: Record<string, string | number | boolean>;
  distance: number;
}

const COLLECTION_NAME = 'layers_rag';

@Injectable()
export class ChromaService implements OnModuleInit {
  private readonly logger = new Logger(ChromaService.name);
  private client: ChromaClient;
  private collection: Collection | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const path = this.config.get<string>('CHROMA_URL') ?? 'http://localhost:8000';
    console.log(`Connecting to ChromaDB at ${path}`);
    this.client = new ChromaClient({ path });
    
    try {
      this.collection = await this.client.getOrCreateCollection({
        name: COLLECTION_NAME,
        metadata: { 'hnsw:space': 'cosine' },
      });
      this.logger.log(`ChromaDB connected — collection "${COLLECTION_NAME}" ready`);
    } catch (err) {
      this.logger.warn(`ChromaDB unavailable at ${path} — RAG features disabled. ${String(err)}`);
    }
  }

  get isReady(): boolean {
    return this.collection !== null;
  }

  async upsert(docs: RagDocument[]): Promise<void> {
    if (!this.collection || docs.length === 0) return;
    await this.collection.upsert({
      ids: docs.map((d) => d.id),
      documents: docs.map((d) => d.text),
      metadatas: docs.map((d) => d.metadata),
    });
  }

  async query(
    queryText: string,
    filter: Record<string, string>,
    nResults = 5,
  ): Promise<RagQueryResult[]> {
    if (!this.collection) return [];
    try {
      const results = await this.collection.query({
        queryTexts: [queryText],
        nResults,
        where: filter as Record<string, string>,
      });

      const ids = results.ids[0] ?? [];
      const docs = results.documents[0] ?? [];
      const metas = results.metadatas[0] ?? [];
      const distances = results.distances?.[0] ?? [];

      return ids.map((id, i) => ({
        id,
        text: docs[i] ?? '',
        metadata: (metas[i] ?? {}) as Record<string, string | number | boolean>,
        distance: distances[i] ?? 1,
      }));
    } catch {
      return [];
    }
  }

  async deleteByFilter(filter: Record<string, string>): Promise<void> {
    if (!this.collection) return;
    try {
      await this.collection.delete({ where: filter as Record<string, string> });
    } catch {
      // Ignore — collection may be empty
    }
  }
}
