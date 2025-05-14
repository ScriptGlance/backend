import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';
import {PresentationEntity} from './PresentationEntity';
import { UserInvitationEntity } from './UserInvitationEntity';

@Entity('invitation')
export class InvitationEntity {
    @PrimaryGeneratedColumn({name: 'invitation_id'})
    invitationId: number;

    @Column({name: 'presentation_id'})
    presentationId: number;

    @Column({name: 'code', length: 200, unique: true})
    code: string;

    @CreateDateColumn({name: 'created_at'})
    createdAt: Date;

    @ManyToOne(
        () => PresentationEntity,
        (presentation) => presentation.invitations,
    )
    @JoinColumn({name: 'presentation_id'})
    presentation: PresentationEntity;
    
    @OneToMany(() => UserInvitationEntity, (userInvitation) => userInvitation.invitation)
    userInvitations: UserInvitationEntity[];
}
