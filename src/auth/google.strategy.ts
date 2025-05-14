import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { SocialAccountDto } from './dto/GoogleAccountDto';
import { Role } from '../common/enum/Role';
import { AuthService } from './auth.service';
import { Request } from 'express';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID')!,
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL')!,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    request: Request,
    accessToken: string,
    refreshToken: string,
    profile: {
      name: {
        familyName: string;
        givenName: string;
      };
      emails: { value: string }[];
      photos: { value: string }[];
    },
    done: VerifyCallback,
  ) {
    const { name, emails, photos } = profile;
    const raw = request.query.state as string;
    const role = raw ? (raw as Role) : Role.User;

    const user: SocialAccountDto = {
      email: emails[0].value,
      firstName: `${name.givenName}`,
      lastName: `${name.familyName}`,
      photoUrl: photos[0].value,
      accessToken,
      refreshToken,
      role,
    };

    const validatedUser = await this.authService.validateSocialAccount(user);
    done(null, validatedUser);
  }
}
