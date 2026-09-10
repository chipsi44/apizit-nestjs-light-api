import 'reflect-metadata';
import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpException,
  Inject,
  Module,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express, { Response } from 'express';
import { setTimeout as sleep } from 'node:timers/promises';
import { echo, item } from './contract.cjs';

export interface Options {
  sleep?: (milliseconds: number) => Promise<unknown>;
  registry?: any;
}
const OPTIONS = 'REFERENCE_OPTIONS';
@Controller()
class ReferenceController {
  constructor(@Inject(OPTIONS) private readonly options: Options) {}
  @Get('health') health() {
    return { status: 'ok' };
  }
  @Get('info') info() {
    return { framework: 'nestjs', profile: 'light' };
  }
  @Post('echo') echo(@Body() body: unknown, @Res() res: Response) {
    res.status(200).json(echo(body));
  }
  @Get('items/:item_id') item(
    @Param('item_id') id: string,
    @Query('include_details') details?: string,
  ) {
    return item(id, details);
  }
  @Get('slow') async slow() {
    await (this.options.sleep || sleep)(80000);
    return { delay_seconds: 80, status: 'completed' };
  }
}
@Catch()
class ApiErrors implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const status = error instanceof HttpException ? error.getStatus() : error.status || 500;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        error: status >= 500 && status !== 503 ? 'An unexpected error occurred.' : error.message,
      });
  }
}
export async function createApp(options: Options = {}) {
  @Module({
    controllers: [ReferenceController],
    providers: [{ provide: OPTIONS, useValue: options }],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.useGlobalFilters(new ApiErrors());
  await app.init();
  return app;
}
