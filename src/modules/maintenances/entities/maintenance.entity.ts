import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VehicleEntity } from '../../vehicles/entities/vehicle.entity.js';
import { MechanicEntity } from '../../mechanics/entities/mechanic.entity.js';
import { WorkshopEntity } from '../../workshops/entities/workshop.entity.js';

export enum MaintenanceType {
  PREVENTIVE = 'PREVENTIVE',
  CORRECTIVE = 'CORRECTIVE',
}

export enum MaintenanceStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('maintenances')
export class MaintenanceEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'vehicle_id', type: 'int' })
  vehicleId: number;

  @ManyToOne(() => VehicleEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: VehicleEntity;

  @Column({ name: 'mechanic_id', type: 'int' })
  mechanicId: number;

  @ManyToOne(() => MechanicEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'mechanic_id' })
  mechanic: MechanicEntity;

  @Column({ name: 'workshop_id', type: 'int' })
  workshopId: number;

  @ManyToOne(() => WorkshopEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workshop_id' })
  workshop: WorkshopEntity;

  @Column({
    type: 'enum',
    enum: MaintenanceType,
    enumName: 'maintenance_type_enum',
    default: MaintenanceType.PREVENTIVE,
  })
  type: MaintenanceType;

  @Column('text')
  description: string;

  @Column('int')
  mileage: number;

  @Column({ name: 'scheduled_date', type: 'timestamptz' })
  scheduledDate: Date;

  @Column({
    type: 'enum',
    enum: MaintenanceStatus,
    enumName: 'maintenance_status_enum',
    default: MaintenanceStatus.SCHEDULED,
  })
  status: MaintenanceStatus;

  @Column({ name: 'work_done', type: 'text', nullable: true })
  workDone: string | null;

  @Column({
    name: 'final_cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  finalCost: number | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ name: 'final_mileage', type: 'int', nullable: true })
  finalMileage: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

