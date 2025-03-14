import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/UserEntity';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/RegisterDto';
import { LoginDto } from './dto/LoginDto';
import { ForgotPasswordDto } from './dto/ForgotPasswordDto';
import { ResetPasswordDto } from './dto/ResetPasswordDto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });
    if (existingUser) {
      throw new UnauthorizedException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = this.userRepository.create({
      ...registerDto,
      password: hashedPassword,
    });
    await this.userRepository.save(user);
    console.log('Registering user:', registerDto.email);
    return { message: 'User registered successfully' };
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const passwordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Prepare payload for JWT
    const payload = { sub: user.userId, email: user.email };

    // Generate tokens using JwtService
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // Optionally, store the refresh token in the database
    user.refreshToken = refreshToken;
    await this.userRepository.save(user);

    console.log('Logging in user:', loginDto.email);
    return { accessToken, refreshToken };
  }

  async logout(user: UserEntity): Promise<{ message: string }> {
    user.refreshToken = undefined;
    await this.userRepository.save(user);
    console.log('Logging out user:', user.email);
    return { message: 'User logged out successfully' };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userRepository.findOne({
      where: { refreshToken },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newAccessToken = this.jwtService.sign(
      { sub: user.userId, email: user.email },
      { expiresIn: '15m' },
    );
    console.log('Refreshing token for user:', user.email);
    return { accessToken: newAccessToken };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { email: forgotPasswordDto.email },
    });
    if (!user) {
      return { message: 'Password reset instructions sent to your email' };
    }

    user.refreshToken = this.jwtService.sign(
      { sub: user.userId, email: user.email },
      { expiresIn: '1h' },
    );
    await this.userRepository.save(user);

    console.log('Password reset requested for:', forgotPasswordDto.email);
    return { message: 'Password reset instructions sent to your email' };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { refreshToken: resetPasswordDto.token },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid reset token');
    }

    user.password = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    // Clear the reset token once used
    user.refreshToken = undefined;
    await this.userRepository.save(user);

    console.log('Resetting password using token:', resetPasswordDto.token);
    return { message: 'Password reset successfully' };
  }
}
