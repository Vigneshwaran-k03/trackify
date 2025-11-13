import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('kra')
export class Kra {
  @PrimaryGeneratedColumn()
  kra_id: number;

  @Column()
  name: string;

  @Column({ type: 'text' })
  definition: string;

  @Column()
  dept: string;

  @Column({ nullable: true })
  manager_name: string;

  @Column({ nullable: true })
  employee_name: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column()
  created_by: string;

  @Column()
  scoring_method: string;

  @Column({ type: 'float', nullable: true })
  target: number | null;

  @Column({ type: 'float', nullable: true, default: 0 })
  overall_score: number | null;
}