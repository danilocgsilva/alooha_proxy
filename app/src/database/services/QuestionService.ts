import { DataSource } from "typeorm";
import { AppDataSource } from "../dataSource";
import { Content } from "../entities/Content";
import { MetaName } from "../entities/MetaName";
import { LongTextMetaValue } from "../entities/LongTextMetaValue";
import Meta from "../../types/Meta";

class QuestionService {
    private question: string;
    private contentRepository: ReturnType<DataSource["getRepository"]>;
    private metaNameRepository: ReturnType<DataSource["getRepository"]>;
    private longTextStringRepository: ReturnType<DataSource["getRepository"]>;
    private metas: Meta[];

    constructor(dataSource: DataSource = AppDataSource) {
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

    public async save() {
        const content = new Content();
        await this.contentRepository.save(content);

        const metaNameKind = new MetaName();
        metaNameKind.meta_name = "kind";
        metaNameKind.content = content;
        await this.metaNameRepository.save(metaNameKind);

        const contentValueKind = new LongTextMetaValue();
        contentValueKind.string_meta_value = "question";
        contentValueKind.metaName = metaNameKind;
        await this.longTextStringRepository.save(contentValueKind);


        const metaNameQuestion = new MetaName();
        metaNameQuestion.meta_name = "question";
        metaNameQuestion.content = content;
        await this.metaNameRepository.save(metaNameQuestion);

        const contentValueQuestion = new LongTextMetaValue();
        contentValueQuestion.string_meta_value = this.question;
        contentValueQuestion.metaName = metaNameQuestion;
        await this.longTextStringRepository.save(contentValueQuestion);

        
        for (let i:number = 0; i < this.metas.length; i++) {
            const metaName = new MetaName();
            metaName.meta_name = this.metas[i].name;
            metaName.content = content;
            await this.metaNameRepository.save(metaName);

            const contentValue = new LongTextMetaValue();
            contentValue.string_meta_value = this.metas[i].value;
            contentValue.metaName = metaName;
            await this.longTextStringRepository.save(contentValue);
        }

        this.question = "";
        this.metas = [];
    }
}

export default QuestionService;