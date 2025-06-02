import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { PresentationEntity } from './PresentationEntity';
import { ParticipantEntity } from './ParticipantEntity';

@Entity('presentation_part')
export class PresentationPartEntity {
  @PrimaryGeneratedColumn({ name: 'presentation_part_id' })
  presentationPartId: number;

  @Column({ name: 'presentation_id' })
  presentationId: number;

  @Column({ name: 'assignee_participant_id', nullable: true })
  assigneeParticipantId?: number | null;

  @Column({ name: 'name', length: 255 })
  name: string;

  @Column({ name: 'text' })
  text: string;

  @Column({ name: 'order' })
  order: number;

  @ManyToOne(() => PresentationEntity, (presentation) => presentation.parts)
  @JoinColumn({ name: 'presentation_id' })
  presentation: PresentationEntity;

  @ManyToOne(
    () => ParticipantEntity,
    (participant) => participant.assignedParts,
  )
  @JoinColumn({ name: 'assignee_participant_id' })
  assignee: ParticipantEntity;
}
