import { MigrationInterface, QueryRunner } from "typeorm";

export class UserInvitation1747234310069 implements MigrationInterface {
    name = 'UserInvitation1747234310069'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "participant" DROP CONSTRAINT "FK_79deb1386e748e1443fe36215c6"`);
        await queryRunner.query(`CREATE TABLE "user_invitation" ("user_invitation_id" SERIAL NOT NULL, "user_id" integer NOT NULL, "invitation_id" integer NOT NULL, CONSTRAINT "PK_62a0d558ce1e25c5ba024b7f4f7" PRIMARY KEY ("user_invitation_id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_user_invitation" ON "user_invitation" ("user_id", "invitation_id") `);
        await queryRunner.query(`ALTER TABLE "participant" DROP COLUMN "invitationInvitationId"`);
        await queryRunner.query(`ALTER TABLE "user_invitation" ADD CONSTRAINT "FK_79f68a9007a10c9fa07febc9e1c" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_invitation" ADD CONSTRAINT "FK_0e701dda737cd11f704b0a14b29" FOREIGN KEY ("invitation_id") REFERENCES "invitation"("invitation_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_invitation" DROP CONSTRAINT "FK_0e701dda737cd11f704b0a14b29"`);
        await queryRunner.query(`ALTER TABLE "user_invitation" DROP CONSTRAINT "FK_79f68a9007a10c9fa07febc9e1c"`);
        await queryRunner.query(`ALTER TABLE "participant" ADD "invitationInvitationId" integer`);
        await queryRunner.query(`DROP INDEX "public"."UQ_user_invitation"`);
        await queryRunner.query(`DROP TABLE "user_invitation"`);
        await queryRunner.query(`ALTER TABLE "participant" ADD CONSTRAINT "FK_79deb1386e748e1443fe36215c6" FOREIGN KEY ("invitationInvitationId") REFERENCES "invitation"("invitation_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
