import { MigrationInterface, QueryRunner } from "typeorm";

export class ChatEntities1746957921739 implements MigrationInterface {
    name = 'ChatEntities1746957921739'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "chat_message" ("chat_message_id" SERIAL NOT NULL, "text" character varying(1000) NOT NULL, "sent_date" TIMESTAMP NOT NULL, "is_written_by_moderator" boolean NOT NULL, "is_read" boolean NOT NULL DEFAULT false, "assignedChatChatId" integer, CONSTRAINT "PK_25bdeb3d407c4f926d66a3bf721" PRIMARY KEY ("chat_message_id"))`);
        await queryRunner.query(`CREATE TABLE "chat" ("chat_id" SERIAL NOT NULL, "is_active" boolean NOT NULL, "creation_date" TIMESTAMP NOT NULL, "assignedModeratorModeratorId" integer, "assignedUserUserId" integer, CONSTRAINT "PK_415c34dcb5ad6193a9ea9dab25e" PRIMARY KEY ("chat_id"))`);
        await queryRunner.query(`ALTER TABLE "chat_message" ADD CONSTRAINT "FK_d9e12c62e59f37f13b648297609" FOREIGN KEY ("assignedChatChatId") REFERENCES "chat"("chat_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat" ADD CONSTRAINT "FK_ad19a288c51a540c50c7d6d4882" FOREIGN KEY ("assignedModeratorModeratorId") REFERENCES "moderator"("moderator_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat" ADD CONSTRAINT "FK_c6c38c4b1c710822e338dde8dee" FOREIGN KEY ("assignedUserUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat" DROP CONSTRAINT "FK_c6c38c4b1c710822e338dde8dee"`);
        await queryRunner.query(`ALTER TABLE "chat" DROP CONSTRAINT "FK_ad19a288c51a540c50c7d6d4882"`);
        await queryRunner.query(`ALTER TABLE "chat_message" DROP CONSTRAINT "FK_d9e12c62e59f37f13b648297609"`);
        await queryRunner.query(`DROP TABLE "chat"`);
        await queryRunner.query(`DROP TABLE "chat_message"`);
    }

}
