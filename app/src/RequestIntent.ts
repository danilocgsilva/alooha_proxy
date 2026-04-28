import express from "express";

class RequestIntent {
    private request: express.Request;

    constructor(request: express.Request) {
        this.request = request;
    }

    public getIntent(): "listModels" | "question" | "option" | "" {
        if (this.request.method === "OPTIONS") {
            return "option";
        }
        if (this.request.originalUrl === "/api/tags") {
            return "listModels";
        }
        if (this.request.originalUrl === "/api/chat" || this.request.originalUrl === "/api/generate") {
            return "question";
        }
        return ""
    }
}

export default RequestIntent;