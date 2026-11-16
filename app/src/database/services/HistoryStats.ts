import { AppDataSource } from "../dataSource";
import { QueryRunner } from "typeorm";
import { ModelCount } from "../../types/ModelCount";

class HistoryStats {
  private queryRunner: QueryRunner;

  constructor() {
    this.queryRunner = AppDataSource.createQueryRunner();
  }

  async getModelCounts(): Promise<ModelCount[]> {
    await this.queryRunner.connect();
    
    try {
      const result = await this.queryRunner.query(`
        SELECT
            COUNT(*) as count,
            ltmv.string_meta_value as model
        FROM contents c
        LEFT JOIN meta_names nm ON nm.content_id = c.id
        LEFT JOIN long_text_meta_value ltmv ON ltmv.meta_names_id = nm.id
        WHERE nm.meta_name = 'model'
        GROUP BY ltmv.string_meta_value
        ORDER BY count DESC
      `);

      return result as ModelCount[];
    } finally {
      await this.queryRunner.release();
    }
  }
}

export default HistoryStats;