import { MigrationInterface, QueryRunner } from "typeorm";

export class Transactions1747149352851 implements MigrationInterface {
    name = 'Transactions1747149352851'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" ADD "is_card_updating" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "is_card_updating"`);
    }

}
