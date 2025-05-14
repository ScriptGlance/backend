import { MigrationInterface, QueryRunner } from "typeorm";

export class Transaction1747138458260 implements MigrationInterface {
    name = 'Transaction1747138458260'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" ALTER COLUMN "status" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" ALTER COLUMN "status" SET NOT NULL`);
    }

}
