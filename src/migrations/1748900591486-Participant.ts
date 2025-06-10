import { MigrationInterface, QueryRunner } from 'typeorm';

export class Participant1748900591486 implements MigrationInterface {
  name = 'Participant.ts1748900591486';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "participant" DROP CONSTRAINT "FK_1309e43b80f150937560b2daa4d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant" DROP CONSTRAINT "UQ_fbd73e04f244d245e812fa9eb87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant" ALTER COLUMN "presentation_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant" ADD CONSTRAINT "UQ_fbd73e04f244d245e812fa9eb87" UNIQUE ("presentation_id", "user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant" ADD CONSTRAINT "FK_1309e43b80f150937560b2daa4d" FOREIGN KEY ("presentation_id") REFERENCES "presentation"("presentation_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "participant" DROP CONSTRAINT "FK_1309e43b80f150937560b2daa4d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant" DROP CONSTRAINT "UQ_fbd73e04f244d245e812fa9eb87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant" ALTER COLUMN "presentation_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant" ADD CONSTRAINT "UQ_fbd73e04f244d245e812fa9eb87" UNIQUE ("presentation_id", "user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant" ADD CONSTRAINT "FK_1309e43b80f150937560b2daa4d" FOREIGN KEY ("presentation_id") REFERENCES "presentation"("presentation_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
