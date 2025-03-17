import {Injectable, Logger} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import {GoogleAccountDto} from "./dto/GoogleAccountDto";
import {Role} from "../common/enum/Role";
import {AuthService} from "./auth.service";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(configService: ConfigService, private authService: AuthService) {
        super({
            clientID: configService.get<string>('GOOGLE_CLIENT_ID')!,
            clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET')!,
            callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL')!,
            scope: ['email', 'profile'],
            passReqToCallback: true
        });
    }

    async validate(
        request: any,
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: VerifyCallback
    ) {
        const {name, emails, photos} = profile;
        const role: Role = request.query.role || Role.User;

        const user: GoogleAccountDto = {
            email: emails[0].value,
            firstName: `${name.givenName}`,
            lastName: `${name.familyName}`,
            photoUrl: photos[0].value,
            accessToken,
            refreshToken,
            role,
        };

        const validatedUser = await this.authService.validateGoogleAccount(user);
        done(null, validatedUser);
    }
}
