import LogInterface from "./../domain/LogInterface"
import { logger, requestLogger } from './../logger.js';

export default class LogImplementation implements LogInterface {
    public log(logText: string): void {
        logger.info(logText);
    };
}