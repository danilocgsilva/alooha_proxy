import type QuestionAnatomy from "./types/QuestionAnatomy";
import express from "express";

class MetricWorks {
    static getAnatomy(requestBody: string, request: express.Request): QuestionAnatomy {
        if (request.originalUrl === "/api/chat") {
            const requestBodyParsed = JSON.parse(requestBody);
            const messagesCurrentQuestion = requestBodyParsed.messages;

            let dataPrompt: Record<string, string>;
            let dataSystemPrompt: Record<string, string> = {};
            if (messagesCurrentQuestion.length === 2) {
                dataPrompt = messagesCurrentQuestion[1];
                dataSystemPrompt = messagesCurrentQuestion[0];
            } else {
                dataPrompt = messagesCurrentQuestion[0];
            }

            const question: string = dataPrompt.content;
            const systemPrompt: string | undefined = dataSystemPrompt.content;
            
            const url: string = request.url;
            if (systemPrompt) {
                return {
                    requestBody,
                    url,
                    question,
                    systemPrompt,
                    model: requestBodyParsed.model
                }
            } else {
                return {
                    requestBody,
                    url,
                    question,
                    model: requestBodyParsed.model
                }
            }
        }
        if (request.originalUrl === "/api/generate") {
            const messagesCurrentQuestion: Record<string, string> = JSON.parse(requestBody);
            const url: string = request.url;
            const question: string = messagesCurrentQuestion.question;
            return {
                requestBody,
                url,
                question,
                model: messagesCurrentQuestion.model
            }
        }
        throw new Error("The original url is not known.")
    }

    static getDataChunk(responseChunk: Buffer): string {
        const chunkString = responseChunk.toString();
        const chunkParsed = JSON.parse(chunkString);
        return chunkParsed.message.content;
    }
}

export default MetricWorks;