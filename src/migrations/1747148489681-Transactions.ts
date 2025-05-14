import { MigrationInterface, QueryRunner } from "typeorm";

export class Transactions1747148489681 implements MigrationInterface {
    name = 'Transactions1747148489681'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."transaction_type_enum" AS ENUM('payment', 'refund')`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "type" "public"."transaction_type_enum" NOT NULL DEFAULT 'payment'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "type"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_type_enum"`);
    }

}
