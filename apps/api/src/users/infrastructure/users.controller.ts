import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  Body,
} from '@nestjs/common';
import { z } from 'zod';
import { CreateUserUseCase } from '../application/create-user.use-case';
import { EmailAlreadyExistsError } from '../application/user.repository';
import { formatZodValidationErrors } from '../../shared/validation/zod-validation-error';

const createUserSchema = z
  .object({
    name: z.string().trim().min(1),
    surname: z.string().trim().min(1),
    email: z.string().trim().min(1).email(),
    address: z.string().trim().min(1),
    phone: z.string().trim().min(1),
  })
  .strict();

@Controller('users')
export class UsersController {
  constructor(private readonly createUserUseCase: CreateUserUseCase) {}

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown) {
    const parsedBody = createUserSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: formatZodValidationErrors(parsedBody.error),
      });
    }

    try {
      return await this.createUserUseCase.execute(parsedBody.data);
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        throw new ConflictException('Email already exists');
      }

      throw error;
    }
  }
}
