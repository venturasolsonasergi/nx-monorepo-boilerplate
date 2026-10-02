import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from './prisma/generated/client';
import { ProfileEntity } from '../domain/profile.entity';
import {
  ProfileAlreadyExistsError,
  type ProfileRepository,
} from '../application/profile.repository';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class UsersPrismaRepository implements ProfileRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<ProfileEntity | null> {
    const record = await this.prisma.userRecord.findUnique({ where: { id } });
    return record ? new ProfileEntity(record) : null;
  }

  async save(entity: ProfileEntity): Promise<ProfileEntity> {
    try {
      const record = await this.prisma.userRecord.create({
        data: {
          authUserId: entity.props.authUserId,
          name: entity.props.name,
          surname: entity.props.surname,
          address: entity.props.address,
          phone: entity.props.phone,
        },
      });
      return new ProfileEntity(record);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if ((error as { code?: string }).code === 'P2002') {
          throw new ProfileAlreadyExistsError();
        }
      }

      throw error;
    }
  }
}
