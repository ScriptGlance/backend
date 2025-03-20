import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import {SocialAccountDto} from "./dto/GoogleAccountDto";
import {Role} from "../common/enum/Role";

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
    constructor(
        configService: ConfigService,
        private readonly authService: AuthService
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
        request: any,
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: (error: any, user?: any) => void
    ) {
        const { name, emails, photos } = profile;
        const role: Role = request.query.role || Role.User;

        const user: SocialAccountDto = {
            email: emails[0].value, //TODO emails can be null
            firstName: `${name.givenName}`,
            lastName: `${name.familyName}`,
            photoUrl: photos[0].value,
            accessToken,
            refreshToken,
            role
        };

        const validatedUser = await this.authService.validateSocialAccount(user);
        return done(null, validatedUser);
    }
}
