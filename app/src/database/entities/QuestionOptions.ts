import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Content } from "./Content";

@Entity("question_options")
export class QuestionOptions {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "jsonb" })
  options!: Record<string, unknown>;

  @Column()
  content_id!: number;

  @OneToOne(() => Content, (content) => content.questionOptions, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "content_id" })
  content!: Content;
}
