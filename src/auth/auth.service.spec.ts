import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UniqueConstraintError } from 'sequelize';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../users/user.model';

jest.mock('bcrypt');

describe('AuthService', () => {
  const user = {
    id: '845bc5e6-b006-40a3-aa50-231219893fa2',
    name: 'Alex',
    email: 'alex@example.com',
    passwordHash: 'stored-hash',
  };
  const dto = {
    name: user.name,
    email: user.email,
    password: 'secure-password',
  };
  const users = {
    create: jest.fn(),
    unscoped: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
  };
  const jwt = { signAsync: jest.fn() };
  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    users.unscoped.mockReturnValue(users);
    users.create.mockResolvedValue(user);
    users.findOne.mockResolvedValue(user);
    users.findByPk.mockResolvedValue(user);
    jwt.signAsync.mockResolvedValue('signed-token');
    (bcrypt.hash as jest.Mock).mockResolvedValue('stored-hash');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    service = new AuthService(
      users as unknown as typeof User,
      jwt as unknown as JwtService,
      new ConfigService({ JWT_ACCESS_TTL_SECONDS: 900 }),
    );
  });

  it('hashes the password and returns only public user fields on signup', async () => {
    const result = await service.signup(dto);
    expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 12);
    expect(users.create).toHaveBeenCalledWith({
      name: dto.name,
      email: dto.email,
      passwordHash: 'stored-hash',
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: user.id });
    expect(result).toEqual({
      accessToken: 'signed-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: user.id, name: user.name, email: user.email },
    });
  });

  it('handles duplicate email races using the database constraint', async () => {
    users.create.mockRejectedValue(new UniqueConstraintError({ errors: [] }));
    await expect(service.signup(dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('propagates unexpected database errors', async () => {
    users.create.mockRejectedValue(new Error('database unavailable'));
    await expect(service.signup(dto)).rejects.toThrow('database unavailable');
  });

  it('compares the stored password hash on login', async () => {
    const result = await service.login(dto);
    expect(bcrypt.compare).toHaveBeenCalledWith(
      dto.password,
      user.passwordHash,
    );
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects wrong passwords without issuing a token', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(service.login(dto)).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('performs a dummy hash comparison for unknown emails', async () => {
    users.findOne.mockResolvedValue(null);
    await expect(service.login(dto)).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
    expect(bcrypt.compare).toHaveBeenCalledWith(
      dto.password,
      expect.stringMatching(/^\$2b\$12\$/),
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('returns public profile fields for an authenticated user', async () => {
    expect(await service.findAuthenticatedUser(user.id)).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  });

  it('rejects tokens belonging to deleted users', async () => {
    users.findByPk.mockResolvedValue(null);
    await expect(service.findAuthenticatedUser(user.id)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
