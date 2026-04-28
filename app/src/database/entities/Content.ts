import { Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("contents")
export class Content {
  @PrimaryGeneratedColumn()
  id!: number;
}
