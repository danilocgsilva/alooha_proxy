import express from "express";

class RequestIntent {
    private request: express.Request;

    constructor(request: express.Request) {
        this.request = request;
    }

    public getIntent(): 
        "listModels" | 
        "question" | 
        "option" | 
        "alooha_stats" |
        "" {
        if (this.request.method === "OPTIONS") {
            return "option";
        }
        if (this.request.originalUrl === "/api/tags") {
            return "listModels";
        }
        if (this.request.originalUrl === "/api/chat" || this.request.originalUrl === "/api/generate") {
            return "question";
        }
        if (this.request.originalUrl === "/alooha_api/stats") {
            return "alooha_stats";
        }
        return ""
    }

    public getQuestion(): string {
        const userBody = this.request.body;
        const bodyDecoded = JSON.parse(userBody);
        const userMessages = bodyDecoded.messages;
        return userMessages[0].content;
    }
}

export default RequestIntent;