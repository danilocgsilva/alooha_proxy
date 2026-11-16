import { DataSource } from "typeorm";
import { AppDataSource } from "../dataSource";
import { Content } from "../entities/Content";
import { MetaName } from "../entities/MetaName";
import { LongTextMetaValue } from "../entities/LongTextMetaValue";
import { QuestionOptions } from "../entities/QuestionOptions";
import Meta from "../../types/Meta";

class QuestionService {
    private content: Content;
    private question: string;
    private questionOptions?: Record<string, unknown>;
    private contentRepository: ReturnType<DataSource["getRepository"]>;
    private metaNameRepository: ReturnType<DataSource["getRepository"]>;
    private longTextStringRepository: ReturnType<DataSource["getRepository"]>;
    private questionOptionsRepository: ReturnType<DataSource["getRepository"]>;
    private metas: Meta[];

    constructor(dataSource: DataSource = AppDataSource) {
        this.content = new Content();
        this.contentRepository = dataSource.getRepository(Content);
        this.metaNameRepository = dataSource.getRepository(MetaName);
        this.longTextStringRepository = dataSource.getRepository(LongTextMetaValue);
        this.questionOptionsRepository = dataSource.getRepository(QuestionOptions);
        this.question = "";
        this.questionOptions = undefined;
        this.metas = [];
    }

    public setQuestion(question: string): void {
        this.question = question;
    }

    public addMeta(meta: Meta): void {
        this.metas.push(meta);
    }

    public setQuestionOptions(options: Record<string, unknown>): void {
        this.questionOptions = options;
    }

    public addKeyValueMeta(key: string, value: string) {
        const newMeta = {
            name: key,
            value
        };

        this.metas.push(newMeta);
    }

    public async save(): Promise<number> {
        await this.contentRepository.save(this.content);

        if (this.questionOptions && Object.keys(this.questionOptions).length > 0) {
            const questionOptions = new QuestionOptions();
            questionOptions.options = this.questionOptions;
            questionOptions.content = this.content;
            await this.questionOptionsRepository.save(questionOptions);
        }

        await this.persistMeta(this.content, "kind", "question");
        await this.persistMeta(this.content, "question", this.question);

        for (let i: number = 0; i < this.metas.length; i++) {
            await this.persistMeta(this.content, this.metas[i].name, this.metas[i].value);
        }

        const contentId = this.content.id;
        this.question = "";
        this.questionOptions = undefined;
        this.metas = [];

        return contentId;
    }

    public async saveToContent(contentId: number): Promise<void> {
        const content = new Content();
        content.id = contentId;

        for (let i: number = 0; i < this.metas.length; i++) {
            await this.persistMeta(content, this.metas[i].name, this.metas[i].value);
        }

        this.metas = [];
    }

    private async persistMeta(content: Content, key: string, value: string) {
        const metaName = new MetaName();
        metaName.meta_name = key;
        metaName.content = content;
        await this.metaNameRepository.save(metaName);

        const contentValue = new LongTextMetaValue();
        contentValue.string_meta_value = value;
        contentValue.metaName = metaName;
        await this.longTextStringRepository.save(contentValue);
    }
}

export default QuestionService;