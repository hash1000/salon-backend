import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { createValidationPipe } from '../src/config/validation';

describe('Authentication HTTP', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const secret = 'test-secret-with-at-least-32-characters';
  const user = {
    id: '845bc5e6-b006-40a3-aa50-231219893fa2',
    name: 'Alex',
    email: 'alex@example.com',
  };
  const auth = {
    signup: jest.fn(),
    login: jest.fn(),
    findAuthenticatedUser: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret,
          signOptions: {
            algorithm: 'HS256',
            expiresIn: 900,
            issuer: 'booking-backend',
            audience: 'booking-api',
          },
        }),
      ],
      controllers: [AuthController],
      providers: [
        JwtStrategy,
        JwtAuthGuard,
        { provide: AuthService, useValue: auth },
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_SECRET: secret }),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    jwt = module.get(JwtService);
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    auth.findAuthenticatedUser.mockResolvedValue(user);
    auth.signup.mockResolvedValue({
      user,
      accessToken: 'token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    auth.login.mockResolvedValue({
      user,
      accessToken: 'token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
  });
  afterAll(async () => {
    await app.close();
  });

  it('accepts normalized signup input and returns 201', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: ' Alex ',
        email: ' ALEX@example.com ',
        password: 'secure-password',
      })
      .expect(201);
    expect(auth.signup).toHaveBeenCalledWith({
      name: 'Alex',
      email: 'alex@example.com',
      password: 'secure-password',
    });
  });
  it('returns 200 on login', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'secure-password' })
      .expect(200);
  });
  it('rejects invalid input before calling the service', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: '', email: 'invalid', password: 'short' })
      .expect(400);
    expect(auth.signup).not.toHaveBeenCalled();
  });
  it('rejects missing bearer tokens', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    expect(auth.findAuthenticatedUser).not.toHaveBeenCalled();
  });
  it('returns the authenticated profile for a valid token', async () => {
    const token = await jwt.signAsync({ sub: user.id });
    await request(app.getHttpServer())
      .get('/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200)
      .expect(user);
    expect(auth.findAuthenticatedUser).toHaveBeenCalledWith(user.id);
  });
  it.each([
    'expired',
    'wrong-secret',
    'wrong-audience',
    'wrong-issuer',
    'malformed-subject',
    'malformed-token',
  ])('rejects %s tokens', async (scenario) => {
    const token =
      scenario === 'malformed-token'
        ? 'not-a-jwt'
        : await jwt.signAsync(
            { sub: scenario === 'malformed-subject' ? 'invalid' : user.id },
            {
              ...(scenario === 'expired' ? { expiresIn: -1 } : {}),
              ...(scenario === 'wrong-secret'
                ? { secret: 'incorrect-secret' }
                : {}),
              ...(scenario === 'wrong-audience'
                ? { audience: 'other-api' }
                : {}),
              ...(scenario === 'wrong-issuer'
                ? { issuer: 'other-issuer' }
                : {}),
            },
          );
    await request(app.getHttpServer())
      .get('/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(401);
    expect(auth.findAuthenticatedUser).not.toHaveBeenCalled();
  });
});
