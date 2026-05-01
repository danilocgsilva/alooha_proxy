import "reflect-metadata";
import { DataSource } from "typeorm";
import { Content } from "../../database/entities/Content";
import { MetaName } from "../../database/entities/MetaName";
import { LongTextMetaValue } from "../../database/entities/LongTextMetaValue";
import { InitSchema1700000000000 } from "../../database/migrations/1700000000000-InitSchema";
import { MetaNameSelfRelation1700000000001 } from "../../database/migrations/1700000000001-MetaNameSelfRelation";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_TEST_NAME ?? "alooha",
  entities: [Content, MetaName, LongTextMetaValue],
  migrations: [InitSchema1700000000000, MetaNameSelfRelation1700000000001],
  migrationsRun: false,
});
