import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from "typeorm";
import type { MetaName } from "./MetaName";

@Entity("integer_meta_value")
export class IntegerMetaValue {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  int_meta_value!: string;

  @Column()
  meta_names_id!: number;

  @OneToOne("MetaName", "integerMetaValue")
  @JoinColumn({ name: "meta_names_id" })
  metaName!: MetaName;
}
