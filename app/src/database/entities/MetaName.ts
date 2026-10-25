import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToOne, OneToMany, Relation } from "typeorm";
import { Content } from "./Content";
import { LongTextMetaValue } from "./LongTextMetaValue";
import { IntegerMetaValue } from "./IntegerMetaValue";

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
  content!: Relation<Content>;

  @OneToOne(() => LongTextMetaValue, (v) => v.metaName)
  longTextMetaValue!: Relation<LongTextMetaValue>;

  @OneToOne(() => IntegerMetaValue, (v) => v.metaName)
  integerMetaValue!: Relation<IntegerMetaValue>;

  @Column({ nullable: true })
  parent_id!: number | null;

  @ManyToOne(() => MetaName, (m) => m.children, { nullable: true })
  @JoinColumn({ name: "parent_id" })
  parent!: Relation<MetaName> | null;

  @OneToMany(() => MetaName, (m) => m.parent)
  children!: Relation<MetaName>[];
}
