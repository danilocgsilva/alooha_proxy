import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToOne } from "typeorm";
import { Content } from "./Content";
import { LongTextMetaValue } from "./LongTextMetaValue";

@Entity("meta_names")
export class MetaName {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  meta_name!: string;

  @Column()
  content_id!: number;

  @ManyToOne(() => Content)
  @JoinColumn({ name: "content_id" })
  content!: Content;

  @OneToOne(() => LongTextMetaValue, (v) => v.metaName)
  longTextMetaValue!: LongTextMetaValue;
}
