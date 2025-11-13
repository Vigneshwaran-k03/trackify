import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordReset } from './password-reset.entity';
import { MailService } from '../mail/mail.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(PasswordReset) private readonly prRepo: Repository<PasswordReset>,
    private readonly mail: MailService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    throw new UnauthorizedException('Invalid email or password');
  }

  login(user: any) {
    const payload = { email: user.email, sub: user.user_id, role: user.role, name: user.name };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async sendLoginNotification(email: string, name?: string) {
    if (!email) return;
    const subject = 'Login notification';
    const text = `Hello${name ? ' ' + name : ''},\n\nYour account logged in successfully. If this wasn't you, please reset your password.`;
    await this.mail.sendMail({ to: email, subject, text });
  }

  async requestPasswordReset(email: string): Promise<{ ok: boolean }>{
    if (!email) throw new BadRequestException('Email is required');
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new BadRequestException('User not found');
    const token = randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    const entity = this.prRepo.create({ email, token, expires_at: expires, used: false });
    await this.prRepo.save(entity);
    const subject = 'Password reset request';
    const resetUrl = `http://localhost:5173/reset-password?token=${token}`;
    const text = `Hello ${user.name},\n\nUse the link to reset your password (valid 15 minutes): ${resetUrl}\n\nIf you didn't request this, ignore this email.`;
    await this.mail.sendMail({ to: email, subject, text, html: `<p>Hello ${user.name},</p><p>Use the link to reset your password (valid 15 minutes): <a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, ignore this email.</p>` });
    return { ok: true };
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<{ ok: boolean }>{
    if (!token || !newPassword) throw new BadRequestException('Token and newPassword are required');
    const pr = await this.prRepo.findOne({ where: { token } });
    if (!pr || pr.used || new Date(pr.expires_at).getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired token');
    }
    await this.usersService.updatePasswordByEmail(pr.email, newPassword);
    await this.prRepo.update({ id: pr.id }, { used: true } as any);
    await this.mail.sendMail({ to: pr.email, subject: 'Password changed', text: 'Your password was changed successfully.' });
    return { ok: true };
  }
}
