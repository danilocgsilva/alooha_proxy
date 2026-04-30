import { MigrationInterface, QueryRunner } from "typeorm";

export class MetaNameSelfRelation1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "meta_names"
        ADD COLUMN "parent_id" INTEGER,
        ADD CONSTRAINT "fk_meta_names_parent" FOREIGN KEY ("parent_id") REFERENCES "meta_names"("id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "meta_names"
        DROP CONSTRAINT "fk_meta_names_parent",
        DROP COLUMN "parent_id"
    `);
  }
}
