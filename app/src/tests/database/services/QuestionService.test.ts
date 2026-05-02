import "reflect-metadata";
import { DataSource } from "typeorm";
import { Content } from "../../../database/entities/Content";
import { MetaName } from "../../../database/entities/MetaName";
import { LongTextMetaValue } from "../../../database/entities/LongTextMetaValue";
import { InitSchema1700000000000 } from "../../../database/migrations/1700000000000-InitSchema";
import { MetaNameSelfRelation1700000000001 } from "../../../database/migrations/1700000000001-MetaNameSelfRelation";
import QuestionService from "../../../database/services/QuestionService";
import Meta from "../../../types/Meta";

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

const service = new QuestionService(testDataSource);

const truncateTableCascade = async function (tableName: string, dataSource: DataSource) {
    const truncateQuery = `TRUNCATE TABLE ${tableName} CASCADE;`;
    await dataSource.query(truncateQuery);
}

beforeAll(async () => {
    await testDataSource.initialize();
});

afterAll(async () => {
    await testDataSource.destroy();
});

afterEach(async () => {
    await truncateTableCascade("long_text_meta_value", testDataSource);
    await truncateTableCascade("meta_names", testDataSource);
    await truncateTableCascade("contents", testDataSource);
});

describe("QuestionService", () => {
    it("saves a question creating one row in each table", async () => {
        service.setQuestion("What is the capital of France?");
        await service.save();

        const contentRepository = testDataSource.getRepository(Content);
        const metaNameRepository = testDataSource.getRepository(MetaName);
        const longTextMetaValueRepository = testDataSource.getRepository(LongTextMetaValue);

        expect(await contentRepository.count()).toBe(1);
        expect(await metaNameRepository.count()).toBe(1);
        expect(await longTextMetaValueRepository.count()).toBe(1);

        const saved = await testDataSource.getRepository(LongTextMetaValue).findOne({ where: { string_meta_value: "What is the capital of France?" } });
        expect(saved?.string_meta_value).toBe("What is the capital of France?");
    });

    it("saves a question creating one row in content table", async () => {
        service.setQuestion("What is the capital of Brazil?");
        await service.save();
        const contentRepository = testDataSource.getRepository(Content);
        expect(await contentRepository.count()).toBe(1);
    });

    it("Verifies the type of meta name", async () => {
        service.setQuestion("What is the capital of Marrocos?");

        await service.save();

        const metaNameRepository = testDataSource.getRepository(MetaName);

        const metaName = await metaNameRepository.findOne({
            where: { meta_name: 'kind' }
        });

        expect(metaName).not.toBeNull();
    });

    it("Adds metas to content", async () => {
        service.setQuestion("What is the capital of Marrocos?");

        const customDate = new Date("2023-10-27T10:30:00.000Z");
        const milliseconds = customDate.getTime();
        const millisecondsMeta: Meta = {
            name: "begin",
            value: milliseconds.toString()
        };
        service.addMeta(millisecondsMeta);

        await service.save();

        const contentRepository = testDataSource.getRepository(Content);
        const metaNameRepository = testDataSource.getRepository(MetaName);
        const longTextMetaValueRepository = testDataSource.getRepository(LongTextMetaValue);

        expect(await contentRepository.count()).toBe(1);
        expect(await metaNameRepository.count()).toBe(2)
        expect(await longTextMetaValueRepository.count()).toBe(2);
    });

    it("Adds metas to content 2", async () => {
        service.setQuestion("What is the capital of Honduras?");

        const customDate = new Date("2023-10-27T10:30:00.000Z");
        const milliseconds = customDate.getTime();
        const millisecondsMeta: Meta = {
            name: "begin",
            value: milliseconds.toString()
        };
        service.addMeta(millisecondsMeta);

        await service.save();

        const contentRepository = testDataSource.getRepository(Content);
        const metaNameRepository = testDataSource.getRepository(MetaName);
        const longTextMetaValueRepository = testDataSource.getRepository(LongTextMetaValue);

        expect(await contentRepository.count()).toBe(1);
        expect(await metaNameRepository.count()).toBe(2)
        expect(await longTextMetaValueRepository.count()).toBe(2);
    });

    it("Model of how save question performance in server.ts", async () => {
        service.setQuestion("How many peoples lives in Italy?");

        const customDate = new Date("2023-10-27T10:30:00.000Z");
        const milliseconds = customDate.getTime();
        const beginTime: Meta = {
            name: "begin",
            value: milliseconds.toString()
        };

        service.addMeta({
            name: "begin",
            value: beginTime.toString()
        });

        service.addMeta({
            name: "answer",
            value: "There are 58 millions of peoples living in Italy"
        });

        await service.save();

        const contentRepository = testDataSource.getRepository(Content);
        const metaNameRepository = testDataSource.getRepository(MetaName);
        const longTextMetaValueRepository = testDataSource.getRepository(LongTextMetaValue);

        expect(await contentRepository.count()).toBe(1);
        expect(await metaNameRepository.count()).toBe(3)
        expect(await longTextMetaValueRepository.count()).toBe(3);
    });
});
