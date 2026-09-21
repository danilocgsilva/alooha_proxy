import { AppDataSource } from "../dataSource";
import { QuestionOptions } from "../entities/QuestionOptions";

export const QuestionOptionsRepository = AppDataSource.getRepository(QuestionOptions);
