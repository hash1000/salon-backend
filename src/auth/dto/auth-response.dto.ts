import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty({ format: 'email' })
  email: string;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;
  @ApiProperty({ example: 'Bearer' })
  tokenType: string;
  @ApiProperty({ example: 900, description: 'Token lifetime in seconds' })
  expiresIn: number;
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}
