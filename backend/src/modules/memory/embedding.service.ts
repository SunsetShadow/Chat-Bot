import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private embeddings: OpenAIEmbeddings;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.embeddings = new OpenAIEmbeddings({
      model: this.configService.get('EMBEDDINGS_MODEL_NAME', 'text-embedding-v3'),
      configuration: {
        apiKey: this.configService.get('OPENAI_API_KEY'),
        baseURL: this.configService.get('OPENAI_BASE_URL'),
      },
    });
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(texts);
  }
}
