import LogInterface from "./../domain/LogInterface"

class LogConsole implements LogInterface {
    public log(logText: string): void {
        console.log(logText)
    };
}

export default LogConsole;
