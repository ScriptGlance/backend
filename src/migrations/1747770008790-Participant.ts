import { MigrationInterface, QueryRunner } from "typeorm";

export class Participant1747770008790 implements MigrationInterface {
    name = 'Participant1747770008790'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "participant" ADD CONSTRAINT "UQ_fbd73e04f244d245e812fa9eb87" UNIQUE ("presentation_id", "user_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "participant" DROP CONSTRAINT "UQ_fbd73e04f244d245e812fa9eb87"`);
    }

}
