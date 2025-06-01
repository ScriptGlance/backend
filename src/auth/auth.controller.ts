import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/RegisterDto';
import { LoginDto } from './dto/LoginDto';
import { ForgotPasswordDto } from './dto/ForgotPasswordDto';
import { ResetPasswordDto } from './dto/ResetPasswordDto';
import { ApiBody } from '@nestjs/swagger';
import { VerifyEmailDto } from './dto/VerifyEmailDto';
import { SendVerificationEmailDto } from './dto/SendVerificationEmailDto';
import { AuthGuard } from '@nestjs/passport';
import { TokenResponseDto } from './dto/TokenResponseDto';
import { StandardResponse } from '../common/interface/StandardResponse';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthGuard } from './google.guard';
import { FacebookAuthGuard } from './facebook.guard';
import { UserEntity } from '../common/entities/UserEntity';
import { ModeratorEntity } from '../common/entities/ModeratorEntity';
import { AdminEntity } from '../common/entities/AdminEntity';
import { Response } from 'express';
import { MobileSocialLoginDto } from './dto/MobileSocialLoginDto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @UseGuards(GoogleAuthGuard)
  @Get('google')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async googleAuth(@Query('role') role: string) {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(
    @Req() req: Request & { user: UserEntity | ModeratorEntity | AdminEntity },
    @Res() res: Response,
  ) {
    const token = this.authService.generateAuthToken(req.user);
    res.redirect(
      `${this.configService.get<string>('SUCCESS_LOGIN_REDIRECT_URL')}?token=${token}`,
    );
  }

  @Get('facebook')
  @UseGuards(FacebookAuthGuard)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async facebookAuth(@Query('role') role: string) {}

  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  facebookAuthRedirect(
    @Req() req: Request & { user: UserEntity | ModeratorEntity | AdminEntity },
    @Res() res: Response,
  ) {
    const token = this.authService.generateAuthToken(req.user);
    res.redirect(
      `${this.configService.get<string>('SUCCESS_LOGIN_REDIRECT_URL')}?token=${token}`,
    );
  }

  @Post('mobile-social-login')
  @ApiBody({ type: MobileSocialLoginDto })
  async mobileSocialLogin(@Body() dto: MobileSocialLoginDto) {
    return this.authService.mobileSocialLogin(dto);
  }

  @Post('register')
  @ApiBody({ type: RegisterDto })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiBody({ type: LoginDto })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('forgot-password')
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('send-verification-email')
  @ApiBody({ type: SendVerificationEmailDto })
  async sendVerificationEmail(
    @Body() sendVerificationEmailDto: SendVerificationEmailDto,
  ) {
    return this.authService.sendVerificationEmail(sendVerificationEmailDto);
  }

  @Post('verify-email')
  @ApiBody({ type: VerifyEmailDto })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }
}
