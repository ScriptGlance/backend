import {ChatMessageDto} from "./ChatMessageDto";

export class ModeratorChatMessageEventDto extends ChatMessageDto {
    is_new_chat: boolean
    chat_id: number
    user_full_name: string
}