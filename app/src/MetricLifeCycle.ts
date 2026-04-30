import express from "express";
import AnswerPerformance from "./types/AnswerPerformance";

class MetricLifeCycle {
    private beginTimeMilliseconds!: number;

    private endTimeMilliseconds!: number;

    private userIp!: string|unknown;

    private isBegan: boolean = false;

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

    public getAnswerPerformance() : AnswerPerformance | null {
        if (!this.isBegan) return null;
        return {
            beginUnixEpochTimestamp: this.beginTimeMilliseconds,
            endUnixEpochTimestamp: this.endTimeMilliseconds
        };
    }
}

export default MetricLifeCycle;