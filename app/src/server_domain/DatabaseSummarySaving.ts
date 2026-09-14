import fs from "fs";
import path from "path";
import QuestionService from "../database/services/QuestionService.js";
import AnswerPerformance from "../types/AnswerPerformance.js";
import { DataSource } from "typeorm";
import QuestionAnatomy from "../types/QuestionAnatomy.js";

export function getProxyVersion(): string {
    const packageJsonPath = path.resolve(__dirname, "../../package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
        name?: string;
        version?: string;
    };

    return `${packageJson.name ?? "proxy"}_${packageJson.version ?? "0.0.0"}`;
}

class DatabaseSummarySaving {
    private savedContentId: number | null = null;

    constructor(
        private appDataSource: DataSource,
        private answerPerformance: AnswerPerformance,
        private questionAnatomy: QuestionAnatomy
    ) { }

    public async save() {
        const questionService = new QuestionService(this.appDataSource);

        questionService.setQuestion(this.answerPerformance.question);

        questionService.addMeta({
            name: "begin",
            value: this.answerPerformance.beginUnixEpochTimestamp.toString()
        });

        questionService.addMeta({
            name: "answer",
            value: this.answerPerformance.answer
        });

        questionService.addMeta({
            name: "end",
            value: this.answerPerformance.endUnixEpochTimestamp.toString()
        });

        questionService.addMeta({
            name: "time_difference_seconds",
            value: (this.calculatesEndBeginTimeDifferenceMilliseconds() / 1000).toString()
        });

        questionService.addMeta({
            name: "time_difference_formatted",
            value: this.formatDifferenceToTimeFormat(
                this.calculatesEndBeginTimeDifferenceMilliseconds() / 1000
            )
        });

        this.addCommonMeta(questionService);

        await questionService.save();
    }

    public async partialSave() {
        const questionService = new QuestionService(this.appDataSource);

        questionService.setQuestion(this.answerPerformance.question);

        questionService.addMeta({
            name: "begin",
            value: this.answerPerformance.beginUnixEpochTimestamp.toString()
        });

        this.addCommonMeta(questionService);

        this.savedContentId = await questionService.save();
    }

    public updateAnswerPerformance(answerPerformance: AnswerPerformance) {
        this.answerPerformance = answerPerformance;
    }

    public async storeAnswerPerformance() {
        if (this.savedContentId === null) {
            throw new Error("partialSave must be called before storeAnswerPerformance.");
        }

        const questionService = new QuestionService(this.appDataSource);

        questionService.addMeta({
            name: "answer",
            value: this.answerPerformance.answer
        });

        questionService.addMeta({
            name: "end",
            value: this.answerPerformance.endUnixEpochTimestamp.toString()
        });

        questionService.addMeta({
            name: "time_difference_seconds",
            value: (this.calculatesEndBeginTimeDifferenceMilliseconds() / 1000).toString()
        });

        questionService.addMeta({
            name: "time_difference_formatted",
            value: this.formatDifferenceToTimeFormat(this.calculatesEndBeginTimeDifferenceMilliseconds() / 1000)
        });

        await questionService.saveToContent(this.savedContentId);
    }

    private addCommonMeta(questionService: QuestionService) {
        questionService.addMeta({
            name: "model",
            value: this.questionAnatomy.model
        });

        questionService.addMeta({
            name: "proxy_version",
            value: getProxyVersion()
        });

        questionService.addMeta({
            name: "full_question_payload",
            value: this.questionAnatomy.requestBody
        });

        if (this.questionAnatomy.systemPrompt) {
            questionService.addMeta({
                name: "system prompt",
                value: this.questionAnatomy.systemPrompt
            });
        }

        if (this.questionAnatomy.chatId) {
            questionService.addMeta({
                name: "chatId",
                value: this.questionAnatomy.chatId
            });
        }

        if (this.questionAnatomy.options && Object.keys(this.questionAnatomy.options).length > 0) {
            questionService.setQuestionOptions(this.questionAnatomy.options);
        }
    }

    private calculatesEndBeginTimeDifferenceMilliseconds(): number {
        const beginTimestamp = this.answerPerformance.beginUnixEpochTimestamp;
        const endTimestamp = this.answerPerformance.endUnixEpochTimestamp;

        return endTimestamp - beginTimestamp;
    }

    private formatDifferenceToTimeFormat(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor(seconds / 60) % 60;
        const secs = Math.floor(seconds) % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

export default DatabaseSummarySaving;