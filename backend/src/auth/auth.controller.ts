import { Controller, Post, Body, UseGuards, Request, Get, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Body() body: any) {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Request body is required');
    }
    return this.usersService.createUser(body);
  }

  @Post('login')
  async login(@Body() body: any) {
    const { email, password } = body;
    const user = await this.authService.validateUser(email, password);
    const token = this.authService.login(user);
    // fire and forget login notification
    this.authService.sendLoginNotification(user.email, user.name).catch(()=>{});

    return {
      access_token: token.access_token,
      user: user
    };
  }

  // Forgot password -> send reset email
  @Post('forgot')
  async forgot(@Body() body: any) {
    const { email } = body || {};
    if (!email) throw new BadRequestException('Email is required');
    return this.authService.requestPasswordReset(email);
  }

  // Reset password with token from email
  @Post('reset')
  async reset(@Body() body: any) {
    const { token, newPassword } = body || {};
    if (!token || !newPassword) throw new BadRequestException('Token and newPassword are required');
    return this.authService.resetPasswordWithToken(token, newPassword);
  }

  // Change password via email verification (initiate: reuse forgot)
  @UseGuards(JwtAuthGuard)
  @Post('change-init')
  async changeInit(@Request() req) {
    const email = req.user?.email;
    return this.authService.requestPasswordReset(email);
  }

  // Change password confirm (reuse reset)
  @Post('change-confirm')
  async changeConfirm(@Body() body: any) {
    const { token, newPassword } = body || {};
    if (!token || !newPassword) throw new BadRequestException('Token and newPassword are required');
    return this.authService.resetPasswordWithToken(token, newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    // Return full user with department and other fields
    return this.usersService.findByEmail(req.user.email);
  }
}
