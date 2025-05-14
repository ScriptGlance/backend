import {Role} from "../../common/enum/Role";

export class SocialAccountDto {
    email: string;
    firstName: string;
    lastName: string;
    photoUrl?: string;
    accessToken: string;
    refreshToken: string;
    role: Role;
}