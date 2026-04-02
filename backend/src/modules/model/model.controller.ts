import { Controller, Get } from '@nestjs/common';
import { ModelService } from './model.service';

@Controller('api/v1/models')
export class ModelController {
  constructor(private readonly modelService: ModelService) {}

  @Get()
  findAll() {
    return this.modelService.findAll();
  }
}
