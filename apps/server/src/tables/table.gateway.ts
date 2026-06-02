import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TablesService } from './tables.service';

export const tableRoomId = (tableId: string) => `table:${tableId}`;

function devUserIdFromSocket(client: Socket): string {
  const auth = client.handshake.auth as { userId?: string } | undefined;
  const q = client.handshake.query.userId;
  const fromAuth =
    typeof auth?.userId === 'string' ? auth.userId.trim() : '';
  const fromQ =
    typeof q === 'string'
      ? q.trim()
      : Array.isArray(q)
        ? (q[0] as string | undefined)?.trim() ?? ''
        : '';
  const v = fromAuth || fromQ;
  return v.length > 0 ? v : 'local-player';
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? [
      'http://localhost:3000',
      'https://web.telegram.org',
    ],
    credentials: true,
  },
})
export class TableGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TableGateway.name);

  constructor(
    @Inject(forwardRef(() => TablesService))
    private readonly tablesService: TablesService,
  ) {}

  handleConnection(client: Socket) {
    const uid = devUserIdFromSocket(client);
    (client.data as { devUserId: string }).devUserId = uid;
    this.logger.debug(`socket ${client.id} user ${uid}`);
  }

  /** Join Socket.IO room and receive current public table snapshot. */
  @SubscribeMessage('joinTable')
  async joinTable(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId?: string },
  ) {
    const tableId = body?.tableId?.trim();
    if (!tableId) return { ok: false, error: 'tableId required' };
    const userId = devUserIdFromSocket(client);
    try {
      await this.tablesService.assertCanWatchTable(tableId, userId);
    } catch (e: unknown) {
      const msg =
        e instanceof ForbiddenException
          ? e.message
          : e instanceof NotFoundException
            ? e.message
            : 'Not allowed to watch this table';
      return { ok: false, error: msg };
    }
    await client.join(tableRoomId(tableId));
    const snap = await this.tablesService.getBroadcastPayload(tableId);
    if (snap) client.emit('tableState', snap);
    const holes = await this.tablesService.getViewerHoleCardsForUser(tableId, userId);
    if (holes) client.emit('yourHoleCards', { cards: holes });
    return { ok: true };
  }

  @SubscribeMessage('leaveTable')
  async leaveTable(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId?: string },
  ) {
    const tableId = body?.tableId?.trim();
    if (tableId) await client.leave(tableRoomId(tableId));
    return { ok: true };
  }

  @SubscribeMessage('gameAction')
  async gameAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId?: string; action?: unknown },
  ) {
    const tableId = body?.tableId?.trim();
    if (!tableId) return { ok: false, error: 'tableId required' };
    const userId = devUserIdFromSocket(client);
    try {
      await this.tablesService.applyHoldemGameAction(tableId, userId, body?.action);
      return { ok: true };
    } catch (e: unknown) {
      const msg =
        e instanceof ForbiddenException
          ? e.message
          : e instanceof NotFoundException
            ? e.message
            : e instanceof BadRequestException
              ? e.message
              : 'Action rejected';
      return { ok: false, error: msg };
    }
  }

  @SubscribeMessage('tableAction')
  async tableAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tableId?: string; action?: string },
  ) {
    const tableId = body?.tableId?.trim();
    const raw = body?.action?.toLowerCase()?.trim();
    if (!tableId) return { ok: false, error: 'tableId required' };
    if (raw !== 'check' && raw !== 'fold') {
      return { ok: false, error: 'action must be check or fold' };
    }
    const userId = devUserIdFromSocket(client);
    try {
      await this.tablesService.applySocketTableAction(
        tableId,
        userId,
        raw as 'check' | 'fold',
      );
      return { ok: true };
    } catch (e: unknown) {
      const msg =
        e instanceof ForbiddenException
          ? e.message
          : e instanceof NotFoundException
            ? e.message
            : e instanceof BadRequestException
              ? e.message
              : 'Action rejected';
      return { ok: false, error: msg };
    }
  }

  async broadcastState(tableId: string): Promise<void> {
    const snap = await this.tablesService.getBroadcastPayload(tableId);
    if (snap) {
      this.server.to(tableRoomId(tableId)).emit('tableState', snap);
    }
  }

  emitTableClosed(tableId: string): void {
    this.server.to(tableRoomId(tableId)).emit('tableClosed', { tableId });
  }
}
