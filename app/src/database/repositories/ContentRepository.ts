import { AppDataSource } from "../dataSource";
import { Content } from "../entities/Content";

export const ContentRepository = AppDataSource.getRepository(Content);
