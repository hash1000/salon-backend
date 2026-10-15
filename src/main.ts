import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { createValidationPipe } from './config/validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.useGlobalPipes(createValidationPipe());
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Booking API')
    .setDescription('Booking backend authentication API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );
  await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'));
}
void bootstrap();
