import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { RoomService } from './services/room.service';
import { MessageService } from './services/message.service';
import { PresenceService } from './services/presence.service';
import { ChatGateway } from './chat.gateway';
import { MessageProcessor } from './queue/message.processor';
import { MessageEvents } from './queue/message.events';
import { RoomEventsService } from './events/room-events.service';
import { Room } from '../entities/room.entity';
import { RoomMember } from '../entities/room-member.entity';
import { Message } from '../entities/message.entity';
import { MessageRead } from '../entities/message-read.entity';
import { MESSAGE_QUEUE } from '../queue/queue.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomMember, Message, MessageRead]),
    BullModule.registerQueue({
      name: MESSAGE_QUEUE,
    }),
    AuthModule,
    NotificationModule,
    WebsocketModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    RoomService,
    MessageService,
    PresenceService,
    ChatGateway,
    MessageProcessor,
    MessageEvents,
    RoomEventsService,
  ],
  exports: [ChatService, ChatGateway, RoomEventsService],
})
export class ChatModule {}
