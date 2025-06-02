import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';
import { ParticipantEntity } from './ParticipantEntity';
import { PresentationPartEntity } from './PresentationPartEntity';
import { InvitationEntity } from './InvitationEntity';
import { PresentationStartEntity } from './PresentationStartEntity';

@Entity('presentation')
export class PresentationEntity {
  @PrimaryGeneratedColumn({ name: 'presentation_id' })
  presentationId: number;

  @Column({ name: 'name', length: 1000 })
  name: string;

  @Column({ name: 'owner_participant_id', nullable: true })
  ownerParticipantId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'modified_at' })
  modifiedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true, default: null })
  deletedAt?: Date;

  @OneToMany(() => ParticipantEntity, (participant) => participant.presentation)
  participants: ParticipantEntity[];

  @OneToOne(() => ParticipantEntity)
  @JoinColumn({ name: 'owner_participant_id' })
  owner: ParticipantEntity;

  @OneToMany(() => PresentationPartEntity, (part) => part.presentation)
  parts: PresentationPartEntity[];

  @OneToMany(() => InvitationEntity, (invitation) => invitation.presentation)
  invitations: InvitationEntity[];

  @OneToMany(
    () => PresentationStartEntity,
    (presentationStart) => presentationStart.presentation,
  )
  presentationStarts: PresentationStartEntity[];
}
