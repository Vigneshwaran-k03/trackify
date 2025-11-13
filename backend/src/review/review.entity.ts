import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('reviews')
export class ReviewEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  employee_id: number;

  @Column({ type: 'varchar', length: 255 })
  employee_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  dept: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  role: string | null;

  @Column({ type: 'varchar', length: 255 })
  kra_name: string;

  @Column({ type: 'int' })
  @Index()
  kra_id: number;

  @Column({ type: 'float' })
  score: number; // manager rating score for the employee

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updated_by: string | null;

  @Column({ type: 'varchar', length: 255 })
  created_by: string;

  @Column({ type: 'datetime' })
  @Index()
  review_at: Date; // when the review was made (business date)

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}
