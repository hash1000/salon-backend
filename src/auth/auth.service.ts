import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UniqueConstraintError } from 'sequelize';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.model';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  // A fixed valid hash ensures unknown emails still perform a bcrypt comparison.
  private readonly dummyHash =
    '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';

  constructor(
    @InjectModel(User) private readonly users: typeof User,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    let user: User;
    try {
      user = await this.users.create({
        name: dto.name,
        email: dto.email,
        passwordHash,
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
    return this.issueToken(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.users
      .unscoped()
      .findOne({ where: { email: dto.email } });
    const valid = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? this.dummyHash,
    );
    if (!user || !valid)
      throw new UnauthorizedException('Invalid email or password');
    return this.issueToken(user);
  }

  async findAuthenticatedUser(id: string): Promise<UserResponseDto> {
    const user = await this.users.findByPk(id);
    if (!user) throw new UnauthorizedException('Invalid access token');
    return this.toPublicUser(user);
  }

  private toPublicUser(user: User): UserResponseDto {
    return { id: user.id, name: user.name, email: user.email };
  }

  private async issueToken(user: User): Promise<AuthResponseDto> {
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id }),
      tokenType: 'Bearer',
      expiresIn: this.config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS'),
      user: this.toPublicUser(user),
    };
  }
}
