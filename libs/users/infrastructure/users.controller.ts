import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Body,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import { CreateProfileUseCase } from '../application/create-profile.use-case';
import { GetCurrentProfileUseCase } from '../application/get-current-profile.use-case';
import {
  ProfileAlreadyExistsError,
  ProfileNotFoundError,
} from '../application/profile.repository';
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
  constructor(
    @Inject(CreateProfileUseCase)
    private readonly createProfileUseCase: CreateProfileUseCase,
    @Inject(GetCurrentProfileUseCase)
    private readonly getCurrentProfileUseCase: GetCurrentProfileUseCase,
  ) {}

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('me')
  async getCurrentProfile(@Req() request: SessionRequest) {
    if (!request.authUserId) {
      throw new UnauthorizedException('Invalid session');
    }

    try {
      return await this.getCurrentProfileUseCase.execute(request.authUserId);
    } catch (error) {
      if (error instanceof ProfileNotFoundError) {
        throw new NotFoundException('Profile not found');
      }

      throw error;
    }
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
