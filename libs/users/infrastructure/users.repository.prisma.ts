import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from './prisma/generated/client';
import {
  ProfileEntity,
  type ProfileEntityProps,
} from '../domain/profile.entity';
import {
  ProfileAlreadyExistsError,
  type ProfileRepository,
} from '../application/profile.repository';
import { PrismaService } from './prisma/prisma.service';

interface UserProfileRow {
  id: number;
  auth_user_id: string;
  name: string;
  surname: string;
  address: string;
  phone: string;
}

function toProfileEntity(row: UserProfileRow): ProfileEntity {
  const props: ProfileEntityProps = {
    id: row.id,
    authUserId: row.auth_user_id,
    name: row.name,
    surname: row.surname,
    address: row.address,
    phone: row.phone,
  };

  return new ProfileEntity(props);
}

@Injectable()
export class UsersPrismaRepository implements ProfileRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<ProfileEntity | null> {
    const record = await this.prisma.userProfile.findUnique({ where: { id } });
    return record ? toProfileEntity(record) : null;
  }

  async save(entity: ProfileEntity): Promise<ProfileEntity> {
    try {
      const record = await this.prisma.userProfile.create({
        data: {
          auth_user_id: entity.props.authUserId,
          name: entity.props.name,
          surname: entity.props.surname,
          address: entity.props.address,
          phone: entity.props.phone,
        },
      });
      return toProfileEntity(record);
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
