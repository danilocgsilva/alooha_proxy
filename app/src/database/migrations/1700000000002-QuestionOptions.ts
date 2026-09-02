import { MigrationInterface, QueryRunner } from "typeorm";

export class QuestionOptions1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "question_options" (
        "id" SERIAL PRIMARY KEY,
        "options" JSONB NOT NULL,
        "content_id" INTEGER NOT NULL UNIQUE,
        CONSTRAINT "fk_question_options_content" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "question_options"`);
  }
}
