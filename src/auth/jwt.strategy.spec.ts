import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';

describe('JwtStrategy', () => {
  const findAuthenticatedUser = jest.fn();
  const strategy = new JwtStrategy(
    new ConfigService({ JWT_SECRET: 'x'.repeat(32) }),
    { findAuthenticatedUser } as unknown as AuthService,
  );

  it('loads the authenticated profile using the token subject', async () => {
    const id = '845bc5e6-b006-40a3-aa50-231219893fa2';
    findAuthenticatedUser.mockResolvedValue({ id });
    await expect(strategy.validate({ sub: id })).resolves.toEqual({ id });
    expect(findAuthenticatedUser).toHaveBeenCalledWith(id);
  });

  it.each([null, {}, { sub: 1 }, { sub: 'invalid' }])(
    'rejects malformed claims %j',
    (payload) => {
      expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
    },
  );
});
