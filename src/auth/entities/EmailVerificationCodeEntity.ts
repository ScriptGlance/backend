import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('email_verification_code')
export class EmailVerificationCodeEntity {
    @PrimaryGeneratedColumn({ name: 'email_verification_code_id' })
    emailVerificationCodeId: number;

    @Column({ name: 'email', length: 100 })
    email: string;

    @Column({ name: 'expires_at' })
    expiresAt: Date;

    @Column({ name: 'verification_code', length: 10})
    verification_code: string;

    @Column({ name: 'is_verified'})
    isVerified: boolean;
}
