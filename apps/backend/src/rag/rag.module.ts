import { Global, Module } from '@nestjs/common';
import { ChromaService } from './chroma.service';
import { RagIndexingService } from './rag-indexing.service';
import { RagContextService } from './rag-context.service';

@Global()
@Module({
  providers: [ChromaService, RagIndexingService, RagContextService],
  exports: [ChromaService, RagIndexingService, RagContextService],
})
export class RagModule {}
