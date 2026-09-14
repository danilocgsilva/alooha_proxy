import LogImplementation from "../server_domain/LogImplementation";
import QuestionProcessingHelper from "../server_domain/QuestionProcessingHelper";
import MetricLifeCycle from "../server_domain/MetricLifeCycle";
import QuestionAnatomy from "../types/QuestionAnatomy";
import { AppDataSource } from "../database/dataSource";
import DatabaseSummarySaving from "../server_domain/DatabaseSummarySaving";
import Conclusion from "../types/Conclusion";

export default class ServerDomain {
  private finishing: boolean = false;

  constructor(
    private logWritter: LogImplementation,
    private metricLifeCycle: MetricLifeCycle
  ) {
  }

  public saveQuestionEarly(questionAnatomy: QuestionAnatomy) {
    const beginMs = this.metricLifeCycle.getBeginTime();
    const answerPerformance = {
      question: questionAnatomy.question,
      answer: "",
      beginUnixEpochTimestamp: beginMs,
      beginUnixEpochTimestampChunks: beginMs,
      endUnixEpochTimestamp: beginMs,
      bytesSize: 0,
      totalChunks: 0
    };
    const databaseSummarySaving = new DatabaseSummarySaving(AppDataSource, answerPerformance, questionAnatomy);
    databaseSummarySaving.partialSave();
    this.metricLifeCycle.setDatabaseSummarySaving(databaseSummarySaving);
    this.logWritter.log("Early partial save to database");
  }

  public async finishQuestionIfNeeded(
    completed: boolean,
    requestIntentString: string,
    questionAnatomy: QuestionAnatomy | null,
    totalBytes: number,
    totalChunks: number,
    conclusion: Conclusion
  ): Promise<boolean> {
    if (completed || this.finishing) {
      return completed;
    }

    this.finishing = true;

    completed = true;
    this.logWritter.log("===> End event reached <===");

    if (requestIntentString === "question") {
      await QuestionProcessingHelper.finishQuestion(
        this.metricLifeCycle,
        questionAnatomy,
        totalBytes,
        totalChunks,
        this.logWritter,
        conclusion
      );
    }
    return completed;
  }
}