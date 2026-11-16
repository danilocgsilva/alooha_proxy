type AnswerPerformance = {
    question: string,
    answer: string,
    beginUnixEpochTimestamp: number,
    beginUnixEpochTimestampChunks: number,
    endUnixEpochTimestamp: number,
    bytesSize: number,
    totalChunks: number
}

export default AnswerPerformance;
