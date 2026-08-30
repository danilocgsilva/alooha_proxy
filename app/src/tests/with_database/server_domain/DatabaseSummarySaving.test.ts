import { DataSource } from "typeorm";
import DatabaseSummarySaving from "../../../server_domain/DatabaseSummarySaving";
import QuestionService from "../../../database/services/QuestionService";
import AnswerPerformance from "../../../types/AnswerPerformance";
import QuestionAnatomy from "../../../types/QuestionAnatomy";
import TestDataSource from "../../database/TestDataSource";
import { Content } from "../../../database/entities/Content";
import { MetaName } from "../../../database/entities/MetaName";

describe("DatabaseSummarySaving", () => {
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
            await queryRunner.query("DELETE FROM meta_names");
            await queryRunner.query("DELETE FROM contents");
            
            await queryRunner.commitTransaction();
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    });

    it("should save question data to database", async () => {
        const answerPerformance: AnswerPerformance = {
            question: "What is the capital of France?",
            answer: "Paris",
            beginUnixEpochTimestamp: 1678886400000, // 2023-03-15 00:00:00 UTC
            beginUnixEpochTimestampChunks: 1678886400000,
            endUnixEpochTimestamp: 1678886460000,  // 2023-03-15 00:01:00 UTC
            bytesSize: 5,
            totalChunks: 1
        };

        const questionAnatomy: QuestionAnatomy = {
            requestBody: "{}",
            question: "What is the capital of France?",
            url: "/api/chat",
            model: "llama3",
            systemPrompt: "You are a helpful assistant",
            chatId: "chat-123",
            options: {
                temperature: 0.7
            }
        };

        const databaseSummarySaving = new DatabaseSummarySaving(
            dataSource,
            answerPerformance,
            questionAnatomy
        );

        await databaseSummarySaving.save();

        const contentRepository = dataSource.getRepository(Content);
        const contents = await contentRepository.find();
        
        expect(contents).toHaveLength(1);
        
        const content = contents[0];
        expect(content).toBeDefined();
        
        const metaNameRepository = dataSource.getRepository(MetaName);
        
        const metaNames = await metaNameRepository.find({ 
            relations: ["longTextMetaValue"] 
        });
        
        expect(metaNames).toHaveLength(12);
        
        const metaNameMap = new Map(metaNames.map(meta => [meta.meta_name, meta.longTextMetaValue.string_meta_value]));
        
        expect(metaNameMap.get("question")).toBe("What is the capital of France?");
        expect(metaNameMap.get("kind")).toBe("question");
        expect(metaNameMap.get("begin")).toBe("1678886400000");
        expect(metaNameMap.get("answer")).toBe("Paris");
        expect(metaNameMap.get("end")).toBe("1678886460000");
        expect(metaNameMap.get("model")).toBe("llama3");
        expect(metaNameMap.get("system prompt")).toBe("You are a helpful assistant");
        expect(metaNameMap.get("chatId")).toBe("chat-123");
        expect(metaNameMap.get("options")).toBe('{"temperature":0.7}');
        
        const timeDiffSeconds = parseInt(metaNameMap.get("time_difference_seconds")!);
        expect(timeDiffSeconds).toBe(60); // 60 seconds difference
        
        const formattedTime = metaNameMap.get("time_difference_formatted");
        expect(formattedTime).toBe("00:01:00"); // 1 minute
    });

    it("should save question data without optional fields", async () => {
        const answerPerformance: AnswerPerformance = {
            question: "What is the capital of France?",
            answer: "Paris",
            beginUnixEpochTimestamp: 1678886400000,
            beginUnixEpochTimestampChunks: 1678886400000,
            endUnixEpochTimestamp: 1678886460000,
            bytesSize: 5,
            totalChunks: 1
        };

        const questionAnatomy: QuestionAnatomy = {
            requestBody: "{}",
            question: "What is the capital of France?",
            url: "/api/chat",
            model: "llama3",
            systemPrompt: "You are a helpful assistant",
            chatId: "chat-123",
        };

        const databaseSummarySaving = new DatabaseSummarySaving(
            dataSource,
            answerPerformance,
            questionAnatomy
        );

        await databaseSummarySaving.save();

        const contentRepository = dataSource.getRepository(Content);
        const contents = await contentRepository.find();
        
        expect(contents).toHaveLength(1);
        
        const content = contents[0];
        expect(content).toBeDefined();
        
        const metaNameRepository = dataSource.getRepository(MetaName);
        const metaNames = await metaNameRepository.find({ 
            relations: ["longTextMetaValue"] 
        });
        
        expect(metaNames).toHaveLength(11);
        
        const metaNameMap = new Map(metaNames.map(meta => [meta.meta_name, meta.longTextMetaValue.string_meta_value]));
        
        expect(metaNameMap.get("question")).toBe("What is the capital of France?");
        expect(metaNameMap.get("kind")).toBe("question");
        expect(metaNameMap.get("begin")).toBe("1678886400000");
        expect(metaNameMap.get("answer")).toBe("Paris");
        expect(metaNameMap.get("end")).toBe("1678886460000");
        expect(metaNameMap.get("model")).toBe("llama3");
        expect(metaNameMap.get("system prompt")).toBe("You are a helpful assistant");
        expect(metaNameMap.get("chatId")).toBe("chat-123");
        
        const timeDiffSeconds = parseInt(metaNameMap.get("time_difference_seconds")!);
        expect(timeDiffSeconds).toBe(60); // 60 seconds difference
        
        // Verify formatted time difference
        const formattedTime = metaNameMap.get("time_difference_formatted");
        expect(formattedTime).toBe("00:01:00"); // 1 minute
    });
});
