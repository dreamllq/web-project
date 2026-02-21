import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from '../entities/permission.entity';
import { Policy } from '../entities/policy.entity';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { AbacService } from './abac.service';
import { AbacController } from './abac.controller';
import { PolicyModule } from '../policy/policy.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Permission, Policy, Role, User]),
    PolicyModule, // Import PolicyModule for guards and decorators
  ],
  controllers: [AbacController],
  providers: [AbacService],
  exports: [AbacService],
})
export class AbacModule {}
