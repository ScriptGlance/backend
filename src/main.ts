import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { StandardResponseExceptionFilter } from './common/filter/StandardResponseExceptionFilter';
import { ValidationPipe } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: '*',
      credentials: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    },
  });
  app.useGlobalFilters(new StandardResponseExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.use(
    bodyParser.json({
      verify: (req: any, _res, buf: Buffer) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        req.rawBody = buf.toString('utf8');
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('My API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await fs.mkdir(path.join(process.cwd(), 'uploads', 'videos'), {
    recursive: true,
  });
  await fs.mkdir(path.join(process.cwd(), 'uploads', 'previews'), {
    recursive: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
