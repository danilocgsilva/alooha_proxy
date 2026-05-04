import QuestionService from "../database/services/QuestionService.js";
import AnswerPerformance from "../types/AnswerPerformance.js";
import { DataSource } from "typeorm";

class DatabaseSummarySaving {
    constructor(
        private appDataSource: DataSource,
        private answerPerformance: AnswerPerformance
    ) { }

    public save() {
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

        questionService.save();
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