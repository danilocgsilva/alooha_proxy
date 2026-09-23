import { DataSource } from 'typeorm';
import { Content } from '../entities/Content';
import { MetaName } from '../entities/MetaName';
import { LongTextMetaValue } from '../entities/LongTextMetaValue';

interface ChatMessage {
  question: string;
  answer: string;
}

interface ChatData {
  chatId: string;
  model: string;
  messages: ChatMessage[];
}

export class ChatHistoryService {
  private dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  async getChatHistory(): Promise<ChatData[]> {
    const contentRepository = this.dataSource.getRepository(Content);
    const longTextMetaValueRepository = this.dataSource.getRepository(LongTextMetaValue);

    const chatIdResults = await longTextMetaValueRepository
      .createQueryBuilder('ltmv')
      .innerJoin(MetaName, 'mn', 'ltmv.meta_names_id = mn.id')
      .where('mn.meta_name = :metaName', { metaName: 'chatId' })
      .select('ltmv.string_meta_value')
      .distinct(true)
      .getRawMany<{ string_meta_value: string }>();

    const chatIds = chatIdResults.map(r => r.string_meta_value);
    
    const chats: ChatData[] = [];

    for (const chatId of chatIds) {
      const contentRecords = await contentRepository
        .createQueryBuilder('c')
        .innerJoin(MetaName, 'mn', 'c.id = mn.content_id')
        .innerJoin(LongTextMetaValue, 'ltmv', 'mn.id = ltmv.meta_names_id')
        .where('mn.meta_name = :metaName AND ltmv.string_meta_value = :chatId', { 
          metaName: 'chatId', 
          chatId 
        })
        .orderBy('c.begin', 'ASC')
        .getMany();

      if (contentRecords.length === 0) continue;

      const messages: ChatMessage[] = [];
      const models: Record<string, number> = {};
      
      for (const content of contentRecords) {
        const metaValues = await longTextMetaValueRepository
          .createQueryBuilder('ltmv')
          .innerJoin(MetaName, 'mn', 'ltmv.meta_names_id = mn.id')
          .where('mn.content_id = :contentId', { contentId: content.id })
          .select(['mn.meta_name', 'ltmv.string_meta_value'])
          .getRawMany<{ meta_name: string; string_meta_value: string }>();

        // Create a map of meta values
        const metaMap = new Map<string, string>();
        metaValues.forEach(({ meta_name, string_meta_value }) => {
          metaMap.set(meta_name, string_meta_value);
        });

        const question = metaMap.get('question') || '';
        const answer = metaMap.get('answer') || '';

        if (question || answer) {
          messages.push({ question, answer });
        }

        const model = metaMap.get('model');
        if (model) {
          models[model] = (models[model] || 0) + 1;
        }
      }

      const mostUsedModel = Object.entries(models).length > 0 
        ? Object.entries(models).reduce((a, b) => a[1] > b[1] ? a : b)[0]
        : '';

      chats.push({
        chatId,
        model: mostUsedModel,
        messages
      });
    }

    const chatBeginMap = new Map<string, string>();
    
    for (const chat of chats) {
      const firstContent = await contentRepository
        .createQueryBuilder('c')
        .innerJoin(MetaName, 'mn', 'c.id = mn.content_id')
        .innerJoin(LongTextMetaValue, 'ltmv', 'mn.id = ltmv.meta_names_id')
        .where('mn.meta_name = :metaName AND ltmv.string_meta_value = :chatId', { 
          metaName: 'chatId', 
          chatId: chat.chatId 
        })
        .orderBy('c.begin', 'ASC')
        .select('c.begin')
        .getOne();
      
      chatBeginMap.set(chat.chatId, firstContent?.begin || '');
    }

    return chats.sort((a, b) => {
      const beginA = new Date(chatBeginMap.get(a.chatId) || '').getTime();
      const beginB = new Date(chatBeginMap.get(b.chatId) || '').getTime();
      return beginA - beginB;
    });
  }
}
