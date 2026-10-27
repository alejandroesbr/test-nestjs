import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { jest } from '@jest/globals';
import { Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import { Role } from '../../common/constants/roles.enum.js';
import {
  IS_PUBLIC_KEY,
  Public,
} from '../../common/decorators/public.decorator.js';
import {
  ROLES_KEY,
  Roles,
} from '../../common/decorators/roles.decorator.js';
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AuthService } from './auth.service.js';
import { UserEntity } from './entities/user.entity.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

describe('Phase 3: Security, Decorators, Guards, and AuthModule', () => {
  describe('Custom Decorators (@Public & @Roles)', () => {
    it('sets metadata IS_PUBLIC_KEY = true on @Public() and ROLES_KEY on @Roles()', () => {
      class TestController {
        @Public()
        publicEndpoint() {}

        @Roles(Role.ADMIN, Role.TECHNICIAN)
        protectedEndpoint() {}
      }

      const reflector = new Reflector();
      expect(
        reflector.get<boolean>(
          IS_PUBLIC_KEY,
          TestController.prototype.publicEndpoint,
        ),
      ).toBe(true);
      expect(
        reflector.get<Role[]>(
          ROLES_KEY,
          TestController.prototype.protectedEndpoint,
        ),
      ).toEqual([Role.ADMIN, Role.TECHNICIAN]);
    });
  });

  describe('Guards (JwtAuthGuard, RolesGuard, ApiKeyGuard)', () => {
    it('JwtAuthGuard bypasses JWT check when route is marked @Public()', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(true),
      } as unknown as Reflector;
      const guard = new JwtAuthGuard(reflector);
      const context = {
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(context)).toBe(true);
    });

    it('RolesGuard allows when no roles are required or when user has matching role, and throws ForbiddenException otherwise', () => {
      const getAllAndOverride = jest.fn();
      const reflector = { getAllAndOverride } as unknown as Reflector;
      const guard = new RolesGuard(reflector);

      const createCtx = (user?: { role: Role }): ExecutionContext =>
        ({
          getHandler: () => ({}),
          getClass: () => ({}),
          switchToHttp: () => ({
            getRequest: () => ({ user }),
          }),
        }) as unknown as ExecutionContext;

      getAllAndOverride.mockReturnValueOnce(undefined);
      expect(guard.canActivate(createCtx())).toBe(true);

      getAllAndOverride.mockReturnValueOnce([Role.ADMIN]);
      expect(guard.canActivate(createCtx({ role: Role.ADMIN }))).toBe(true);

      getAllAndOverride.mockReturnValueOnce([Role.ADMIN]);
      expect(() =>
        guard.canActivate(createCtx({ role: Role.TECHNICIAN })),
      ).toThrow(ForbiddenException);
    });

    it('ApiKeyGuard validates x-api-key header against comma-separated API_KEYS in ConfigService', () => {
      const configService = {
        get: jest.fn().mockReturnValue('demo-key-partner-1, demo-key-partner-2'),
      } as unknown as ConfigService;
      const guard = new ApiKeyGuard(configService);

      const createCtx = (apiKey?: string): ExecutionContext =>
        ({
          switchToHttp: () => ({
            getRequest: () => ({
              headers: apiKey ? { 'x-api-key': apiKey } : {},
            }),
          }),
        }) as unknown as ExecutionContext;

      expect(guard.canActivate(createCtx('demo-key-partner-2'))).toBe(true);
      expect(() => guard.canActivate(createCtx('invalid-key'))).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.canActivate(createCtx())).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('JwtStrategy', () => {
    it('maps decoded JWT payload to stateless user object { id, email, role }', () => {
      const configService = {
        get: jest.fn().mockReturnValue('test-secret'),
      } as unknown as ConfigService;
      const strategy = new JwtStrategy(configService);

      const result = strategy.validate({
        sub: 42,
        email: 'admin@fleetcore.com',
        role: Role.ADMIN,
      });

      expect(result).toEqual({
        id: 42,
        email: 'admin@fleetcore.com',
        role: Role.ADMIN,
      });
    });
  });

  describe('AuthService (register & login with bcrypt and JWT)', () => {
    let authService: AuthService;
    let findOneMock: ReturnType<typeof jest.fn>;
    let createMock: ReturnType<typeof jest.fn>;
    let saveMock: ReturnType<typeof jest.fn>;
    let signMock: ReturnType<typeof jest.fn>;

    beforeEach(() => {
      findOneMock = jest.fn();
      createMock = jest.fn((dto: Partial<UserEntity>) => ({
        id: 1,
        ...dto,
      }));
      saveMock = jest.fn(async (entity: Partial<UserEntity>) => ({
        id: 1,
        email: entity.email ?? '',
        role: entity.role ?? Role.TECHNICIAN,
        password: entity.password ?? '',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      signMock = jest.fn().mockReturnValue('signed-jwt-token');

      authService = new AuthService(
        {
          findOne: findOneMock,
          create: createMock,
          save: saveMock,
        } as unknown as Repository<UserEntity>,
        {
          sign: signMock,
        } as unknown as JwtService,
      );
    });

    it('registers a new user hashing password with bcrypt and stripping password from response', async () => {
      findOneMock.mockResolvedValueOnce(null);

      const result = await authService.register({
        email: 'tech@fleetcore.com',
        password: 'password123',
        role: Role.TECHNICIAN,
      });

      expect(saveMock).toHaveBeenCalled();
      const savedArg = saveMock.mock.calls[0][0] as UserEntity;
      expect(savedArg.password).not.toBe('password123');
      expect(await bcrypt.compare('password123', savedArg.password)).toBe(true);
      expect(result).toEqual(
        expect.objectContaining({
          id: 1,
          email: 'tech@fleetcore.com',
          role: Role.TECHNICIAN,
        }),
      );
      expect((result as Record<string, unknown>).password).toBeUndefined();
    });

    it('throws ConflictException when registering an existing email', async () => {
      findOneMock.mockResolvedValueOnce({
        id: 1,
        email: 'tech@fleetcore.com',
      } as UserEntity);

      await expect(
        authService.register({
          email: 'tech@fleetcore.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('authenticates valid credentials on login and returns accessToken + user metadata', async () => {
      const hashedPassword = await bcrypt.hash('secret123', 10);
      findOneMock.mockResolvedValueOnce({
        id: 7,
        email: 'admin@fleetcore.com',
        password: hashedPassword,
        role: Role.ADMIN,
      } as UserEntity);

      const result = await authService.login({
        email: 'admin@fleetcore.com',
        password: 'secret123',
      });

      expect(signMock).toHaveBeenCalledWith({
        sub: 7,
        email: 'admin@fleetcore.com',
        role: Role.ADMIN,
      });
      expect(result).toEqual({
        accessToken: 'signed-jwt-token',
        user: {
          id: 7,
          email: 'admin@fleetcore.com',
          role: Role.ADMIN,
        },
      });
    });

    it('throws UnauthorizedException on invalid email or wrong password', async () => {
      findOneMock.mockResolvedValueOnce(null);
      await expect(
        authService.login({
          email: 'unknown@fleetcore.com',
          password: 'secret123',
        }),
      ).rejects.toThrow(UnauthorizedException);

      const hashedPassword = await bcrypt.hash('secret123', 10);
      findOneMock.mockResolvedValueOnce({
        id: 7,
        email: 'admin@fleetcore.com',
        password: hashedPassword,
        role: Role.ADMIN,
      } as UserEntity);

      await expect(
        authService.login({
          email: 'admin@fleetcore.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
