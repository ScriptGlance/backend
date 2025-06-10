import { MigrationInterface, QueryRunner } from 'typeorm';

export class Profiles1749554042052 implements MigrationInterface {
  name = 'Profiles1749554042052';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "moderator" DROP COLUMN "google_id"`);
    await queryRunner.query(
      `ALTER TABLE "moderator" DROP COLUMN "facebook_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "moderator" DROP COLUMN "refresh_token"`,
    );
    await queryRunner.query(
      `ALTER TABLE "moderator" DROP COLUMN "access_token"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "google_id"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "facebook_id"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "refresh_token"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "access_token"`);
    await queryRunner.query(`ALTER TABLE "admin" DROP COLUMN "google_id"`);
    await queryRunner.query(`ALTER TABLE "admin" DROP COLUMN "facebook_id"`);
    await queryRunner.query(`ALTER TABLE "admin" DROP COLUMN "refresh_token"`);
    await queryRunner.query(`ALTER TABLE "admin" DROP COLUMN "access_token"`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD "fcm_token" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "fcm_token"`);
    await queryRunner.query(
      `ALTER TABLE "admin" ADD "access_token" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin" ADD "refresh_token" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin" ADD "facebook_id" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin" ADD "google_id" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "access_token" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "refresh_token" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "facebook_id" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "google_id" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "moderator" ADD "access_token" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "moderator" ADD "refresh_token" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "moderator" ADD "facebook_id" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "moderator" ADD "google_id" character varying`,
    );
  }
}
