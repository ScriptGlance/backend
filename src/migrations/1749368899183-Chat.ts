import { MigrationInterface, QueryRunner } from 'typeorm';

export class Chat1749368899183 implements MigrationInterface {
  name = 'Chat.ts1749368899183';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP CONSTRAINT "FK_e9ecc59698e21bad9c9b5ec8aac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD CONSTRAINT "FK_e9ecc59698e21bad9c9b5ec8aac" FOREIGN KEY ("chatChatId") REFERENCES "chat"("chat_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP CONSTRAINT "FK_e9ecc59698e21bad9c9b5ec8aac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD CONSTRAINT "FK_e9ecc59698e21bad9c9b5ec8aac" FOREIGN KEY ("chatChatId") REFERENCES "chat"("chat_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
