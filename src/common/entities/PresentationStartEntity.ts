import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { VideoEntity } from './VideoEntity';
import { PresentationEntity } from './PresentationEntity';

@Entity('presentation_start')
export class PresentationStartEntity {
  @PrimaryGeneratedColumn({ name: 'presentation_start_id' })
  presentationStartId: number;

  @Column({ name: 'start_date' })
  startDate: Date;

  @Column({ name: 'end_date', nullable: true })
  endDate?: Date;

  @OneToMany(() => VideoEntity, (video) => video.presentationStart)
  videos: VideoEntity[];

  @ManyToOne(
    () => PresentationEntity,
    (presentation) => presentation.presentationStarts,
  )
  presentation: PresentationEntity;
}
