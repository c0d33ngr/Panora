import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UnifiedTicketInput {
  name: string;
  status?: string;
  description: string;
  due_date?: Date;
  type?: string;
  parent_ticket?: string;
  tags?: string; // TODO: create a real Tag object here
  completed_at?: Date;
  priority?: string;
  assigned_to?: string[];
  @ApiPropertyOptional({ type: [{}] })
  field_mappings?: Record<string, any>[];
}

export class UnifiedTicketOutput extends UnifiedTicketInput {
  @ApiProperty()
  id: string;
}
