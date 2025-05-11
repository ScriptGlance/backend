import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SocialAccountDto } from './dto/GoogleAccountDto';
import { Role } from '../common/enum/Role';
import { ErrorWithRedirectException } from '../common/exception/ErrorWithRedirectException';
import { Request } from 'express';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('FACEBOOK_APP_ID')!,
      clientSecret: configService.get<string>('FACEBOOK_APP_SECRET')!,
      callbackURL: configService.get<string>('FACEBOOK_CALLBACK_URL')!,
      profileFields: ['id', 'emails', 'name', 'photos'],
      scope: ['email'],
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
    done: (error: any, user?: any) => void,
  ) {
    const { name, emails, photos } = profile;
    const rawState = request.query.state as string;
    const role: Role = rawState ? (rawState as Role) : Role.User;

    if (!emails) {
      return done(
        new ErrorWithRedirectException(
          'No emails in the Facebook account',
          this.configService.get<string>(
            'FACEBOOK_NO_LINKED_EMAIL_ERROR_REDIRECT_URL',
          )!,
        ),
        {},
      );
    }

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
    return done(null, validatedUser);
  }
}
