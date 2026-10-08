import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CreateProfileUseCase } from '../application/create-profile.use-case';
import { GetCurrentProfileUseCase } from '../application/get-current-profile.use-case';
import { GetUserSettingsUseCase } from '../application/get-user-settings.use-case';
import { UpdateUserSettingsUseCase } from '../application/update-user-settings.use-case';
import {
  ProfileAlreadyExistsError,
  ProfileNotFoundError,
} from '../application/profile.repository';
import { UserSettingsNotFoundError } from '../application/user-settings.repository';
import { UsersController } from '../infrastructure/users.controller';

describe('users contract', () => {
  let app: INestApplication<App>;
  const execute =
    jest.fn<
      (input: {
        authUserId: string;
        name: string;
        surname: string;
        address: string;
        phone: string;
      }) => Promise<unknown>
    >();

  const getCurrentExecute = jest.fn<(authUserId: string) => Promise<unknown>>();

  const getSettingsExecute =
    jest.fn<(authUserId: string) => Promise<unknown>>();

  const updateSettingsExecute =
    jest.fn<
      (input: { authUserId: string; language: string }) => Promise<unknown>
    >();

  beforeEach(async () => {
    execute.mockReset();
    getCurrentExecute.mockReset();
    getSettingsExecute.mockReset();
    updateSettingsExecute.mockReset();
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: CreateProfileUseCase, useValue: { execute } },
        {
          provide: GetCurrentProfileUseCase,
          useValue: { execute: getCurrentExecute },
        },
        {
          provide: GetUserSettingsUseCase,
          useValue: { execute: getSettingsExecute },
        },
        {
          provide: UpdateUserSettingsUseCase,
          useValue: { execute: updateSettingsExecute },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.use(
      (
        req: {
          headers: Record<string, unknown>;
          authUserId?: string;
          authEmailVerified?: boolean;
        },
        _res: unknown,
        next: () => void,
      ) => {
        const authUserId = req.headers['x-auth-user-id'];
        if (typeof authUserId === 'string') {
          req.authUserId = authUserId;
        }
        req.authEmailVerified = req.headers['x-email-verified'] === 'true';
        next();
      },
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a profile for the server-derived authenticated identity', async () => {
    execute.mockResolvedValue({
      id: 1,
      authUserId: 'auth-user-1',
      name: 'Ada',
      surname: 'Lovelace',
      address: '1 Main Street',
      phone: '555-0100',
    });

    await request(app.getHttpServer())
      .post('/users')
      .set('x-auth-user-id', 'auth-user-1')
      .set('x-email-verified', 'true')
      .send({
        name: ' Ada ',
        surname: ' Lovelace ',
        address: ' 1 Main Street ',
        phone: '555-0100',
      })
      .expect(201)
      .expect({
        id: 1,
        authUserId: 'auth-user-1',
        name: 'Ada',
        surname: 'Lovelace',
        address: '1 Main Street',
        phone: '555-0100',
      });

    expect(execute).toHaveBeenCalledWith({
      authUserId: 'auth-user-1',
      name: 'Ada',
      surname: 'Lovelace',
      address: '1 Main Street',
      phone: '555-0100',
    });
  });

  it('rejects profile creation without an active session', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({
        name: 'Ada',
        surname: 'Lovelace',
        address: 'Street',
        phone: '555',
      })
      .expect(401)
      .expect({
        statusCode: 401,
        message: 'Invalid session',
        error: 'Unauthorized',
      });

    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects profile creation for an unverified identity', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .set('x-auth-user-id', 'auth-user-1')
      .set('x-email-verified', 'false')
      .send({
        name: 'Ada',
        surname: 'Lovelace',
        address: 'Street',
        phone: '555',
      })
      .expect(403)
      .expect({
        statusCode: 403,
        message: 'Email not verified',
        error: 'Forbidden',
      });

    expect(execute).not.toHaveBeenCalled();
  });

  it('returns descriptive details for missing fields', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .set('x-auth-user-id', 'auth-user-1')
      .set('x-email-verified', 'true')
      .send({ name: 'Sergi', surname: 'Ventura Solsona' })
      .expect(400)
      .expect({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: [
          {
            field: 'address',
            code: 'required',
            message: 'address is required',
          },
          { field: 'phone', code: 'required', message: 'phone is required' },
        ],
      });

    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects empty fields and identity-related or unknown fields', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .set('x-auth-user-id', 'auth-user-1')
      .set('x-email-verified', 'true')
      .send({
        name: '',
        surname: 'Lovelace',
        address: 'Street',
        phone: '555',
        email: 'ada@example.com',
        authUserId: 'forged',
        id: 9,
      })
      .expect(400)
      .expect((response) => {
        const body = response.body as {
          message: string;
          details: unknown[];
        };

        expect(body.message).toBe('Validation failed');
        expect(body.details).toEqual(
          expect.arrayContaining([
            {
              field: 'name',
              code: 'too_small',
              message: 'name cannot be empty',
            },
            {
              field: 'email',
              code: 'unrecognized_keys',
              message: 'email is not allowed',
            },
            {
              field: 'authUserId',
              code: 'unrecognized_keys',
              message: 'authUserId is not allowed',
            },
            {
              field: 'id',
              code: 'unrecognized_keys',
              message: 'id is not allowed',
            },
          ]),
        );
      });

    expect(execute).not.toHaveBeenCalled();
  });

  it('maps duplicate profile errors to conflict', async () => {
    execute.mockRejectedValue(new ProfileAlreadyExistsError());

    await request(app.getHttpServer())
      .post('/users')
      .set('x-auth-user-id', 'auth-user-1')
      .set('x-email-verified', 'true')
      .send({
        name: 'Ada',
        surname: 'Lovelace',
        address: 'Street',
        phone: '555',
      })
      .expect(409)
      .expect({
        statusCode: 409,
        message: 'Profile already exists',
        error: 'Conflict',
      });
  });

  it('returns the authenticated caller profile from GET /users/me', async () => {
    getCurrentExecute.mockResolvedValue({
      id: 1,
      authUserId: 'auth-user-1',
      name: 'Ada',
      surname: 'Lovelace',
      address: '1 Main Street',
      phone: '555-0100',
    });

    await request(app.getHttpServer())
      .get('/users/me')
      .set('x-auth-user-id', 'auth-user-1')
      .expect(200)
      .expect({
        id: 1,
        authUserId: 'auth-user-1',
        name: 'Ada',
        surname: 'Lovelace',
        address: '1 Main Street',
        phone: '555-0100',
      });

    expect(getCurrentExecute).toHaveBeenCalledWith('auth-user-1');
  });

  it('rejects profile retrieval without an active session', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401).expect({
      statusCode: 401,
      message: 'Invalid session',
      error: 'Unauthorized',
    });

    expect(getCurrentExecute).not.toHaveBeenCalled();
  });

  it('returns 404 when the identity has no profile', async () => {
    getCurrentExecute.mockRejectedValue(new ProfileNotFoundError());

    await request(app.getHttpServer())
      .get('/users/me')
      .set('x-auth-user-id', 'auth-user-1')
      .expect(404)
      .expect({
        statusCode: 404,
        message: 'Profile not found',
        error: 'Not Found',
      });
  });

  it('does not require email verification to read the profile', async () => {
    getCurrentExecute.mockResolvedValue({
      id: 1,
      authUserId: 'auth-user-1',
      name: 'Ada',
      surname: 'Lovelace',
      address: '1 Main Street',
      phone: '555-0100',
    });

    await request(app.getHttpServer())
      .get('/users/me')
      .set('x-auth-user-id', 'auth-user-1')
      .set('x-email-verified', 'false')
      .expect(200);
  });

  it('uses only the session identity when the request supplies another identifier', async () => {
    getCurrentExecute.mockResolvedValue({
      id: 1,
      authUserId: 'auth-user-1',
      name: 'Ada',
      surname: 'Lovelace',
      address: '1 Main Street',
      phone: '555-0100',
    });

    await request(app.getHttpServer())
      .get('/users/me?authUserId=forged')
      .set('x-auth-user-id', 'auth-user-1')
      .expect(200);

    expect(getCurrentExecute).toHaveBeenCalledWith('auth-user-1');
  });

  it('returns the authenticated caller settings from GET /users/me/settings', async () => {
    getSettingsExecute.mockResolvedValue({ language: 'ca' });

    await request(app.getHttpServer())
      .get('/users/me/settings')
      .set('x-auth-user-id', 'auth-user-1')
      .expect(200)
      .expect({ language: 'ca' });

    expect(getSettingsExecute).toHaveBeenCalledWith('auth-user-1');
  });

  it('rejects settings retrieval without an active session', async () => {
    await request(app.getHttpServer())
      .get('/users/me/settings')
      .expect(401)
      .expect({
        statusCode: 401,
        message: 'Invalid session',
        error: 'Unauthorized',
      });

    expect(getSettingsExecute).not.toHaveBeenCalled();
  });

  it('returns 404 when the identity has no settings', async () => {
    getSettingsExecute.mockRejectedValue(new UserSettingsNotFoundError());

    await request(app.getHttpServer())
      .get('/users/me/settings')
      .set('x-auth-user-id', 'auth-user-1')
      .expect(404)
      .expect({
        statusCode: 404,
        message: 'Settings not found',
        error: 'Not Found',
      });
  });

  it('uses only the session identity when another identifier is supplied for settings', async () => {
    getSettingsExecute.mockResolvedValue({ language: 'en' });

    await request(app.getHttpServer())
      .get('/users/me/settings?authUserId=forged')
      .set('x-auth-user-id', 'auth-user-1')
      .expect(200);

    expect(getSettingsExecute).toHaveBeenCalledWith('auth-user-1');
  });

  it('updates the caller settings from PATCH /users/me/settings', async () => {
    updateSettingsExecute.mockResolvedValue({ language: 'en' });

    await request(app.getHttpServer())
      .patch('/users/me/settings')
      .set('x-auth-user-id', 'auth-user-1')
      .send({ language: 'en' })
      .expect(200)
      .expect({ language: 'en' });

    expect(updateSettingsExecute).toHaveBeenCalledWith({
      authUserId: 'auth-user-1',
      language: 'en',
    });
  });

  it('rejects an unsupported language with validation details', async () => {
    await request(app.getHttpServer())
      .patch('/users/me/settings')
      .set('x-auth-user-id', 'auth-user-1')
      .send({ language: 'fr' })
      .expect(400)
      .expect((response) => {
        const body = response.body as {
          message: string;
          details: Array<{ field: string }>;
        };

        expect(body.message).toBe('Validation failed');
        expect(body.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'language' }),
          ]),
        );
      });

    expect(updateSettingsExecute).not.toHaveBeenCalled();
  });

  it('rejects settings update without an active session', async () => {
    await request(app.getHttpServer())
      .patch('/users/me/settings')
      .send({ language: 'en' })
      .expect(401)
      .expect({
        statusCode: 401,
        message: 'Invalid session',
        error: 'Unauthorized',
      });

    expect(updateSettingsExecute).not.toHaveBeenCalled();
  });

  it('preserves the health endpoint', async () => {
    await request(app.getHttpServer())
      .get('/users/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
