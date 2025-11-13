import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('scoring')
export class Scoring {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  kra_id: number;

  @Column()
  kpi_id: number;

  @Column()
  kra_name: string;

  @Column()
  kpi_name: string;

  @Column()
  kpi_createdby: string;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @Column({ type: 'float' })
  score: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
