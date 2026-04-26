import type QuestionAnatomy from "./types/QuestionAnatomy";

class MetricWorks {
    static getAnatomy(requestBody: string, url: string): QuestionAnatomy {
        const messagesCurrentQuestion = JSON.parse(requestBody).messages;
        if (messagesCurrentQuestion.length !== 1) {
            Error("Unexpected request format.");
        }
        const dataUniqueMessage: Record<string, string> = messagesCurrentQuestion[0];
        const question: string = dataUniqueMessage.content;
        return {
            requestBody,
            url,
            question
        }
    }
}

export default MetricWorks;