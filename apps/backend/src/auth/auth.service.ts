import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const REFRESH_EXPIRY_MS_FALLBACK = 7 * 24 * 60 * 60 * 1000;

interface RefreshPayload {
  sub: string;
  email: string;
  jti: string;
  fid: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
      },
    });

    return this.issueTokensForNewSession(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokensForNewSession(user.id, user.email);
  }

  async refreshTokens(refreshToken: string) {
    const payload = this.verifyRefreshToken(refreshToken);

    const record = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (!record || record.userId !== payload.sub) {
      this.logger.warn(
        `Refresh rejected — unknown jti=${payload.jti} user=${payload.sub}`,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.revokedAt) {
      this.logger.warn(
        `Refresh token reuse detected — revoking family=${record.familyId} user=${record.userId}`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
    });
    if (!user) throw new UnauthorizedException();

    const next = await this.issueTokens(user.id, user.email, record.familyId);
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedById: next.jti },
    });

    return {
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    let payload: RefreshPayload;
    try {
      payload = this.verifyRefreshToken(refreshToken);
    } catch {
      return;
    }
    await this.prisma.refreshToken.updateMany({
      where: { familyId: payload.fid, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private verifyRefreshToken(refreshToken: string): RefreshPayload {
    let payload: Partial<RefreshPayload>;
    try {
      payload = this.jwt.verify<Partial<RefreshPayload>>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (!payload.sub || !payload.jti || !payload.fid || !payload.email) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return payload as RefreshPayload;
  }

  private async issueTokensForNewSession(userId: string, email: string) {
    const { accessToken, refreshToken } = await this.issueTokens(
      userId,
      email,
      randomUUID(),
    );
    return { accessToken, refreshToken };
  }

  private async issueTokens(userId: string, email: string, familyId: string) {
    const jti = randomUUID();
    const refreshExpiryMs = this.parseExpiryMs(
      this.config.get<string>('JWT_REFRESH_EXPIRY'),
      REFRESH_EXPIRY_MS_FALLBACK,
    );
    const expiresAt = new Date(Date.now() + refreshExpiryMs);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: userId, email },
        {
          secret: this.config.get<string>('JWT_SECRET'),
          expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRY') ?? '30m',
        },
      ),
      this.jwt.signAsync(
        { sub: userId, email, jti, fid: familyId },
        {
          secret: this.config.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRY') ?? '7d',
        },
      ),
    ]);

    await this.prisma.refreshToken.create({
      data: { id: jti, userId, familyId, expiresAt },
    });

    return { accessToken, refreshToken, jti };
  }

  private parseExpiryMs(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const m = /^(\d+)\s*([smhd])?$/i.exec(value.trim());
    if (!m) return fallback;
    const n = parseInt(m[1], 10);
    const unit = (m[2] ?? 's').toLowerCase();
    const mul =
      unit === 'd' ? 86_400_000 :
      unit === 'h' ? 3_600_000 :
      unit === 'm' ? 60_000 :
      1_000;
    return n * mul;
  }
}
