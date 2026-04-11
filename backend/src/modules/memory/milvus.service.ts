import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MilvusClient, DataType, MetricType, IndexType } from '@zilliz/milvus2-sdk-node';

const COLLECTION_NAME = 'memories';

@Injectable()
export class MilvusService implements OnModuleInit {
  private client: MilvusClient;
  private readonly logger = new Logger(MilvusService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const address = this.configService.get('MILVUS_ADDRESS', 'localhost:19530');
    const dimension = this.configService.get<number>('EMBEDDINGS_DIMENSION', 1536);

    this.client = new MilvusClient({ address });
    await this.ensureCollection(dimension);
    this.logger.log('Milvus connected and collection ready');
  }

  async insert(id: string, embedding: number[], memoryType: string): Promise<void> {
    await this.client.insert({
      collection_name: COLLECTION_NAME,
      data: [{ id, embedding, memory_type: memoryType }],
    });
  }

  async search(embedding: number[], limit: number, memoryType?: string): Promise<string[]> {
    const searchParams: any = {
      collection_name: COLLECTION_NAME,
      vector: embedding,
      limit,
      output_fields: ['id'],
    };

    if (memoryType) {
      searchParams.filter = `memory_type == "${memoryType}"`;
    }

    const results = await this.client.search(searchParams);
    return results.results.map((r: any) => r.id);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete({
      collection_name: COLLECTION_NAME,
      ids: [id],
    });
  }

  private async ensureCollection(dimension: number): Promise<void> {
    const exists = await this.client.hasCollection({ collection_name: COLLECTION_NAME });
    if (exists.value) return;

    await this.client.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        { name: 'id', data_type: DataType.VarChar, is_primary_key: true, max_length: 36 },
        { name: 'embedding', data_type: DataType.FloatVector, dim: dimension },
        { name: 'memory_type', data_type: DataType.VarChar, max_length: 20 },
      ],
    });

    await this.client.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'embedding',
      index_type: IndexType.IVF_FLAT,
      metric_type: MetricType.COSINE,
      params: { nlist: 128 },
    });

    await this.client.loadCollection({ collection_name: COLLECTION_NAME });
    this.logger.log(`Created Milvus collection "${COLLECTION_NAME}" (dim=${dimension})`);
  }
}
