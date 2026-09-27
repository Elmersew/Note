import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class ListNotesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tag?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  trash?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  archived?: boolean;
}

export class CreateNoteDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsObject()
  content: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  tags?: string[];
}

export class UpdateNoteDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseVersion: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  tags?: string[];
}

export class NoteVersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseVersion: number;
}

export class ShareNoteDto {
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
