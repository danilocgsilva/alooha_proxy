import { ContentRepository } from "../repositories/ContentRepository";
import { MetaNameRepository } from "../repositories/MetaNameRepository";
import { LongTextMetaValueRepository } from "../repositories/LongTextMetaValueRepository";
import { Content } from "../entities/Content";
import { MetaName } from "../entities/MetaName";
import { LongTextMetaValue } from "../entities/LongTextMetaValue";

class QuestionService {
    private question!: string;
    private contentRepository: typeof ContentRepository;
    private metaNameRepository: typeof MetaNameRepository;
    private longTextStringRepository: typeof LongTextMetaValueRepository;

    constructor() {
        this.contentRepository = ContentRepository;
        this.metaNameRepository = MetaNameRepository;
        this.longTextStringRepository = LongTextMetaValueRepository;
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