import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Stores edit requests for KRA assignment fields (manager_name/employee_name). Applied on approval only.
@Entity('kra_change_request')
export class KraChangeRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  kra_id: number;

  // Who requested the change
  @Column({ type: 'varchar', length: 32 })
  requester_role: 'Manager';

  @Column({ type: 'varchar', length: 255 })
  requester_name: string;

  // Who should approve it
  @Column({ type: 'varchar', length: 32 })
  approver_role: 'Admin';

  // Optional approver name (generally null for Admin)
  @Column({ type: 'varchar', length: 255, nullable: true })
  approver_name: string | null;

  // JSON payload of requested changes. Only the following keys are allowed:
  // { manager_name?: string|null, employee_name?: string|null }
  @Column({ type: 'text' })
  requested_changes: string;

  // Reason for edit provided by requester
  @Column({ type: 'text', nullable: true })
  request_comment: string | null;

  // Decision fields
  @Index()
  @Column({ type: 'varchar', length: 16, default: 'Pending' })
  status: 'Pending' | 'Approved' | 'Rejected';

  @Column({ type: 'text', nullable: true })
  decision_comment: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  decided_by: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  decided_at: Date | null;

  // Routing and filtering helpers
  @Column({ type: 'varchar', length: 255, nullable: true })
  kra_name: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  dept: string | null;
}
