import { DataSource } from "typeorm";
import { AppDataSource } from "../dataSource";
import { Content } from "../entities/Content";
import { MetaName } from "../entities/MetaName";
import { LongTextMetaValue } from "../entities/LongTextMetaValue";
import Meta from "../../types/Meta";

class QuestionService {
    private content: Content;
    private question: string;
    private contentRepository: ReturnType<DataSource["getRepository"]>;
    private metaNameRepository: ReturnType<DataSource["getRepository"]>;
    private longTextStringRepository: ReturnType<DataSource["getRepository"]>;
    private metas: Meta[];

    constructor(dataSource: DataSource = AppDataSource) {
        this.content = new Content();
        this.contentRepository = dataSource.getRepository(Content);
        this.metaNameRepository = dataSource.getRepository(MetaName);
        this.longTextStringRepository = dataSource.getRepository(LongTextMetaValue);
        this.question = "";
        this.metas = [];
    }

    public setQuestion(question: string): void {
        this.question = question;
    }

    public addMeta(meta: Meta): void {
        this.metas.push(meta);
    }

    public addKeyValueMeta(key: string, value: string) {
        const newMeta = {
            name: key,
            value
        };

        this.metas.push(newMeta);
    }

    public async save() {
        await this.contentRepository.save(this.content);

        await this.saveMetaValue("kind", "question");
        await this.saveMetaValue("question", this.question);
        
        for (let i:number = 0; i < this.metas.length; i++) {
            await this.saveMetaValue(this.metas[i].name, this.metas[i].value)
        }

        this.question = "";
        this.metas = [];
    }

    private async saveMetaValue(key: string, value: string) {
        const metaName = new MetaName();
        metaName.meta_name = key;
        metaName.content = this.content;
        await this.metaNameRepository.save(metaName);

        const contentValue = new LongTextMetaValue();
        contentValue.string_meta_value = value;
        contentValue.metaName = metaName;
        await this.longTextStringRepository.save(contentValue);
    }
}

export default QuestionService;