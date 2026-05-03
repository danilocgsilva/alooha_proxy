type QuestionAnatomy = {
    requestBody: string
    question: string,
    systemPrompt?: string,
    url: string,
    model: string,
}

export default QuestionAnatomy;