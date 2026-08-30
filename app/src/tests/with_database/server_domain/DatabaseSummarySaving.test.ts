import { DataSource } from "typeorm";
import DatabaseSummarySaving from "../../../server_domain/DatabaseSummarySaving";
import QuestionService from "../../../database/services/QuestionService";
import AnswerPerformance from "../../../types/AnswerPerformance";
import QuestionAnatomy from "../../../types/QuestionAnatomy";
import TestDataSource from "../../database/TestDataSource";

describe("DatabaseSummarySaving", () => {
    let dataSource: DataSource;
    // let testDataSource: DataSource;

    beforeAll(async () => {
        dataSource = await TestDataSource.initialize();
    });

    afterAll(async () => {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

    beforeEach(async () => {
        // Clear all tables before each test
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Clear tables in reverse order to avoid foreign key constraints
            await queryRunner.query("DELETE FROM long_text_meta_value");
            await queryRunner.query("DELETE FROM meta_name");
            await queryRunner.query("DELETE FROM content");
            
            await queryRunner.commitTransaction();
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    });

    it("should save question data to database", async () => {
        // Arrange
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
                temperature: 0.7,
                max_tokens: 100
            }
        };

        const databaseSummarySaving = new DatabaseSummarySaving(
            dataSource,
            answerPerformance,
            questionAnatomy
        );

        // Act
        await databaseSummarySaving.save();

        // Assert
        const questionService = new QuestionService(dataSource);
        
        // Verify that we can retrieve the saved data
        const contentRepository = dataSource.getRepository(require("../database/entities/Content").Content);
        const contents = await contentRepository.find();
        
        expect(contents).toHaveLength(1);
        
        const content = contents[0];
        expect(content).toBeDefined();
        
        // Check meta values were saved
        const metaNameRepository = dataSource.getRepository(require("../database/entities/MetaName").MetaName);
        const metaNames = await metaNameRepository.find({ 
            relations: ["longTextMetaValue"] 
        });
        
        expect(metaNames).toHaveLength(7); // question, kind, begin, answer, end, time_difference_seconds, time_difference_formatted, model, proxy_version, system prompt, chatId, options
        
        // Verify specific meta values
        const metaNameMap = new Map(metaNames.map(meta => [meta.meta_name, meta.longTextMetaValue.string_meta_value]));
        
        expect(metaNameMap.get("question")).toBe("What is the capital of France?");
        expect(metaNameMap.get("kind")).toBe("question");
        expect(metaNameMap.get("begin")).toBe("1678886400000");
        expect(metaNameMap.get("answer")).toBe("Paris");
        expect(metaNameMap.get("end")).toBe("1678886460000");
        expect(metaNameMap.get("model")).toBe("llama3");
        expect(metaNameMap.get("system prompt")).toBe("You are a helpful assistant");
        expect(metaNameMap.get("chatId")).toBe("chat-123");
        expect(metaNameMap.get("options")).toBe('{"temperature":0.7,"max_tokens":100}');
        
        // Verify time difference
        const timeDiffSeconds = parseInt(metaNameMap.get("time_difference_seconds")!);
        expect(timeDiffSeconds).toBe(60); // 60 seconds difference
        
        // Verify formatted time difference
        const formattedTime = metaNameMap.get("time_difference_formatted");
        expect(formattedTime).toBe("00:01:00"); // 1 minute
    });

    it("should save question data without optional fields", async () => {
        // Arrange
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
            model: "llama3"
        };

        const databaseSummarySaving = new DatabaseSummarySaving(
            dataSource,
            answerPerformance,
            questionAnatomy
        );

        // Act
        await databaseSummarySaving.save();

        // Assert
        const questionService = new QuestionService(dataSource);
        
        // Verify that we can retrieve the saved data
        const contentRepository = dataSource.getRepository(require("../database/entities/Content").Content);
        const contents = await contentRepository.find();
        
        expect(contents).toHaveLength(1);
        
        const content = contents[0];
        expect(content).toBeDefined();
        
        // Check meta values were saved (without optional fields)
        const metaNameRepository = dataSource.getRepository(require("../database/entities/MetaName").MetaName);
        const metaNames = await metaNameRepository.find({ 
            relations: ["longTextMetaValue"] 
        });
        
        expect(metaNames).toHaveLength(5); // question, kind, begin, answer, end, time_difference_seconds, time_difference_formatted, model
        
        // Verify specific meta values
        const metaNameMap = new Map(metaNames.map(meta => [meta.meta_name, meta.longTextMetaValue.string_meta_value]));
        
        expect(metaNameMap.get("question")).toBe("What is the capital of France?");
        expect(metaNameMap.get("kind")).toBe("question");
        expect(metaNameMap.get("begin")).toBe("1678886400000");
        expect(metaNameMap.get("answer")).toBe("Paris");
        expect(metaNameMap.get("end")).toBe("1678886460000");
        expect(metaNameMap.get("model")).toBe("llama3");
        
        // Verify time difference
        const timeDiffSeconds = parseInt(metaNameMap.get("time_difference_seconds")!);
        expect(timeDiffSeconds).toBe(60); // 60 seconds difference
        
        // Verify formatted time difference
        const formattedTime = metaNameMap.get("time_difference_formatted");
        expect(formattedTime).toBe("00:01:00"); // 1 minute
    });
});
