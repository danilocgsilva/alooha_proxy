type QuestionAnatomy = {
    requestBody: string
    question: string,
    url: string,
    model: string,
    systemPrompt?: string,
}

export default QuestionAnatomy;