import { AppDataSource } from "../dataSource.js";
import { ChatData } from "../../types/ChatData.js";
import LogImplementation from "../../server_domain/LogImplementation.js";

export default class ChatHistoryService {
  private logWritter: LogImplementation;

  constructor(dataSource = AppDataSource) {
    this.logWritter = new LogImplementation();
    this.dataSource = dataSource;
  }

  private dataSource;

  public async getChatHistory(limit: number): Promise<ChatData[]> {
    return [
      {
        uuid: "abc1245",
        question: "Soome question",
        answer: "The answer",
        model: "qwen3",
        createdAt: new Date()
      }
    ]
  }
}