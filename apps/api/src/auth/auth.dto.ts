import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class RegisterDto {
  @ValidateIf((value: RegisterDto) => !value.phone || Boolean(value.email))
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsOptional()
  email?: string;

  @ValidateIf((value: RegisterDto) => !value.email || Boolean(value.phone))
  @Matches(/^\+?[1-9]\d{6,14}$/)
  @IsOptional()
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsString()
  @Length(1, 80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  displayName: string;
}

export class LoginDto {
  @IsString()
  @Length(3, 191)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  identifier: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
