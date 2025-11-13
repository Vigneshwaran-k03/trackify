import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Kra } from './kra.entity';

@Entity('kra_log')
export class KraLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  kra_id: number;

  @ManyToOne(() => Kra, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kra_id', referencedColumnName: 'kra_id' })
  kra: Kra;

  @Column({ type: 'int' })
  version: number; // 0 for initial snapshot, then increments per change

  @Column({ type: 'varchar', length: 255 })
  kra_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  dept: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  manager_name: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  employee_name: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  created_by: string | null;

  @Column({ type: 'varchar', length: 255 })
  updated_by: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'varchar', length: 255 })
  scoring_method: string;

  @Column({ type: 'float', nullable: true })
  target: number | null;

  @Column({ type: 'float', nullable: true, default: 0 })
  overall_score: number | null;

  // JSON string with { field: { from, to } }
  @Column({ type: 'text', nullable: true })
  changes: string | null;
}
