import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  type: string; // e.g., 'submit'

  @Column({ type: 'varchar', length: 255 })
  title: string; // short title

  @Column({ type: 'text', nullable: true })
  message: string | null; // long message

  @Column({ type: 'varchar', length: 50 })
  @Index()
  targetRole: string; // Admin | Manager | Employee

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  targetName: string | null; // specific person name

  @Column({ type: 'json', nullable: true })
  meta: any | null; // kra, dept, etc.

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
