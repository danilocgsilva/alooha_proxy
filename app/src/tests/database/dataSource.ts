import { DataSource } from "typeorm";
import { Content } from "../../database/entities/Content";
import { MetaName } from "../../database/entities/MetaName";
import { LongTextMetaValue } from "../../database/entities/LongTextMetaValue";
import { QuestionOptions } from "../../database/entities/QuestionOptions";
import { InitSchema1700000000000 } from "../../database/migrations/1700000000000-InitSchema";
import { MetaNameSelfRelation1700000000001 } from "../../database/migrations/1700000000001-MetaNameSelfRelation";
import { QuestionOptions1700000000002 } from "../../database/migrations/1700000000002-QuestionOptions";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USER ?? "postgres",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_TEST_NAME ?? "alooha_proxy_test",
    entities: [Content, MetaName, LongTextMetaValue, QuestionOptions],
    migrations: [InitSchema1700000000000, MetaNameSelfRelation1700000000001, QuestionOptions1700000000002],
    migrationsRun: true,
});