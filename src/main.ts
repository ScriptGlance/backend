import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('My API')
    .setDescription('API documentation')
    .setVersion('1.0')
    // Optionally add authentication support or other options:
    // .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document);

  const configService = app.get(ConfigService);

  // Print out the desired environment variables
  console.log('DB_HOST:', configService.get<string>('DB_HOST'));
  console.log('DB_PORT:', configService.get<number>('DB_PORT'));
  console.log('DB_USERNAME:', configService.get<string>('DB_USERNAME'));
  console.log('DB_PASSWORD:', configService.get<string>('DB_PASSWORD'));
  console.log('DB_NAME:', configService.get<string>('DB_NAME'));
  console.log('DEBUG:', configService.get<boolean>('DEBUG'));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
