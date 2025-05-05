import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserWithPremiumView1746444914102
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS user_with_premium`);
    await queryRunner.query(`
      CREATE VIEW user_with_premium AS
      SELECT
        u.user_id,
        COALESCE(s.status = 'active', FALSE) AS has_premium
      FROM "user" u
      LEFT JOIN subscription s ON s.user_id = u.user_id;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS user_with_premium`);
  }
}
