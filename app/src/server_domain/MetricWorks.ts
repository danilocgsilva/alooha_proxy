import type QuestionAnatomy from "../types/QuestionAnatomy";
import express from "express";
import LogImplementation from "../server_domain/LogImplementation";

class MetricWorks {
    constructor(private logWritter: LogImplementation) {
    }

    getAnatomy(requestBody: string, request: express.Request): QuestionAnatomy {
        if (request.originalUrl === "/api/chat") {
            const requestBodyParsed = JSON.parse(requestBody);
            const messagesCurrentQuestion = requestBodyParsed.messages;

            let dataPrompt = "";
            let dataSystemPrompt = "";

            const firstMessage = messagesCurrentQuestion[0];
            if (firstMessage.role === "system") {
                dataSystemPrompt = firstMessage.content;
            }
            dataPrompt = messagesCurrentQuestion.slice(-1)[0].content;

            const question: string = dataPrompt;
            const systemPrompt: string = dataSystemPrompt;
            
            const url: string = request.url;
            const chatId = requestBodyParsed.chatId;

            if (systemPrompt) {
                return {
                    requestBody,
                    question,
                    url,
                    model: requestBodyParsed.model,
                    systemPrompt,
                    chatId
                }
            } else {
                return {
                    requestBody,
                    url,
                    question,
                    model: requestBodyParsed.model,
                    chatId
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

    getDataChunk(responseChunk: Buffer): string {
        const chunkString = responseChunk.toString();
        const chunkParsed = JSON.parse(chunkString);
        if (chunkParsed.message) {
            return chunkParsed.message.content;
        }
        this.logWritter.log("Oops! Could not parse a chunk!");
        return "";
    }
}

export default MetricWorks;