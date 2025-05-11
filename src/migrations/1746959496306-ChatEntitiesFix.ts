import { MigrationInterface, QueryRunner } from "typeorm";

export class ChatEntitiesFix1746959496306 implements MigrationInterface {
    name = 'ChatEntitiesFix1746959496306'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat" DROP CONSTRAINT "FK_c6c38c4b1c710822e338dde8dee"`);
        await queryRunner.query(`ALTER TABLE "chat" RENAME COLUMN "assignedUserUserId" TO "userUserId"`);
        await queryRunner.query(`ALTER TABLE "chat" ADD CONSTRAINT "FK_9679ab3362738c96db3a85322b0" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat" DROP CONSTRAINT "FK_9679ab3362738c96db3a85322b0"`);
        await queryRunner.query(`ALTER TABLE "chat" RENAME COLUMN "userUserId" TO "assignedUserUserId"`);
        await queryRunner.query(`ALTER TABLE "chat" ADD CONSTRAINT "FK_c6c38c4b1c710822e338dde8dee" FOREIGN KEY ("assignedUserUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
