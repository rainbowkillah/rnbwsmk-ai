/**
 * UserSession Durable Object
 * Manages user sessions, calendar events, and rate limiting
 * Phase 7: Calendar integration
 * Phase 8: Rate limiting
 */

import { Server } from 'partyserver';
import { CalendarService, type CalendarEvent, type CreateEventInput, type UpdateEventInput, type EventQuery } from '../services/CalendarService';
import { RateLimitService } from '../services/RateLimitService';

type WSMessage =
  | { type: 'calendar.create'; event: CreateEventInput }
  | { type: 'calendar.get'; eventId: string }
  | { type: 'calendar.list'; query: EventQuery }
  | { type: 'calendar.upcoming'; limit?: number }
  | { type: 'calendar.update'; eventId: string; updates: UpdateEventInput }
  | { type: 'calendar.delete'; eventId: string }
  | { type: 'calendar.stats' };

export class UserSession extends Server<Env> {
  private calendarService: CalendarService | null = null;
  private rateLimiter: RateLimitService | null = null;

  static options = {
    hibernate: true
  };

  async onStart() {
    // Initialize CalendarService with SQL storage
    this.calendarService = new CalendarService(this.ctx.storage.sql);
    this.rateLimiter = new RateLimitService(this.ctx.storage);
    console.log('UserSession started with CalendarService');
  }

  async onMessage(message: string) {
    try {
      const data: WSMessage = JSON.parse(message);

      if (!this.calendarService) {
        this.broadcast(JSON.stringify({ type: 'error', error: 'Calendar service not initialized' }));
        return;
      }

      const userId = 'default'; // In production, get from authenticated session

      if (!this.rateLimiter) {
        this.rateLimiter = new RateLimitService(this.ctx.storage);
      }

      if (this.rateLimiter) {
        const result = await this.rateLimiter.consume(`calendar:${userId}`, {
          limit: 60,
          windowMs: 60_000,
          blockDurationMs: 10_000
        });

        if (!result.allowed) {
          this.broadcast(JSON.stringify({
            type: 'error',
            error: `Too many calendar actions. Try again in ${result.retryAfter ?? 5}s.`
          }));
          return;
        }
      }

      switch (data.type) {
        case 'calendar.create':
          const created = await this.calendarService.createEvent({
            ...data.event,
            userId
          });
          this.broadcast(JSON.stringify({ type: 'calendar.created', event: created }));
          break;

        case 'calendar.get':
          const event = await this.calendarService.getEvent(data.eventId, userId);
          this.broadcast(JSON.stringify({ type: 'calendar.event', event }));
          break;

        case 'calendar.list':
          const events = await this.calendarService.getEvents({
            ...data.query,
            userId
          });
          this.broadcast(JSON.stringify({ type: 'calendar.events', events }));
          break;

        case 'calendar.upcoming':
          const upcoming = await this.calendarService.getUpcomingEvents(userId, data.limit);
          this.broadcast(JSON.stringify({ type: 'calendar.upcoming', events: upcoming }));
          break;

        case 'calendar.update':
          const updated = await this.calendarService.updateEvent(data.eventId, userId, data.updates);
          this.broadcast(JSON.stringify({ type: 'calendar.updated', event: updated }));
          break;

        case 'calendar.delete':
          const deleted = await this.calendarService.deleteEvent(data.eventId, userId);
          this.broadcast(JSON.stringify({ type: 'calendar.deleted', success: deleted }));
          break;

        case 'calendar.stats':
          const stats = await this.calendarService.getStats(userId);
          this.broadcast(JSON.stringify({ type: 'calendar.stats', stats }));
          break;

        default:
          this.broadcast(JSON.stringify({ type: 'error', error: 'Unknown message type' }));
      }
    } catch (error) {
      console.error('UserSession message error:', error);
      this.broadcast(JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }
}
