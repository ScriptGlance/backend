import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany} from 'typeorm';
import {ModeratorEntity} from "./ModeratorEntity";
import {ChatMessageEntity} from "./ChatMessageEntity";
import {UserEntity} from "./UserEntity";

@Entity('chat')
export class ChatEntity {
    @PrimaryGeneratedColumn({ name: 'chat_id' })
    chatId: number;

    @Column({ name: 'is_active' })
    isActive: boolean;

    @Column({ name: 'creation_date' })
    creationDate: Date;

    @ManyToOne(() => ModeratorEntity,
        (moderator) => moderator.assignedChats,
        { nullable: true },
    )
    assignedModerator?: ModeratorEntity;

    @ManyToOne(() => UserEntity, (user) => user.chats)
    user: UserEntity;

    @OneToMany(() => ChatMessageEntity, (chatMessage) => chatMessage.chat)
    chatMessages: ChatMessageEntity[];
}
