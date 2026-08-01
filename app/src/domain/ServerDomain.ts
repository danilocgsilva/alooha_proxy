import LogImplementation from "../server_domain/LogImplementation";
import QuestionProcessingHelper from "../server_domain/QuestionProcessingHelper";
import MetricLifeCycle from "../server_domain/MetricLifeCycle";
import QuestionAnatomy from "../types/QuestionAnatomy";

export default class ServerDomain {
  constructor(
    private logWritter: LogImplementation,
    private metricLifeCycle: MetricLifeCycle
  ) {
  }

  public finishQuestionIfNeeded(
    completed: boolean,
    requestIntentString: string,
    questionAnatomy: QuestionAnatomy | null,
    totalBytes: number,
    totalChunks: number
  ): boolean {
    if (completed) {
      return completed;
    }

    completed = true;
    this.logWritter.log("===> End event reached <===");

    if (requestIntentString === "question") {
      QuestionProcessingHelper.finishQuestion(
        this.metricLifeCycle,
        questionAnatomy,
        totalBytes,
        totalChunks,
        this.logWritter
      );
    }
    return true;
  }
}