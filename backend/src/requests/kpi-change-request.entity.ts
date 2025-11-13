import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Stores edit requests for KPI fields (not including score). Applied on approval only.
@Entity('kpi_change_request')
export class KpiChangeRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  kpi_id: number;

  // Who requested the change
  @Column({ type: 'varchar', length: 32 })
  requester_role: 'Employee' | 'Manager';

  @Column({ type: 'varchar', length: 255 })
  requester_name: string;

  // Who should approve it
  @Column({ type: 'varchar', length: 32 })
  approver_role: 'Manager' | 'Admin';

  // Optional routing to a specific approver by name (e.g., manager name)
  @Column({ type: 'varchar', length: 255, nullable: true })
  approver_name: string | null;

  // JSON payload of requested changes. Only the following keys are allowed:
  // { name?: string, def?: string, due_date?: string (YYYY-MM-DD), scoring_method?: string, target?: number|null }
  @Column({ type: 'text' })
  requested_changes: string;

  @Column({ type: 'varchar', length: 16, default: 'edit' })
  action: 'edit' | 'delete';

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

  @Column({ type: 'int', nullable: true })
  kra_id: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  dept: string | null;
}
