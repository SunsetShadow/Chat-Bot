import { Controller, Get } from '@nestjs/common';
import { ModelService } from './modules/model/model.service';

@Controller()
export class AppController {
  constructor(private readonly modelService: ModelService) {}

  @Get('health')
  healthCheck() {
    return { success: true, message: 'OK', code: 'SUCCESS' };
  }

  @Get('models')
  getModels() {
    return { success: true, models: this.modelService.findAll() };
  }
}
