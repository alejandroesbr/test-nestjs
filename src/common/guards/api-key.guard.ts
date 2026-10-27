import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const headerValue = request.headers['x-api-key'];
    const apiKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!apiKey) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    const rawApiKeys = this.configService.get<string>('API_KEYS', '');
    const allowedKeys = rawApiKeys
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);

    if (!allowedKeys.includes(apiKey)) {
      throw new UnauthorizedException('Invalid x-api-key header');
    }

    return true;
  }
}
