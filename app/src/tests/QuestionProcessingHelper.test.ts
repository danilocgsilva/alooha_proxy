import QuestionProcessingHelper from "../server_domain/QuestionProcessingHelper";

describe("QuestionProcessingHelper", () => {
    it("returns a clear cancellation message for aborted requests", () => {
        expect(QuestionProcessingHelper.getRequestCancellationMessage("listModels")).toBe(
            "Request cancelled by client. Intent: listModels"
        );
    });
});
