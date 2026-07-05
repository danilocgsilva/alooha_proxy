import QuestionProcessingHelper from "../server_domain/QuestionProcessingHelper";

describe("QuestionProcessingHelper", () => {
    it("returns a clear cancellation message for aborted requests", () => {
        expect(QuestionProcessingHelper.getRequestCancellationMessage("listModels")).toBe(
            "Request cancelled by client. Intent: listModels"
        );
    });

    it("asks to log cancellation when no streaming content started", () => {
        expect(QuestionProcessingHelper.shouldLogCancellationMessage(false, false)).toBe(true);
        expect(QuestionProcessingHelper.shouldLogCancellationMessage(false, true)).toBe(false);
        expect(QuestionProcessingHelper.shouldLogCancellationMessage(true, false)).toBe(false);
    });
});
