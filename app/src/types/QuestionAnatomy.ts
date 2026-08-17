type QuestionAnatomy = {
    requestBody: string
    question: string,
    url: string,
    model: string,
    systemPrompt?: string,
    chatId?: string
}

export default QuestionAnatomy;