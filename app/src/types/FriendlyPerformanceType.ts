type FriendlyPerformanceType = {
    bytesSize: number,
    answerTotalCharacters: number,
    warmUpDurationSeconds: number,
    chunksDurationSeconds: number,
    totalDurationInSeconds: number,
    bytesPerSecond: number,
    characteresPerSecond: number,
    chunksPerSecond: number,
}

export default FriendlyPerformanceType;