import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow frontend
  app.enableCors({
    origin: "http://localhost:5173",
    credentials: true,
  });

  // Configure body parser with increased limits
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  // Configure express to handle file uploads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Ensure upload directories exist
  const uploadsDir = path.join(process.cwd(), 'backend', 'uploads');
  const avatarsDir= path.join(uploadsDir, 'avatars');
  
  // Create directories if they don't exist
  if (!require('fs').existsSync(uploadsDir)) {
    require('fs').mkdirSync(uploadsDir, { recursive: true });
  }
  if (!require('fs').existsSync(avatarsDir)) {
    require('fs').mkdirSync(avatarsDir, { recursive: true });
  }

  // Serve static files
  app.use(
    '/uploads/avatars',
    express.static(avatarsDir, {
      setHeaders: (res) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    })
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`App running on http://localhost:${port}`);
}

bootstrap();

