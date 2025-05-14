import { MigrationInterface, QueryRunner } from "typeorm";

export class Invitation1747231965304 implements MigrationInterface {
    name = 'Invitation1747231965304'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "participant" ADD "invitationInvitationId" integer`);
        await queryRunner.query(`ALTER TABLE "participant" ADD CONSTRAINT "FK_79deb1386e748e1443fe36215c6" FOREIGN KEY ("invitationInvitationId") REFERENCES "invitation"("invitation_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "participant" DROP CONSTRAINT "FK_79deb1386e748e1443fe36215c6"`);
        await queryRunner.query(`ALTER TABLE "participant" DROP COLUMN "invitationInvitationId"`);
    }

}
