import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import request from 'supertest';
import { CreateProfileUseCase } from '../application/create-profile.use-case';
import { ProfileAlreadyExistsError } from '../application/profile.repository';
import { UsersController } from '../infrastructure/users.controller';

describe('users contract', () => {
  let app: INestApplication;
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

  beforeEach(async () => {
    execute.mockReset();
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: CreateProfileUseCase, useValue: { execute } }],
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

  it('preserves the health endpoint', async () => {
    await request(app.getHttpServer())
      .get('/users/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
