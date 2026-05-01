import "reflect-metadata";
import { DataSource } from "typeorm";
import { Content } from "../../../database/entities/Content";
import { MetaName } from "../../../database/entities/MetaName";
import { LongTextMetaValue } from "../../../database/entities/LongTextMetaValue";
import { InitSchema1700000000000 } from "../../../database/migrations/1700000000000-InitSchema";
import { MetaNameSelfRelation1700000000001 } from "../../../database/migrations/1700000000001-MetaNameSelfRelation";
import QuestionService from "../../../database/services/QuestionService";

const testDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USER ?? "postgres",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_TEST_NAME ?? "alooha_proxy_test",
    entities: [Content, MetaName, LongTextMetaValue],
    migrations: [InitSchema1700000000000, MetaNameSelfRelation1700000000001],
    migrationsRun: true,
});

beforeAll(async () => {
    await testDataSource.initialize();
});

afterAll(async () => {
    await testDataSource.destroy();
});

afterEach(async () => {
    await testDataSource.getRepository(LongTextMetaValue).clear();
    await testDataSource.getRepository(Content).clear();
    await testDataSource.getRepository(MetaName).clear();
});

describe("QuestionService", () => {
    it("saves a question creating one row in each table", async () => {
        const service = new QuestionService(testDataSource);
        service.setQuestion("What is the capital of France?");
        await service.save();

        expect(await testDataSource.getRepository(Content).count()).toBe(1);
        expect(await testDataSource.getRepository(MetaName).count()).toBe(1);

        const saved = await testDataSource.getRepository(LongTextMetaValue).findOne({ where: { string_meta_value: "What is the capital of France?" } });
        expect(saved?.string_meta_value).toBe("What is the capital of France?");
    });

    // it("resets between tests — tables should be empty", async () => {
    //     expect(await testDataSource.getRepository(Content).count()).toBe(0);
    //     expect(await testDataSource.getRepository(MetaName).count()).toBe(0);
    //     expect(await testDataSource.getRepository(LongTextMetaValue).count()).toBe(0);
    // });
});
