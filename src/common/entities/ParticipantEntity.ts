import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToOne,
  Unique,
} from 'typeorm';
import { PresentationEntity } from './PresentationEntity';
import { UserEntity } from './UserEntity';
import { PresentationPartEntity } from './PresentationPartEntity';

@Entity('participant')
@Unique(['presentation', 'user'])
export class ParticipantEntity {
  @PrimaryGeneratedColumn({ name: 'participant_id' })
  participantId: number;

  @Column({ name: 'presentation_id', nullable: true })
  presentationId: number | null;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'color', length: 50 })
  color: string;

  @ManyToOne(
    () => PresentationEntity,
    (presentation) => presentation.participants,
    { nullable: true },
  )
  @JoinColumn({ name: 'presentation_id' })
  presentation: PresentationEntity | null;

  @ManyToOne(() => UserEntity, (user) => user.participations)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @OneToOne(() => PresentationEntity, (presentation) => presentation.owner)
  ownedPresentation?: PresentationEntity;

  @ManyToOne(() => PresentationPartEntity, (part) => part.assignee)
  assignedParts: PresentationPartEntity[];
}
