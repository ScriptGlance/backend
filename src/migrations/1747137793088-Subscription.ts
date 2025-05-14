import { MigrationInterface, QueryRunner } from 'typeorm';

export class Subscription1747137793088 implements MigrationInterface {
  name = 'Subscription1747137793088';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS "user_with_premium"`);

    await queryRunner.query(
      `ALTER TYPE "public"."subscription_status_enum" RENAME TO "subscription_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscription_status_enum" AS ENUM('active', 'past_due', 'cancelled', 'created')`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(`
            ALTER TABLE "subscription"
                ALTER COLUMN "status" TYPE "public"."subscription_status_enum"
                    USING "status"::text::"public"."subscription_status_enum"
        `);
    await queryRunner.query(
      `ALTER TABLE "subscription" ALTER COLUMN "status" SET DEFAULT 'created'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."subscription_status_enum_old"`,
    );

    await queryRunner.query(
      `ALTER TABLE "subscription" ALTER COLUMN "next_payment_date" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ALTER COLUMN "start_date" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" DROP COLUMN "wallet_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD "wallet_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD CONSTRAINT "UQ_cb1fe31518d3a71eba0f7d71587" UNIQUE ("wallet_id")`,
    );

    await queryRunner.query(`
          CREATE VIEW "user_with_premium" AS
          SELECT
            u.user_id                     AS user_id,
            u.first_name                  AS first_name,
            u.last_name                   AS last_name,
            COALESCE(s.status = 'active', FALSE) AS has_premium
          FROM "user" u
          LEFT JOIN subscription s
            ON s.user_id = u.user_id
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS "user_with_premium"`);

    await queryRunner.query(
      `ALTER TABLE "subscription" DROP CONSTRAINT "UQ_cb1fe31518d3a71eba0f7d71587"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" DROP COLUMN "wallet_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD "wallet_id" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ALTER COLUMN "start_date" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ALTER COLUMN "next_payment_date" SET NOT NULL`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."subscription_status_enum_old" AS ENUM('active', 'past_due', 'cancelled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(`
            ALTER TABLE "subscription"
                ALTER COLUMN "status" TYPE "public"."subscription_status_enum_old"
                    USING "status"::text::"public"."subscription_status_enum_old"
        `);
    await queryRunner.query(
      `ALTER TABLE "subscription" ALTER COLUMN "status" SET DEFAULT 'active'`,
    );
    await queryRunner.query(`DROP TYPE "public"."subscription_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."subscription_status_enum_old" RENAME TO "subscription_status_enum"`,
    );

    await queryRunner.query(`
          CREATE VIEW "user_with_premium" AS
          SELECT
            u.user_id                     AS user_id,
            u.first_name                  AS first_name,
            u.last_name                   AS last_name,
            COALESCE(s.status = 'active', FALSE) AS has_premium
          FROM "user" u
          LEFT JOIN subscription s
            ON s.user_id = u.user_id
        `);
  }
}
