import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Patch,
  Post,
  Body,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import { CreateProfileUseCase } from '../application/create-profile.use-case';
import { GetCurrentProfileUseCase } from '../application/get-current-profile.use-case';
import { GetUserSettingsUseCase } from '../application/get-user-settings.use-case';
import { UpdateUserSettingsUseCase } from '../application/update-user-settings.use-case';
import {
  ProfileAlreadyExistsError,
  ProfileNotFoundError,
} from '../application/profile.repository';
import { UserSettingsNotFoundError } from '../application/user-settings.repository';
import { SUPPORTED_LANGUAGES } from '../domain/supported-language.vo';
import { formatZodValidationErrors } from '@app/shared/validation/zod-validation-error';

const createProfileSchema = z
  .object({
    name: z.string().trim().min(1),
    surname: z.string().trim().min(1),
    address: z.string().trim().min(1),
    phone: z.string().trim().min(1),
  })
  .strict();

const updateUserSettingsSchema = z
  .object({
    language: z.enum(SUPPORTED_LANGUAGES),
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
    @Inject(GetUserSettingsUseCase)
    private readonly getUserSettingsUseCase: GetUserSettingsUseCase,
    @Inject(UpdateUserSettingsUseCase)
    private readonly updateUserSettingsUseCase: UpdateUserSettingsUseCase,
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

  @Get('me/settings')
  async getUserSettings(@Req() request: SessionRequest) {
    if (!request.authUserId) {
      throw new UnauthorizedException('Invalid session');
    }

    try {
      return await this.getUserSettingsUseCase.execute(request.authUserId);
    } catch (error) {
      if (error instanceof UserSettingsNotFoundError) {
        throw new NotFoundException('Settings not found');
      }

      throw error;
    }
  }

  @Patch('me/settings')
  async updateUserSettings(
    @Body() body: unknown,
    @Req() request: SessionRequest,
  ) {
    const parsedBody = updateUserSettingsSchema.safeParse(body);
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

    return this.updateUserSettingsUseCase.execute({
      authUserId: request.authUserId,
      language: parsedBody.data.language,
    });
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
