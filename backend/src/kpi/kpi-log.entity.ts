import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Kpi } from './kpi.entity';

@Entity('kpi_log')
export class KpiLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  kpi_id: number;

  @ManyToOne(() => Kpi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kpi_id', referencedColumnName: 'id' })
  kpi: Kpi;

  @Column({ type: 'int' })
  version: number; // 0 for initial snapshot, then increments per change

  @Column({ type: 'varchar', length: 255 })
  kpi_name: string;

  @Column({ type: 'varchar', length: 255 })
  kra_name: string;

  @Column()
  kra_id: number;

  @Column({ type: 'float', nullable: true })
  target: number | null;

  @Column({ type: 'float', nullable: true })
  score: number | null;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  created_by: string | null; // KPI creator name

  @Column({ type: 'varchar', length: 255, nullable: true })
  kra_creator_name: string | null; // KRA creator name

  @Column({ type: 'varchar', length: 255, nullable: true })
  dept: string | null;

  @Column({ type: 'varchar', length: 255 })
  updated_by: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'date', nullable: true })
  due_date: Date | null;

  // JSON string with { field: { from, to } }
  @Column({ type: 'text', nullable: true })
  changes: string | null;
}
