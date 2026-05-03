import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';
import { WorkflowPersistenceService } from './workflow-persistence.service';

@Global()
@Module({
  providers: [DbService, WorkflowPersistenceService],
  exports: [DbService, WorkflowPersistenceService],
})
export class DbModule {}
