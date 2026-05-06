import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaClient, Collection } from 'chromadb';
import { DefaultEmbeddingFunction } from '@chroma-core/default-embed';
import * as path from 'path';
import * as fs from 'fs';

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

/**
 * Minimum acceptable size (bytes) for the cached uint8-quantized
 * all-MiniLM-L6-v2 ONNX model. Legitimate file is ~23 MB; anything
 * meaningfully smaller is a truncated/corrupt download that will
 * crash `@huggingface/transformers` with "Protobuf parsing failed".
 */
const MIN_ONNX_MODEL_SIZE = 10 * 1024 * 1024;

@Injectable()
export class ChromaService implements OnModuleInit {
  private readonly logger = new Logger(ChromaService.name);
  private client: ChromaClient;
  private collection: Collection | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const chromaUrl = this.config.get<string>('CHROMA_URL') ?? 'http://localhost:8000';
    console.log(`Connecting to ChromaDB at ${chromaUrl}`);
    this.client = new ChromaClient({ path: chromaUrl });

    this.purgeCorruptEmbeddingModelCache();

    try {
      // Use quantized (uint8) model — ~23 MB vs 90 MB for fp32, faster to
      // download and load with negligible quality difference for RAG retrieval.
      const ef = new DefaultEmbeddingFunction({ quantized: true });
      this.collection = await this.client.getOrCreateCollection({
        name: COLLECTION_NAME,
        metadata: { 'hnsw:space': 'cosine' },
        embeddingFunction: ef,
      });
      this.logger.log(`ChromaDB connected — collection "${COLLECTION_NAME}" ready`);
    } catch (err) {
      this.logger.warn(`ChromaDB unavailable at ${chromaUrl} — RAG features disabled. ${String(err)}`);
    }
  }

  /**
   * If the cached MiniLM ONNX file is truncated (a half-finished download
   * from a previous run), delete the whole model dir so transformers
   * re-downloads cleanly. Without this, the next embed call throws
   * "Protobuf parsing failed" and RAG silently disables itself.
   */
  private purgeCorruptEmbeddingModelCache(): void {
    try {
      const pkgEntry = require.resolve('@huggingface/transformers');
      const pkgRoot = path.resolve(path.dirname(pkgEntry), '..');
      const modelDir = path.join(pkgRoot, '.cache', 'Xenova', 'all-MiniLM-L6-v2');
      const onnxFile = path.join(modelDir, 'onnx', 'model_uint8.onnx');

      if (!fs.existsSync(onnxFile)) return;
      const { size } = fs.statSync(onnxFile);
      if (size >= MIN_ONNX_MODEL_SIZE) return;

      this.logger.warn(
        `Cached MiniLM ONNX model looks truncated (${size} bytes < ${MIN_ONNX_MODEL_SIZE}). Purging so it will re-download.`,
      );
      fs.rmSync(modelDir, { recursive: true, force: true });
    } catch (err) {
      this.logger.warn(`Embedding-model cache preflight skipped: ${String(err)}`);
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
