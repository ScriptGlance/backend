// src/db/data-source.ts
import 'dotenv/config';
import {DataSource, DataSourceOptions} from 'typeorm';
import {UserEntity} from './src/common/entities/UserEntity';
import {AdminEntity} from './src/common/entities/AdminEntity';
import {ModeratorEntity} from './src/common/entities/ModeratorEntity';
import {PasswordResetTokenEntity} from './src/common/entities/PasswordResetTokenEntity';
import {EmailVerificationCodeEntity} from './src/common/entities/EmailVerificationCodeEntity';
import {InvitationEntity} from './src/common/entities/InvitationEntity';
import {ParticipantEntity} from './src/common/entities/ParticipantEntity';
import {PresentationEntity} from './src/common/entities/PresentationEntity';
import {PresentationPartEntity} from './src/common/entities/PresentationPartEntity';
import {UserWithPremiumEntity} from './src/common/entities/UserWithPremiumEntity';
import {SubscriptionEntity} from './src/common/entities/SubscriptionEntity';
import {PresentationStartEntity} from "./src/common/entities/PresentationStartEntity";
import {VideoEntity} from "./src/common/entities/VideoEntity";
import {ChatMessageEntity} from "./src/common/entities/ChatMessageEntity";
import {ChatEntity} from "./src/common/entities/ChatEntity";

export const dataSourceOptions: DataSourceOptions = {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT!,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [
        UserEntity,
        ModeratorEntity,
        AdminEntity,
        PasswordResetTokenEntity,
        EmailVerificationCodeEntity,
        InvitationEntity,
        ParticipantEntity,
        PresentationEntity,
        PresentationPartEntity,
        UserWithPremiumEntity,
        SubscriptionEntity,
        PresentationStartEntity,
        VideoEntity,
        ChatEntity,
        ChatMessageEntity
    ],
    migrations: ['dist/src/migrations/*.js'],
    synchronize: false,
};

export default new DataSource(dataSourceOptions);
