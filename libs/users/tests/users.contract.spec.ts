import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CreateUserUseCase } from '../application/create-user.use-case';
import { EmailAlreadyExistsError } from '../application/user.repository';
import { UsersController } from '../infrastructure/users.controller';

describe('users contract', () => {
  let app: INestApplication;
  const execute = jest.fn();

  beforeEach(async () => {
    execute.mockReset();
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: CreateUserUseCase, useValue: { execute } }],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a user with the persisted id', async () => {
    const user = {
      id: 1,
      name: ' Ada ',
      surname: ' Lovelace ',
      email: 'ada@example.com',
      address: ' 1 Main Street ',
      phone: '555-0100',
    };
    execute.mockResolvedValue({
      ...user,
      name: 'Ada',
      surname: 'Lovelace',
      address: '1 Main Street',
    });

    await request(app.getHttpServer())
      .post('/users')
      .send({
        name: user.name,
        surname: user.surname,
        email: user.email,
        address: user.address,
        phone: user.phone,
      })
      .expect(201)
      .expect({
        ...user,
        name: 'Ada',
        surname: 'Lovelace',
        address: '1 Main Street',
      });
  });

  it('returns descriptive details for missing fields', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Sergi', surname: 'Ventura Solsona' })
      .expect(400)
      .expect({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: [
          { field: 'email', code: 'required', message: 'email is required' },
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

  it('rejects invalid and unknown fields with details', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({
        name: '',
        surname: 'Lovelace',
        email: 'invalid',
        address: 'Street',
        phone: '555',
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
              code: 'invalid_format',
              message: 'email has an invalid format',
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

  it('maps duplicate email errors to conflict', async () => {
    execute.mockRejectedValue(new EmailAlreadyExistsError());

    await request(app.getHttpServer())
      .post('/users')
      .send({
        name: 'Ada',
        surname: 'Lovelace',
        email: 'ada@example.com',
        address: 'Street',
        phone: '555',
      })
      .expect(409)
      .expect({
        statusCode: 409,
        message: 'Email already exists',
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
