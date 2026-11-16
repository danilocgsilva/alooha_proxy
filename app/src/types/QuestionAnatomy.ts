type QuestionAnatomy = {
    requestBody: string
    question: string,
    url: string,
    model: string,
    systemPrompt?: string,
    chatId?: string,
    options?: { [key: string]: unknown }
}

export default QuestionAnatomy;