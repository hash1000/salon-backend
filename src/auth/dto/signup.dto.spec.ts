import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../config/validation';
import { SignupDto } from './signup.dto';

describe('Signup validation', () => {
  const pipe = createValidationPipe();
  const metadata: ArgumentMetadata = { type: 'body', metatype: SignupDto };
  const valid = {
    name: ' Alex ',
    email: ' ALEX@example.com ',
    password: 'a-secure-password',
  };

  it('normalizes names and emails while preserving passwords', async () => {
    const result = (await pipe.transform(valid, metadata)) as SignupDto;
    expect(result.name).toBe('Alex');
    expect(result.email).toBe('alex@example.com');
    expect(result.password).toBe(valid.password);
  });

  it.each([
    { email: 'invalid' },
    { password: 'short' },
    { name: '   ' },
    { password: 'é'.repeat(37) },
    { password: 12345678 },
    { admin: true },
    { name: null },
    { email: null },
  ])('rejects invalid input %j', async (change) => {
    await expect(
      pipe.transform({ ...valid, ...change }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
