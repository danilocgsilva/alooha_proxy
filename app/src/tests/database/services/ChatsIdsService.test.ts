import { DataSource } from "typeorm";
import TestDataSource from "../TestDataSource";
import ChatsIdsService from "../../../database/services/ChatsIdsService";

describe("ChatsIdsService", () => {
    let dataSource: DataSource;

    beforeAll(async () => {
        dataSource = await TestDataSource.initialize();
    });

    afterAll(async () => {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

    beforeEach(async () => {
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await queryRunner.query("DELETE FROM long_text_meta_value");
            await queryRunner.query("DELETE FROM integer_meta_value");
            await queryRunner.query("UPDATE meta_names SET parent_id = NULL");
            await queryRunner.query("DELETE FROM meta_names");
            await queryRunner.query("DELETE FROM question_options");
            await queryRunner.query("DELETE FROM contents");
            await queryRunner.commitTransaction();
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    });

    it("should return empty array when no data exists", async () => {
        const result = await new ChatsIdsService(dataSource).getLastChatIds(10);
        expect(result).toHaveLength(0);
    });

    it("should return chat ids ordered by id descending", async () => {
        await seedChatId(dataSource, "chat-id-1");
        await seedChatId(dataSource, "chat-id-2");

        const result = await new ChatsIdsService(dataSource).getLastChatIds(10);

        expect(result).toHaveLength(2);
        expect(result[0]).toBe("chat-id-2");
        expect(result[1]).toBe("chat-id-1");
    });

    it("should not return entries with a different meta_name", async () => {
        await seedMetaValue(dataSource, "otherId", "should-not-appear");

        const result = await new ChatsIdsService(dataSource).getLastChatIds(10);

        expect(result).toHaveLength(0);
    });

    it("should return at most 10 results", async () => {
        for (let i = 1; i <= 12; i++) {
            await seedChatId(dataSource, `chat-id-${i}`);
        }

        const result = await new ChatsIdsService(dataSource).getLastChatIds(10);

        expect(result).toHaveLength(10);
    });
});

async function seedChatId(dataSource: DataSource, chatId: string): Promise<void> {
    await seedMetaValue(dataSource, "chatId", chatId);
}

async function seedMetaValue(dataSource: DataSource, metaName: string, value: string): Promise<void> {
    const [content] = await dataSource.query(
        "INSERT INTO contents DEFAULT VALUES RETURNING id"
    );
    const [mn] = await dataSource.query(
        "INSERT INTO meta_names (meta_name, content_id) VALUES ($1, $2) RETURNING id",
        [metaName, content.id]
    );
    await dataSource.query(
        "INSERT INTO long_text_meta_value (string_meta_value, meta_names_id) VALUES ($1, $2)",
        [value, mn.id]
    );
}
