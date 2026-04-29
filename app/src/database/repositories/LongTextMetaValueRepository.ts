import { AppDataSource } from "../dataSource";
import { LongTextMetaValue } from "../entities/LongTextMetaValue";

export const LongTextMetaValueRepository = AppDataSource.getRepository(LongTextMetaValue);
