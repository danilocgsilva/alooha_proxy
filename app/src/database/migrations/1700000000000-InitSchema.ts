import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "contents" (
        "id" SERIAL PRIMARY KEY
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "meta_names" (
        "id" SERIAL PRIMARY KEY,
        "meta_name" VARCHAR NOT NULL,
        "content_id" INTEGER NOT NULL,
        CONSTRAINT "fk_meta_names_content" FOREIGN KEY ("content_id") REFERENCES "contents"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "long_text_meta_value" (
        "id" SERIAL PRIMARY KEY,
        "string_meta_value" TEXT NOT NULL,
        "meta_names_id" INTEGER NOT NULL,
        CONSTRAINT "fk_long_text_meta_name" FOREIGN KEY ("meta_names_id") REFERENCES "meta_names"("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "long_text_meta_value"`);
    await queryRunner.query(`DROP TABLE "meta_names"`);
    await queryRunner.query(`DROP TABLE "contents"`);
  }
}
