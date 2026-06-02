import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  async getHealth() {
    const { mongo, redis } = await this.healthService.getStatus();
    const ok = mongo === 'ok' && redis === 'ok';
    return {
      status: ok ? 'ok' : 'degraded',
      mongo,
      redis,
    };
  }
}
