import type QuestionAnatomy from "./types/QuestionAnatomy";
import express from "express";

class MetricWorks {
    static getAnatomy(requestBody: string, request: express.Request): QuestionAnatomy {
        if (request.originalUrl === "/api/chat") {
            const messagesCurrentQuestion = JSON.parse(requestBody).messages;
            const dataUniqueMessage: Record<string, string> = messagesCurrentQuestion[0];
            const question: string = dataUniqueMessage.content;
            const url: string = request.url;
            return {
                requestBody,
                url,
                question
            }
        }
        if (request.originalUrl === "/api/generate") {
            const messagesCurrentQuestion: Record<string, string> = JSON.parse(requestBody);
            // const dataUniqueMessage: Record<string, string> = messagesCurrentQuestion[0];
            // const question: string = dataUniqueMessage.content;
            const url: string = request.url;
            const question: string = messagesCurrentQuestion.question;
            return {
                requestBody,
                url,
                question
            }
        }
        throw new Error("The original url is not known.")
    }
}

export default MetricWorks;