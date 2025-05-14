import { MigrationInterface, QueryRunner } from "typeorm";

export class ChatEntitiesFix21746960191082 implements MigrationInterface {
    name = 'ChatEntitiesFix21746960191082'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_message" DROP CONSTRAINT "FK_d9e12c62e59f37f13b648297609"`);
        await queryRunner.query(`ALTER TABLE "chat_message" RENAME COLUMN "assignedChatChatId" TO "chatChatId"`);
        await queryRunner.query(`ALTER TABLE "chat_message" ADD CONSTRAINT "FK_e9ecc59698e21bad9c9b5ec8aac" FOREIGN KEY ("chatChatId") REFERENCES "chat"("chat_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_message" DROP CONSTRAINT "FK_e9ecc59698e21bad9c9b5ec8aac"`);
        await queryRunner.query(`ALTER TABLE "chat_message" RENAME COLUMN "chatChatId" TO "assignedChatChatId"`);
        await queryRunner.query(`ALTER TABLE "chat_message" ADD CONSTRAINT "FK_d9e12c62e59f37f13b648297609" FOREIGN KEY ("assignedChatChatId") REFERENCES "chat"("chat_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
