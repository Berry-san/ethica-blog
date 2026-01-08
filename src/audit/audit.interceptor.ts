import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only log state-changing methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle().pipe(
        tap(() => {
          const user = request.user;
          
          // Only log if user is authenticated
          if (user && user.id) {
            const resourceId = request.params?.id || request.body?.id;
            
            console.log('📝 Audit Log:', {
              userId: user.id,
              action: method,
              resource: request.url,
            });
            
            this.auditService.log({
              userId: user.id,
              action: method,
              resource: request.url,
              resourceId: resourceId,
              details: {
                body: request.body,
                params: request.params,
                query: request.query,
              },
              ip: request.ip,
              userAgent: request.get('user-agent'),
            }).catch(err => {
              // Log error but don't fail the request
              console.error('❌ Audit logging failed:', err);
            });
          } else {
            console.log('⚠️ Skipping audit log - no authenticated user');
          }
        }),
      );
    }

    return next.handle();
  }
}
