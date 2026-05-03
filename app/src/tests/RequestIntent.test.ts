import RequestIntent from "../server_domain/RequestIntent";
import type express from "express";

const mockRequest = (url: string, body: string) =>
    ({
        url,
        originalUrl: url,
        body,
    } as unknown as express.Request);

describe("RequestIntent", () => {
    it("Get the question afterwards", () => {
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
        const request = mockRequest("/api/chat", body);

        const requestIntent: RequestIntent = new RequestIntent(request)

        expect(requestIntent.getQuestion()).toBe("What is the Malasia capital?");
    });
});