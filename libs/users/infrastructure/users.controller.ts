import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Body,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import { CreateProfileUseCase } from '../application/create-profile.use-case';
import { ProfileAlreadyExistsError } from '../application/profile.repository';
import { formatZodValidationErrors } from '@app/shared/validation/zod-validation-error';

const createProfileSchema = z
  .object({
    name: z.string().trim().min(1),
    surname: z.string().trim().min(1),
    address: z.string().trim().min(1),
    phone: z.string().trim().min(1),
  })
  .strict();

interface SessionRequest {
  authUserId?: string;
  authEmailVerified?: boolean;
}

@Controller('users')
export class UsersController {
  constructor(private readonly createProfileUseCase: CreateProfileUseCase) {}

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown, @Req() request: SessionRequest) {
    const parsedBody = createProfileSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: formatZodValidationErrors(parsedBody.error),
      });
    }

    if (!request.authUserId) {
      throw new UnauthorizedException('Invalid session');
    }

    if (!request.authEmailVerified) {
      throw new ForbiddenException('Email not verified');
    }

    try {
      return await this.createProfileUseCase.execute({
        ...parsedBody.data,
        authUserId: request.authUserId,
      });
    } catch (error) {
      if (error instanceof ProfileAlreadyExistsError) {
        throw new ConflictException('Profile already exists');
      }

      throw error;
    }
  }
}
