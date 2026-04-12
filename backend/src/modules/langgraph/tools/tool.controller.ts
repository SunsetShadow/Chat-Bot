import { Controller, Get } from '@nestjs/common';
import { ToolRegistryService } from './tool-registry.service';

@Controller('api/v1/tools')
export class ToolController {
  constructor(private readonly toolRegistry: ToolRegistryService) {}

  @Get()
  async listTools() {
    return this.toolRegistry.getAllMetadata();
  }
}
