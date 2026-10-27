import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module.js';
import { VehiclesModule } from './modules/vehicles/vehicles.module.js';
import { MechanicsModule } from './modules/mechanics/mechanics.module.js';
import { WorkshopsModule } from './modules/workshops/workshops.module.js';
import { MaintenancesModule } from './modules/maintenances/maintenances.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<string>('DB_PORT', '5432')),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'fleetcore'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    AuthModule,
    VehiclesModule,
    MechanicsModule,
    WorkshopsModule,
    MaintenancesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
