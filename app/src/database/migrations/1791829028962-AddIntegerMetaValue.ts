import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIntegerMetaValue1791829028962 implements MigrationInterface {
    name = 'AddIntegerMetaValue1791829028962'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "question_options" DROP CONSTRAINT "fk_question_options_content"`);
        await queryRunner.query(`ALTER TABLE "long_text_meta_value" DROP CONSTRAINT "fk_long_text_meta_name"`);
        await queryRunner.query(`ALTER TABLE "meta_names" DROP CONSTRAINT "fk_meta_names_content"`);
        await queryRunner.query(`ALTER TABLE "meta_names" DROP CONSTRAINT "fk_meta_names_parent"`);
        await queryRunner.query(`CREATE TABLE "integer_meta_value" ("id" SERIAL NOT NULL, "int_meta_value" integer NOT NULL, "meta_names_id" integer NOT NULL, CONSTRAINT "REL_407ae9e441de547654b996740c" UNIQUE ("meta_names_id"), CONSTRAINT "PK_73f9615a226d42e1a9b46b62262" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "long_text_meta_value" ADD CONSTRAINT "UQ_c74024970f8d8e7ae0c46ff85da" UNIQUE ("meta_names_id")`);
        await queryRunner.query(`ALTER TABLE "question_options" ADD CONSTRAINT "FK_62bc5069dbd9a3a42070650d914" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "long_text_meta_value" ADD CONSTRAINT "FK_c74024970f8d8e7ae0c46ff85da" FOREIGN KEY ("meta_names_id") REFERENCES "meta_names"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integer_meta_value" ADD CONSTRAINT "FK_407ae9e441de547654b996740ce" FOREIGN KEY ("meta_names_id") REFERENCES "meta_names"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "meta_names" ADD CONSTRAINT "FK_ac42caf08fb8345c9a5adf7bb04" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "meta_names" ADD CONSTRAINT "FK_504407176abdd355230d4a4f421" FOREIGN KEY ("parent_id") REFERENCES "meta_names"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meta_names" DROP CONSTRAINT "FK_504407176abdd355230d4a4f421"`);
        await queryRunner.query(`ALTER TABLE "meta_names" DROP CONSTRAINT "FK_ac42caf08fb8345c9a5adf7bb04"`);
        await queryRunner.query(`ALTER TABLE "integer_meta_value" DROP CONSTRAINT "FK_407ae9e441de547654b996740ce"`);
        await queryRunner.query(`ALTER TABLE "long_text_meta_value" DROP CONSTRAINT "FK_c74024970f8d8e7ae0c46ff85da"`);
        await queryRunner.query(`ALTER TABLE "question_options" DROP CONSTRAINT "FK_62bc5069dbd9a3a42070650d914"`);
        await queryRunner.query(`ALTER TABLE "long_text_meta_value" DROP CONSTRAINT "UQ_c74024970f8d8e7ae0c46ff85da"`);
        await queryRunner.query(`DROP TABLE "integer_meta_value"`);
        await queryRunner.query(`ALTER TABLE "meta_names" ADD CONSTRAINT "fk_meta_names_parent" FOREIGN KEY ("parent_id") REFERENCES "meta_names"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "meta_names" ADD CONSTRAINT "fk_meta_names_content" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "long_text_meta_value" ADD CONSTRAINT "fk_long_text_meta_name" FOREIGN KEY ("meta_names_id") REFERENCES "meta_names"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "question_options" ADD CONSTRAINT "fk_question_options_content" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
