import { MigrationInterface, QueryRunner } from "typeorm";

export class Payments1747130285371 implements MigrationInterface {
    name = 'Payments1747130285371'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "payment_card" ("payment_card_id" SERIAL NOT NULL, "token" character varying(500) NOT NULL, "payment_system" character varying(50) NOT NULL, "masked_number" character varying(19) NOT NULL, CONSTRAINT "PK_69381cd6349bf60bb9c6f827150" PRIMARY KEY ("payment_card_id"))`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_status_enum" AS ENUM('created', 'processing', 'hold', 'success', 'failure', 'reversed', 'expired')`);
        await queryRunner.query(`CREATE TABLE "transaction" ("transaction_id" SERIAL NOT NULL, "invoice_id" character varying NOT NULL, "status" "public"."transaction_status_enum" NOT NULL, "modified_date" TIMESTAMP NOT NULL, "currency" smallint NOT NULL, "subscription_id" integer NOT NULL, CONSTRAINT "PK_6e02e5a0a6a7400e1c944d1e946" PRIMARY KEY ("transaction_id"))`);
        await queryRunner.query(`ALTER TABLE "subscription" ADD "payment_card_id" integer`);
        await queryRunner.query(`ALTER TABLE "subscription" ADD CONSTRAINT "UQ_5ca0ba74dcf5e8bf86511e690b4" UNIQUE ("payment_card_id")`);
        await queryRunner.query(`ALTER TABLE "moderator" ADD "joined_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "moderator" ADD "deleted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "moderator" ADD "is_temporary_password" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ADD "registered_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "moderator" DROP CONSTRAINT "UQ_88a8d63fa32bea8ef71b7ca8983"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_moderator_email_not_deleted" ON "moderator" ("email") WHERE "deleted_at" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_user_email_not_deleted" ON "user" ("email") WHERE "deleted_at" IS NULL`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD CONSTRAINT "FK_279b6c6eac8ab4e784246bb9328" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("subscription_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subscription" ADD CONSTRAINT "FK_5ca0ba74dcf5e8bf86511e690b4" FOREIGN KEY ("payment_card_id") REFERENCES "payment_card"("payment_card_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subscription" DROP CONSTRAINT "FK_5ca0ba74dcf5e8bf86511e690b4"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP CONSTRAINT "FK_279b6c6eac8ab4e784246bb9328"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_user_email_not_deleted"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_moderator_email_not_deleted"`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email")`);
        await queryRunner.query(`ALTER TABLE "moderator" ADD CONSTRAINT "UQ_88a8d63fa32bea8ef71b7ca8983" UNIQUE ("email")`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "registered_at"`);
        await queryRunner.query(`ALTER TABLE "moderator" DROP COLUMN "is_temporary_password"`);
        await queryRunner.query(`ALTER TABLE "moderator" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "moderator" DROP COLUMN "joined_at"`);
        await queryRunner.query(`ALTER TABLE "subscription" DROP CONSTRAINT "UQ_5ca0ba74dcf5e8bf86511e690b4"`);
        await queryRunner.query(`ALTER TABLE "subscription" DROP COLUMN "payment_card_id"`);
        await queryRunner.query(`DROP TABLE "transaction"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_status_enum"`);
        await queryRunner.query(`DROP TABLE "payment_card"`);
    }

}
