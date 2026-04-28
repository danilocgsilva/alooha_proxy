import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from "typeorm";
import { MetaName } from "./MetaName";

@Entity("long_text_meta_value")
export class LongTextMetaValue {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  string_meta_value!: string;

  @Column()
  meta_names_id!: number;

  @OneToOne(() => MetaName)
  @JoinColumn({ name: "meta_names_id" })
  metaName!: MetaName;
}
