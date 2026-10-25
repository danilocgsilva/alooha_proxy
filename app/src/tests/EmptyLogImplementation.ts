import LogInterface from "./../domain/LogInterface"

export default class EmptyLogImplementation implements LogInterface {
    public log(logText: string): void {
    };
}