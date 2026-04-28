import "reflect-metadata";
import { DataSource } from "typeorm";
import { Content } from "./entities/Content";
import { MetaName } from "./entities/MetaName";
import { LongTextMetaValue } from "./entities/LongTextMetaValue";
import { InitSchema1700000000000 } from "./migrations/1700000000000-InitSchema";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "alooha",
  entities: [Content, MetaName, LongTextMetaValue],
  migrations: [InitSchema1700000000000],
  migrationsRun: false,
});
