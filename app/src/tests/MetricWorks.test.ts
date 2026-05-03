import MetricWorks from "../server_domain/MetricWorks";
import type express from "express";
import type QuestionAnatomy from "../types/QuestionAnatomy";

const mockRequest = (url: string, body: string) =>
    ({
        url,
        originalUrl: url,
        body,
    } as unknown as express.Request);

describe("MetricWorks.getAnatomy", () => {
    it("returns anatomy with question and requestBody using the chat endpoint", () => {
        const requestBodyContentString = {
            "model": "gemma3:4b",
            "messages": [
                {
                    "role": "user",
                    "content": "What is the Malasia capital?",
                }
            ],
            "stream": true
        };

        const body = JSON.stringify(requestBodyContentString);
        const req = mockRequest("/api/chat", body);

        const result: QuestionAnatomy = MetricWorks.getAnatomy(body, req);

        expect(result).toHaveProperty('requestBody');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('question');

        expect(result.url).toBe("/api/chat");
        expect(result.question).toBe("What is the Malasia capital?");
        expect(result.model).toBe("gemma3:4b");
    });

    it("returns anatomy with question and requestBody using the generate endpoint", () => {
        const requestBodyContent = {
            "question": "What is the Malasia capital?",
            "model": "gemma3:4b",
            "stream": true
        };

        const body = JSON.stringify(requestBodyContent);
        const req = mockRequest("/api/generate", body);

        const result = MetricWorks.getAnatomy(body, req);

        expect(result).toHaveProperty('requestBody');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('question');

        expect(result.url).toBe("/api/generate");
        expect(result.question).toBe("What is the Malasia capital?");
        expect(result.model).toBe("gemma3:4b");
    });

    it("returns message content from a valid chunk buffer", () => {
        const testRecords = { message: { content: "hello" } };
        const chunk = Buffer.from(JSON.stringify(testRecords));
        expect(MetricWorks.getDataChunk(chunk)).toBe("hello");
    });

    it("throws on invalid JSON", () => {
        const chunk = Buffer.from("not json");
        expect(() => MetricWorks.getDataChunk(chunk)).toThrow();
    });

    it("throws when message property is missing", () => {
        const testRecords = { other: "data" };
        const chunk = Buffer.from(JSON.stringify(testRecords));
        expect(() => MetricWorks.getDataChunk(chunk)).toThrow();
    });
});
