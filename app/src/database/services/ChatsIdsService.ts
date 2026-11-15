import { AppDataSource } from "../dataSource.js";
import { LongTextMetaValue } from "../entities/LongTextMetaValue.js";
import { DataSource } from "typeorm";

export default class ChatsIdsService {
    constructor(private dataSource: DataSource = AppDataSource) {}

    async getLastChatIds(): Promise<string[]> {
        const rows = await this.dataSource
            .getRepository(LongTextMetaValue)
            .createQueryBuilder("ltmv")
            .select("ltmv.string_meta_value")
            .leftJoin("ltmv.metaName", "mn")
            .where("mn.meta_name = :name", { name: "chatId" })
            .distinct(true)
            .orderBy("ltmv.id", "DESC")
            .limit(10)
            .getMany();

        return rows.map((r) => r.string_meta_value);
    }
}
