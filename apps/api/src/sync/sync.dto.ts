import { Type } from 'class-transformer';
import { ChangeOperation, EntityType } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Min, ValidateNested } from 'class-validator';

export class SyncOperationDto {
  @IsUUID()
  idempotencyKey: string;

  @IsEnum(EntityType)
  entityType: EntityType;

  @IsUUID()
  entityId: string;

  @IsEnum(ChangeOperation)
  operation: ChangeOperation;

  @IsOptional()
  @IsInt()
  @Min(0)
  baseVersion?: number | null;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class SyncPushDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  operations: SyncOperationDto[];
}

export class SyncPullQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  cursor?: string;
}
