import { AppDataSource } from "../dataSource";
import { MetaName } from "../entities/MetaName";

export const MetaNameRepository = AppDataSource.getRepository(MetaName);
