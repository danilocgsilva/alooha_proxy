import { Entity, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { QuestionOptions } from "./QuestionOptions";

@Entity("contents")
export class Content {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => QuestionOptions, (questionOptions) => questionOptions.content, { nullable: true })
  questionOptions?: QuestionOptions | null;
}
