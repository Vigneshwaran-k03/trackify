import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('kpi')
export class Kpi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text' })
  def: string;

  @Column()
  kra_name: string;

  @Column()
  kra_id: number;

  @Column({ type: 'date' })
  due_date: Date;

  @Column()
  scoring_method: string;

  // Target percentage goal for this KPI (interpreted as 0..100 goal)
  @Column({ type: 'float', nullable: true })
  target: number | null;

  @Column({ type: 'varchar', length: 191, nullable: true })
  dept: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  role: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column()
  created_by: string;

  @Column({ type: 'varchar', length: 10, default: 'Active' })
  kpi_status: string; // 'Active' | 'End'

  @Column({ type: 'float', nullable: true })
  score: number | null;

  @Column({ type: 'text', nullable: true })
  comments: string | null;
}
