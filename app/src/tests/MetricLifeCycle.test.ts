import MetricLifeCycle from "../server_domain/MetricLifeCycle";
import type QuestionAnatomy from "../types/QuestionAnatomy";
import LogImplementation from "../server_domain/LogImplementation";

describe("MetricLifeCycle", () => {
    it("does not throw when the upstream stream ends before any chunk is received", () => {
        const logWritter = new LogImplementation();
        const metricLifeCycle = new MetricLifeCycle(logWritter);
        const questionAnatomy = { question: "hello" } as QuestionAnatomy;

        metricLifeCycle.setWhenBegan();
        metricLifeCycle.setWhenEnded();

        expect(() => metricLifeCycle.getAnswerPerformance(0, questionAnatomy, 0)).not.toThrow();

        const result = metricLifeCycle.getAnswerPerformance(0, questionAnatomy, 0);

        expect(result.answer).toBe("");
        expect(result.totalChunks).toBe(0);
        expect(result.beginUnixEpochTimestampChunks).toBe(result.beginUnixEpochTimestamp);
    });
});
