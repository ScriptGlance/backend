import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { InvitationEntity } from './InvitationEntity';
import { UserEntity } from './UserEntity';

@Entity('user_invitation')
@Index('UQ_user_invitation', ['userId', 'invitationId'], { unique: true })
export class UserInvitationEntity {
    @PrimaryGeneratedColumn({name: 'user_invitation_id'})
    userInvitationId: number;

    @Column({name: 'user_id'})
    userId: number;

    @Column({name: 'invitation_id'})
    invitationId: number;

    @ManyToOne(() => UserEntity)
    @JoinColumn({name: 'user_id'})
    user: UserEntity;

    @ManyToOne(() => InvitationEntity)
    @JoinColumn({name: 'invitation_id'})
    invitation: InvitationEntity;
}
