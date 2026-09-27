import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { AiOperation } from '@sticky-notes/contracts';

const operations: AiOperation[] = ['POLISH', 'SUMMARIZE', 'CONTINUE', 'KEY_POINTS', 'CLASSIFY'];

export class AiTransformDto {
  @IsIn(operations)
  operation: AiOperation;

  @IsUUID()
  noteId: string;

  @IsOptional()
  @IsString()
  @MaxLength(30_000)
  selectedText?: string;
}

export class AiAskDto {
  @IsUUID()
  noteId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  question: string;
}
