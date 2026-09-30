import { Controller, Get } from '@nestjs/common';

@Controller('orders')
export class OrdersController {
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
