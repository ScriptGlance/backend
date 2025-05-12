import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    OneToOne, DeleteDateColumn, ManyToOne,
} from 'typeorm';
import { ParticipantEntity } from './ParticipantEntity';
import { SubscriptionEntity } from './SubscriptionEntity';
import { UserWithPremiumEntity } from './UserWithPremiumEntity';
import {PresentationStartEntity} from "./PresentationStartEntity";
import {UserEntity} from "./UserEntity";

@Entity('video')
export class VideoEntity {
    @PrimaryGeneratedColumn({ name: 'video_id' })
    videoId: number;

    @Column()
    duration: number;

    @Column({ length: 500 })
    link: string;

    @Column({ name: 'recording_start_date' })
    recordingStartDate: Date;

    @Column({ length: 500 })
    title: string;

    @Column({ name: 'photo_preview_link', length: 500 })
    photoPreviewLink: string;

    @Column({ name: 'share_code', length: 200, unique: true })
    shareCode: string;

    @DeleteDateColumn({ name: 'deleted_at', nullable: true })
    deletedAt?: Date;

    @ManyToOne(() => PresentationStartEntity, (presentationStart) => presentationStart.videos)
    presentationStart: PresentationStartEntity;

    @ManyToOne(() => UserEntity, (user) => user.videos)
    user: UserEntity;
}
