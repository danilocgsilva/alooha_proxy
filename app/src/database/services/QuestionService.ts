import { DataSource } from "typeorm";
import { AppDataSource } from "../dataSource";
import { Content } from "../entities/Content";
import { MetaName } from "../entities/MetaName";
import { LongTextMetaValue } from "../entities/LongTextMetaValue";

class QuestionService {
    private question!: string;
    private contentRepository: ReturnType<DataSource["getRepository"]>;
    private metaNameRepository: ReturnType<DataSource["getRepository"]>;
    private longTextStringRepository: ReturnType<DataSource["getRepository"]>;

    constructor(dataSource: DataSource = AppDataSource) {
        this.contentRepository = dataSource.getRepository(Content);
        this.metaNameRepository = dataSource.getRepository(MetaName);
        this.longTextStringRepository = dataSource.getRepository(LongTextMetaValue);
    }

    public setQuestion(question: string) {
        this.question = question;
    }

    public async save() {
        const content = new Content();
        await this.contentRepository.save(content);

        const metaName = new MetaName();
        metaName.meta_name = "kind";
        metaName.content = content;
        await this.metaNameRepository.save(metaName);

        const contentValue = new LongTextMetaValue();
        contentValue.string_meta_value = this.question;
        contentValue.metaName = metaName;
        await this.longTextStringRepository.save(contentValue);
    }
}

export default QuestionService;