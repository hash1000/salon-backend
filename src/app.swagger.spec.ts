import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/sequelize';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

describe('Application Swagger registration', () => {
  it('includes every application route and authentication schemas', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getConnectionToken())
      .useValue({ close: jest.fn() })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          JWT_SECRET: 'test-secret-with-at-least-32-characters',
          JWT_ACCESS_TTL_SECONDS: 900,
        }),
      )
      .compile();
    const app = module.createNestApplication();
    try {
      await app.init();
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().addBearerAuth().build(),
      );
      expect(Object.keys(document.paths).sort()).toEqual([
        '/',
        '/auth/login',
        '/auth/me',
        '/auth/signup',
      ]);
      expect(document.paths['/'].get).toBeDefined();
      expect(document.paths['/auth/signup'].post?.requestBody).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SignupDto' },
          },
        },
      });
      expect(document.paths['/auth/login'].post?.requestBody).toBeDefined();
      expect(document.paths['/auth/me'].get?.security).toEqual([
        { bearer: [] },
      ]);
      expect(document.components?.schemas).toHaveProperty('AuthResponseDto');
      expect(document.components?.schemas).toHaveProperty('UserResponseDto');
    } finally {
      await app.close();
    }
  });
});
