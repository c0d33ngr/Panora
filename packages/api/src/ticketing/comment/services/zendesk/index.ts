import { Injectable } from '@nestjs/common';
import { LoggerService } from '@@core/logger/logger.service';
import { PrismaService } from '@@core/prisma/prisma.service';
import { EncryptionService } from '@@core/encryption/encryption.service';
import { ApiResponse } from '@@core/utils/types';
import { DesunifyReturnType } from '@@core/utils/types/desunify.input';
import axios from 'axios';
import { ActionType, handleServiceError } from '@@core/utils/errors';
import { ICommentService } from '@ticketing/comment/types';
import { TicketingObject } from '@ticketing/@utils/@types';
import { OriginalCommentOutput } from '@@core/utils/types/original/original.ticketing';
import { ServiceRegistry } from '../registry.service';
import { ZendeskCommentOutput } from './types';
import { EnvironmentService } from '@@core/environment/environment.service';
@Injectable()
export class ZendeskService implements ICommentService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
    private env: EnvironmentService,
    private cryptoService: EncryptionService,
    private registry: ServiceRegistry,
  ) {
    this.logger.setContext(
      TicketingObject.comment.toUpperCase() + ':' + ZendeskService.name,
    );
    this.registry.registerService('zendesk_t', this);
  }
  async addComment(
    commentData: DesunifyReturnType,
    linkedUserId: string,
    remoteIdTicket: string,
  ): Promise<ApiResponse<ZendeskCommentOutput>> {
    try {
      const connection = await this.prisma.connections.findFirst({
        where: {
          id_linked_user: linkedUserId,
          provider_slug: 'zendesk_t',
        },
      });
      const dataBody = {
        ticket: {
          comment: commentData,
        },
      };
      //to add a comment on Zendesk you must update a ticket using the Ticket API
      const resp = await axios.put(
        `https://${this.env.getZendeskTicketingSubdomain()}.zendesk.com/api/v2/tickets/${remoteIdTicket}.json`,
        JSON.stringify(dataBody),
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.cryptoService.decrypt(
              connection.access_token,
            )}`,
          },
        },
      );
      return {
        data: resp.data,
        message: 'Zendesk comment created',
        statusCode: 201,
      };
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'Zendesk',
        TicketingObject.comment,
        ActionType.POST,
      );
    }
  }
  async syncComments(
    linkedUserId: string,
    id_ticket: string,
  ): Promise<ApiResponse<OriginalCommentOutput[]>> {
    try {
      const connection = await this.prisma.connections.findFirst({
        where: {
          id_linked_user: linkedUserId,
          provider_slug: 'zendesk_t',
        },
      });
      //retrieve ticket remote id so we can retrieve the comments in the original software
      const ticket = await this.prisma.tcg_tickets.findUnique({
        where: {
          id_tcg_ticket: id_ticket,
        },
        select: {
          remote_id: true,
        },
      });

      const resp = await axios.get(
        `https://${this.env.getZendeskTicketingSubdomain()}.zendesk.com/api/v2/tickets/${
          ticket.remote_id
        }/comments.json`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.cryptoService.decrypt(
              connection.access_token,
            )}`,
          },
        },
      );
      this.logger.log(`Synced zendesk comments !`);

      return {
        data: resp.data.comments,
        message: 'Zendesk comments retrieved',
        statusCode: 200,
      };
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'Zendesk',
        TicketingObject.comment,
        ActionType.GET,
      );
    }
  }
}
