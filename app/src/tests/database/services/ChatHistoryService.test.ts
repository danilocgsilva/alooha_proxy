import ChatHistoryService from "../../../database/services/ChatHistoryService";
import { DataSource } from "typeorm";
import TestDataSource from "../../database/TestDataSource";
import EmptyLogImplementation from "../../../tests/EmptyLogImplementation";
import MetricLifeCycle from "../../../server_domain/MetricLifeCycle";
import MetricWorks from "../../../server_domain/MetricWorks";
import DatabaseSummarySaving from "../../../server_domain/DatabaseSummarySaving";
import { Request as ExpressRequest } from 'express';

describe("ChatHistoryService", () => {
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

    it("should return empty chat history when no data exists", async () => {
        const chatHistoryService = getChatHistoryService();
        const chatHistory = await chatHistoryService.getChatHistory(10);
        expect(chatHistory).toHaveLength(0);
    });

    it("Basic test to its function method", async () => {
        await createQuestionAndAnswerEntries();

        const chatHistoryService = getChatHistoryService();
        const chatHistory = await chatHistoryService.getChatHistory(1);
        const firstChatEntry = chatHistory[0];

        expect(firstChatEntry.question).toBe("What is the capital of France?");
        expect(firstChatEntry.model).toBe("gemma3:4b");
    });

    function getChatHistoryService(): ChatHistoryService {
        const chatHistoryService = new ChatHistoryService(dataSource);
        return chatHistoryService;
    }

    async function createQuestionAndAnswerEntries(): Promise<void> {
        const emptyLogImplementation = new EmptyLogImplementation();
        const metricLifeCycle = new MetricLifeCycle(emptyLogImplementation);
        metricLifeCycle.setWhenBegan();
        const metricWorks = new MetricWorks(emptyLogImplementation);

        const mockReq = {
            body: JSON.stringify(
                {
                    "model": "gemma3:4b",
                    "messages": [
                        {
                            "role": "user",
                            "content": "What is the capital of France?"
                        }
                    ],
                    "stream": true,
                    "chatId": "ad72906b-6a3c-4a0d-ad5d-f15651d28c1a",
                    "options": {}
                }
            ),
            headers: { 'content-type': 'application/json' },
            query: {},
            params: {},
            originalUrl: "/api/chat"
        } as ExpressRequest;

        const requestString = mockReq.body.toString();
        const questionAnatomy = metricWorks.getAnatomy(requestString, mockReq);
        const beginMs = metricLifeCycle.getBeginTime();
        const answerPerformance = {
            question: questionAnatomy.question,
            answer: "",
            beginUnixEpochTimestamp: beginMs,
            beginUnixEpochTimestampChunks: beginMs,
            endUnixEpochTimestamp: beginMs,
            bytesSize: 0,
            totalChunks: 0
        };

        const databaseSummarySaving = new DatabaseSummarySaving(dataSource, answerPerformance, questionAnatomy);
        await databaseSummarySaving.partialSave();
    }
});


