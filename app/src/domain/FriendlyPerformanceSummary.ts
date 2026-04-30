import AnswerPerformance from "../types/AnswerPerformance";
import FriendlyPerformanceType from "../types/FriendlyPerformanceType";

class FriendlyPerformanceSummary {
    constructor(private answerPerformance: AnswerPerformance) {}

    public getPerformance(fullAnswer: string): FriendlyPerformanceType {
        return {
            bytesSize: this.answerPerformance.bytesSize,
            warmUpDurationSeconds: (this.answerPerformance.beginUnixEpochTimestampChunks - this.answerPerformance.beginUnixEpochTimestamp) / 1000,
            chunksDurationSeconds: (this.answerPerformance.endUnixEpochTimestamp - this.answerPerformance.beginUnixEpochTimestampChunks) / 1000,
            totalDurationInSeconds: (this.answerPerformance.endUnixEpochTimestamp - this.answerPerformance.beginUnixEpochTimestamp) / 1000,
            bytesPerSecond: this.answerPerformance.bytesSize / ((this.answerPerformance.endUnixEpochTimestamp - this.answerPerformance.beginUnixEpochTimestamp) / 1000),
            characteresPerSecond: fullAnswer.length / ((this.answerPerformance.endUnixEpochTimestamp - this.answerPerformance.beginUnixEpochTimestamp) / 1000),
            chunksPerSecond: this.answerPerformance.totalChunks / ((this.answerPerformance.endUnixEpochTimestamp - this.answerPerformance.beginUnixEpochTimestampChunks) / 1000)
        }
    }
}

export default FriendlyPerformanceSummary;