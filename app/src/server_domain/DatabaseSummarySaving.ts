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

        questionService.save();
    }
}

export default DatabaseSummarySaving;