import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin:"http://localhost:5173",
    credentials:true
  });
  app.use('/uploads/avatars', express.static(path.join(process.cwd(), 'backend', 'uploads', 'avatars')));
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`App running on http://localhost:${port}`);
}
bootstrap();
