import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialEntities1746477816646 implements MigrationInterface {
  name = 'InitialEntities1746477816646';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "presentation_part" ("presentation_part_id" SERIAL NOT NULL, "presentation_id" integer NOT NULL, "assignee_participant_id" integer, "name" character varying(255) NOT NULL, "text" character varying NOT NULL, "order" integer NOT NULL, CONSTRAINT "PK_84434c3c9f35724581e4095d89b" PRIMARY KEY ("presentation_part_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "invitation" ("invitation_id" SERIAL NOT NULL, "presentation_id" integer NOT NULL, "code" character varying(200) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d23721ee8274af12ae925994257" UNIQUE ("code"), CONSTRAINT "PK_693b75c7dec5bc338a8927a8f72" PRIMARY KEY ("invitation_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "presentation" ("presentation_id" SERIAL NOT NULL, "name" character varying(1000) NOT NULL, "owner_participant_id" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "modified_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "REL_7c4478210eb9775813feb1f38b" UNIQUE ("owner_participant_id"), CONSTRAINT "PK_6d3bac9bb0e80f2a2b7a4bdaec6" PRIMARY KEY ("presentation_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "participant" ("participant_id" SERIAL NOT NULL, "presentation_id" integer NOT NULL, "user_id" integer NOT NULL, "color" character varying(50) NOT NULL, "assignedPartsPresentationPartId" integer, CONSTRAINT "PK_389013d0d0a8cd76f64a767f2fa" PRIMARY KEY ("participant_id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscription_status_enum" AS ENUM('active', 'past_due', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscription" ("subscription_id" SERIAL NOT NULL, "status" "public"."subscription_status_enum" NOT NULL DEFAULT 'active', "next_payment_date" TIMESTAMP NOT NULL, "start_date" TIMESTAMP NOT NULL, "wallet_id" integer NOT NULL, "cancellation_date" TIMESTAMP, "user_id" integer, CONSTRAINT "REL_940d49a105d50bbd616be54001" UNIQUE ("user_id"), CONSTRAINT "PK_05fb2b68e4d0d5deb240c7f4105" PRIMARY KEY ("subscription_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("user_id" SERIAL NOT NULL, "first_name" character varying(100) NOT NULL, "last_name" character varying(100) NOT NULL, "password" character varying(255) NOT NULL, "email" character varying(100) NOT NULL, "avatar" character varying, "is_temporary_password" boolean NOT NULL DEFAULT false, "google_id" character varying, "facebook_id" character varying, "refresh_token" character varying, "access_token" character varying, "deleted_at" TIMESTAMP, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_758b8ce7c18b9d347461b30228d" PRIMARY KEY ("user_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "admin" ("admin_id" SERIAL NOT NULL, "password" character varying(255) NOT NULL, "email" character varying(100) NOT NULL, "google_id" character varying, "facebook_id" character varying, "refresh_token" character varying, "access_token" character varying, CONSTRAINT "UQ_de87485f6489f5d0995f5841952" UNIQUE ("email"), CONSTRAINT "PK_08603203f2c50664bda27b1ff89" PRIMARY KEY ("admin_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "moderator" ("moderator_id" SERIAL NOT NULL, "first_name" character varying(100) NOT NULL, "last_name" character varying(100) NOT NULL, "avatar" character varying, "password" character varying(255) NOT NULL, "email" character varying(100) NOT NULL, "google_id" character varying, "facebook_id" character varying, "refresh_token" character varying, "access_token" character varying, CONSTRAINT "UQ_88a8d63fa32bea8ef71b7ca8983" UNIQUE ("email"), CONSTRAINT "PK_2d72d777f5d168ca6bc4529e7a3" PRIMARY KEY ("moderator_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "password_reset_token" ("password_reset_token_id" SERIAL NOT NULL, "token" character varying NOT NULL, "expires_at" TIMESTAMP NOT NULL, "userUserId" integer, "adminAdminId" integer, "moderatorModeratorId" integer, CONSTRAINT "PK_9a5bac372c3970f2864a9ffa03a" PRIMARY KEY ("password_reset_token_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "email_verification_code" ("email_verification_code_id" SERIAL NOT NULL, "email" character varying(100) NOT NULL, "expires_at" TIMESTAMP NOT NULL, "verification_code" character varying(10) NOT NULL, "is_verified" boolean NOT NULL, CONSTRAINT "PK_a154e82f3c898e60436413036ff" PRIMARY KEY ("email_verification_code_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "presentation_part" ADD CONSTRAINT "FK_1f815991914ae2f81b530ff1d8f" FOREIGN KEY ("presentation_id") REFERENCES "presentation"("presentation_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "presentation_part" ADD CONSTRAINT "FK_3bcd986a07192bb506f16ec4824" FOREIGN KEY ("assignee_participant_id") REFERENCES "participant"("participant_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitation" ADD CONSTRAINT "FK_acdf3ac45466a2fdce756ea0bb7" FOREIGN KEY ("presentation_id") REFERENCES "presentation"("presentation_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "presentation" ADD CONSTRAINT "FK_7c4478210eb9775813feb1f38be" FOREIGN KEY ("owner_participant_id") REFERENCES "participant"("participant_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant" ADD CONSTRAINT "FK_1309e43b80f150937560b2daa4d" FOREIGN KEY ("presentation_id") REFERENCES "presentation"("presentation_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant" ADD CONSTRAINT "FK_7916773e236a9cfc13d59f96a4a" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant" ADD CONSTRAINT "FK_ce3f111220463d3139bef106404" FOREIGN KEY ("assignedPartsPresentationPartId") REFERENCES "presentation_part"("presentation_part_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD CONSTRAINT "FK_940d49a105d50bbd616be540013" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_token" ADD CONSTRAINT "FK_73ebd61fdb9ef45ef43b4ff3491" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_token" ADD CONSTRAINT "FK_964510065802c31007bcb1ca06d" FOREIGN KEY ("adminAdminId") REFERENCES "admin"("admin_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_token" ADD CONSTRAINT "FK_f9a6b321f42cb10db79fd2f6618" FOREIGN KEY ("moderatorModeratorId") REFERENCES "moderator"("moderator_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`CREATE VIEW "user_with_premium" AS 
    SELECT
      u.user_id                     AS user_id,
      u.first_name                  AS first_name,
      u.last_name                   AS last_name,
      COALESCE(s.status = 'active', FALSE)
        AS has_premium
    FROM "user" u
    LEFT JOIN subscription s
      ON s.user_id = u.user_id
  `);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'user_with_premium',
        'SELECT\n      u.user_id                     AS user_id,\n      u.first_name                  AS first_name,\n      u.last_name                   AS last_name,\n      COALESCE(s.status = \'active\', FALSE)\n        AS has_premium\n    FROM "user" u\n    LEFT JOIN subscription s\n      ON s.user_id = u.user_id',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'user_with_premium', 'public'],
    );
    await queryRunner.query(`DROP VIEW "user_with_premium"`);
    await queryRunner.query(
      `ALTER TABLE "password_reset_token" DROP CONSTRAINT "FK_f9a6b321f42cb10db79fd2f6618"`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_token" DROP CONSTRAINT "FK_964510065802c31007bcb1ca06d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_token" DROP CONSTRAINT "FK_73ebd61fdb9ef45ef43b4ff3491"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" DROP CONSTRAINT "FK_940d49a105d50bbd616be540013"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant" DROP CONSTRAINT "FK_ce3f111220463d3139bef106404"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant" DROP CONSTRAINT "FK_7916773e236a9cfc13d59f96a4a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant" DROP CONSTRAINT "FK_1309e43b80f150937560b2daa4d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "presentation" DROP CONSTRAINT "FK_7c4478210eb9775813feb1f38be"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitation" DROP CONSTRAINT "FK_acdf3ac45466a2fdce756ea0bb7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "presentation_part" DROP CONSTRAINT "FK_3bcd986a07192bb506f16ec4824"`,
    );
    await queryRunner.query(
      `ALTER TABLE "presentation_part" DROP CONSTRAINT "FK_1f815991914ae2f81b530ff1d8f"`,
    );
    await queryRunner.query(`DROP TABLE "email_verification_code"`);
    await queryRunner.query(`DROP TABLE "password_reset_token"`);
    await queryRunner.query(`DROP TABLE "moderator"`);
    await queryRunner.query(`DROP TABLE "admin"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "subscription"`);
    await queryRunner.query(`DROP TYPE "public"."subscription_status_enum"`);
    await queryRunner.query(`DROP TABLE "participant"`);
    await queryRunner.query(`DROP TABLE "presentation"`);
    await queryRunner.query(`DROP TABLE "invitation"`);
    await queryRunner.query(`DROP TABLE "presentation_part"`);
  }
}
