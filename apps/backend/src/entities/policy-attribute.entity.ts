import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Policy } from './policy.entity';
import { Attribute } from './attribute.entity';

@Entity('policy_attributes')
@Unique(['policyId', 'attributeId'])
export class PolicyAttribute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'policy_id', type: 'uuid' })
  policyId: string;

  @Index()
  @Column({ name: 'attribute_id', type: 'uuid' })
  attributeId: string;

  @Column({ name: 'required_value', length: 255, nullable: true })
  requiredValue: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Policy, (policy) => policy.policyAttributes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;

  @ManyToOne(() => Attribute, (attribute) => attribute.policyAttributes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attribute_id' })
  attribute: Attribute;
}
