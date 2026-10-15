import {
  Column,
  DataType,
  Default,
  DefaultScope,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import type { Optional } from 'sequelize';

export interface UserAttributes {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
}

@Table({ tableName: 'users', timestamps: true, underscored: true })
@DefaultScope(() => ({ attributes: { exclude: ['passwordHash'] } }))
export class User
  extends Model<UserAttributes, Optional<UserAttributes, 'id'>>
  implements UserAttributes
{
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare name: string;

  @Unique
  @Column({ type: DataType.STRING(254), allowNull: false })
  declare email: string;

  @Column({ type: DataType.STRING(60), allowNull: false })
  declare passwordHash: string;
}
