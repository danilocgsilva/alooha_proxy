import express from "express";
import LogConsole from "./LogConsole.js";
import type QuestionAnatomy from "./types/QuestionAnatomy.js";
import MetricLifeCycle from "./MetricLifeCycle.js";
import FriendlyPerformanceSummary from "./domain/FriendlyPerformanceSummary.js";
import QuestionService from "./database/services/QuestionService.js";
import { AppDataSource } from "./database/dataSource.js";

class QuestionProcessingHelper {
    public static assemblyHeader(res: express.Response, upstreamHeaders: any) {
        for (const [key, value] of Object.entries(upstreamHeaders)) {
            if (value) {
                res.setHeader(key, value as string);
            }
        }
    }

    public static printPerformanceIntoTerminal(
        questionAnatomy: QuestionAnatomy,
        fullAnswer: string,
        performanceSummaryString: string,
        logWritter: LogConsole
    ) {
        logWritter.log("=========- Question ============");
        logWritter.log(questionAnatomy.question);
        logWritter.log("============ Answer =================");
        logWritter.log(fullAnswer);
        logWritter.log("============ Performance =============");
        logWritter.log(performanceSummaryString);
        logWritter.log("==================================\n");
    }

    public static finishQuestion = (
        metricLifeCycle: MetricLifeCycle,
        questionAnatomy: QuestionAnatomy | null,
        totalBytes: number,
        totalChunks: number,
        logWritter: LogConsole
    ) => {
        if (questionAnatomy === null) {
            throw new Error("There's no question done yet.");
        }

        metricLifeCycle.setWhenEnded();
        const fullAnswer = metricLifeCycle.getFullAnswer();

        const answerPerformance = metricLifeCycle.getAnswerPerformance(
            totalBytes, 
            questionAnatomy, 
            totalChunks
        );
        const friendlyPerformanceSummary = new FriendlyPerformanceSummary(answerPerformance);
        const performanceSummary = friendlyPerformanceSummary.getPerformance(fullAnswer);
        const performanceSummaryString = JSON.stringify(performanceSummary, null, 4);

        const questionService = new QuestionService(AppDataSource);

        questionService.setQuestion(answerPerformance.question);

        questionService.addMeta({
            name: "begin",
            value: answerPerformance.beginUnixEpochTimestamp.toString()
        });

        questionService.addMeta({
            name: "answer",
            value: answerPerformance.answer
        });

        questionService.addMeta({
            name: "end",
            value: answerPerformance.endUnixEpochTimestamp.toString()
        });

        questionService.save();
        logWritter.log("Saved to database");

        QuestionProcessingHelper.printPerformanceIntoTerminal(
            questionAnatomy,
            fullAnswer,
            performanceSummaryString,
            logWritter
        );
    };

}

export default QuestionProcessingHelper;