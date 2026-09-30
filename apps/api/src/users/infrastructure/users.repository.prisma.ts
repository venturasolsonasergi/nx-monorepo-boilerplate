import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UserEntity } from '../domain/user.entity';
import {
  EmailAlreadyExistsError,
  type UserRepository,
} from '../application/user.repository';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class UsersPrismaRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<UserEntity | null> {
    const record = await this.prisma.userRecord.findUnique({ where: { id } });
    return record ? new UserEntity(record) : null;
  }

  async save(entity: UserEntity): Promise<UserEntity> {
    try {
      const record = await this.prisma.userRecord.create({
        data: {
          name: entity.props.name,
          surname: entity.props.surname,
          email: entity.props.email,
          address: entity.props.address,
          phone: entity.props.phone,
        },
      });
      return new UserEntity(record);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new EmailAlreadyExistsError();
      }

      throw error;
    }
  }
}
