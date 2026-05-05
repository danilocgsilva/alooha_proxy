import express from "express";
import AnswerPerformance from "../types/AnswerPerformance";
import MetricWorks from "./MetricWorks.js";
import QuestionAnatomy from "../types/QuestionAnatomy";

class MetricLifeCycle {
    private beginTimeMilliseconds!: number;

    private beginTimeChunks: number | null = null;

    private endTimeMilliseconds!: number;

    private userIp!: string|unknown;

    private isBegan: boolean = false;

    private chunksAnswer: string[] = [];

    public setWhenBegan() {
        const now = new Date();
        const milliseconds = now.getTime();
        this.beginTimeMilliseconds = milliseconds;
        this.isBegan = true;
    }

    public setUserIp(request: express.Request) {
        this.userIp = request.ip;
    }

    public setWhenEnded() {
        if (!this.isBegan) return;
        const now = new Date();
        const milliseconds = now.getTime();
        this.endTimeMilliseconds = milliseconds;
    }

    public getAnswerPerformance(
        bytesSize: number, 
        questionAnatomy: QuestionAnatomy,
        totalChunks: number
    ) : AnswerPerformance {
        if (!this.isBegan || this.beginTimeChunks === null) { 
            throw new Error("The measurement did never start.");
        }
        return {
            question: questionAnatomy.question,
            answer: this.getFullAnswer(), 
            beginUnixEpochTimestamp: this.beginTimeMilliseconds,
            beginUnixEpochTimestampChunks: this.beginTimeChunks,
            endUnixEpochTimestamp: this.endTimeMilliseconds,
            bytesSize,
            totalChunks
        };
    }

    public digestChunk(chunk: Buffer): string {
        const chunkResponse = MetricWorks.getDataChunk(chunk);
        if ("" === chunkResponse) {
            return "";
        }
        if (this.beginTimeChunks === null) this.beginTimeChunks = new Date().getTime();
        this.chunksAnswer.push(chunkResponse);
        return chunkResponse;
    }

    public getFullAnswer() : string {
        return this.chunksAnswer.join("");
    }
}

export default MetricLifeCycle;