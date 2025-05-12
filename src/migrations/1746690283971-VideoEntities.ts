import { MigrationInterface, QueryRunner } from "typeorm";

export class VideoEntities1746690283971 implements MigrationInterface {
    name = 'VideoEntities1746690283971'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "video" ("video_id" SERIAL NOT NULL, "duration" integer NOT NULL, "link" character varying(500) NOT NULL, "recording_start_date" TIMESTAMP NOT NULL, "title" character varying(500) NOT NULL, "photo_preview_link" character varying(500) NOT NULL, "share_code" character varying(200) NOT NULL, "deleted_at" TIMESTAMP, "presentationStartPresentationStartId" integer, "userUserId" integer, CONSTRAINT "UQ_6e22f12f2a964653811d86661ac" UNIQUE ("share_code"), CONSTRAINT "PK_a2b8f04e4376d1f0c6527e80b8b" PRIMARY KEY ("video_id"))`);
        await queryRunner.query(`CREATE TABLE "presentation_start" ("presentation_start_id" SERIAL NOT NULL, "start_date" TIMESTAMP NOT NULL, "end_date" TIMESTAMP, "presentationPresentationId" integer, CONSTRAINT "PK_abdd94f44708d6e17a24a220cbf" PRIMARY KEY ("presentation_start_id"))`);
        await queryRunner.query(`ALTER TABLE "video" ADD CONSTRAINT "FK_638e3b498aa4dd438d9bad59d44" FOREIGN KEY ("presentationStartPresentationStartId") REFERENCES "presentation_start"("presentation_start_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "video" ADD CONSTRAINT "FK_19d640d5219e6985fe4e2f6b616" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "presentation_start" ADD CONSTRAINT "FK_0ce6508c7e53e2388e9112357cf" FOREIGN KEY ("presentationPresentationId") REFERENCES "presentation"("presentation_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "presentation_start" DROP CONSTRAINT "FK_0ce6508c7e53e2388e9112357cf"`);
        await queryRunner.query(`ALTER TABLE "video" DROP CONSTRAINT "FK_19d640d5219e6985fe4e2f6b616"`);
        await queryRunner.query(`ALTER TABLE "video" DROP CONSTRAINT "FK_638e3b498aa4dd438d9bad59d44"`);
        await queryRunner.query(`DROP TABLE "presentation_start"`);
        await queryRunner.query(`DROP TABLE "video"`);
    }

}
