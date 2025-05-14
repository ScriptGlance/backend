import { MigrationInterface, QueryRunner } from "typeorm";

export class Transaction1747139111223 implements MigrationInterface {
    name = 'Transaction1747139111223'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" ADD "amount" integer NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "amount"`);
    }

}
