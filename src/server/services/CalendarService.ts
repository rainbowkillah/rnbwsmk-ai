/**
 * CalendarService
 * Manages calendar events and scheduling
 * Phase 7: Advanced Features
 */

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  location?: string;
  attendees?: string[];
  createdByAI: boolean;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface CreateEventInput {
  userId: string;
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  location?: string;
  attendees?: string[];
  createdByAI?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  startTime?: number;
  endTime?: number;
  location?: string;
  attendees?: string[];
  metadata?: Record<string, any>;
}

export interface EventQuery {
  userId: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
  createdByAI?: boolean;
}

export class CalendarService {
  private sql: SqlStorage;

  constructor(sql: SqlStorage) {
    this.sql = sql;
    this.initializeSchema();
  }

  /**
   * Initialize database schema for calendar events
   */
  private initializeSchema(): void {
    // Create calendar_events table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        location TEXT,
        attendees TEXT,
        created_by_ai INTEGER DEFAULT 0,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Create indexes for efficient queries
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_user_time
      ON calendar_events(user_id, start_time DESC)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_time_range
      ON calendar_events(start_time, end_time)
    `);
  }

  /**
   * Create a new calendar event
   */
  async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    const now = Date.now();
    const event: CalendarEvent = {
      id: `event-${now}-${Math.random().toString(36).substring(2, 9)}`,
      userId: input.userId,
      title: input.title,
      description: input.description,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location,
      attendees: input.attendees,
      createdByAI: input.createdByAI || false,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now
    };

    // Validate event times
    if (event.startTime >= event.endTime) {
      throw new Error('Event start time must be before end time');
    }

    if (event.startTime < Date.now()) {
      throw new Error('Event start time cannot be in the past');
    }

    // Insert into database
    const stmt = this.sql.prepare(`
      INSERT INTO calendar_events (
        id, user_id, title, description, start_time, end_time,
        location, attendees, created_by_ai, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.bind(
      event.id,
      event.userId,
      event.title,
      event.description || null,
      event.startTime,
      event.endTime,
      event.location || null,
      event.attendees ? JSON.stringify(event.attendees) : null,
      event.createdByAI ? 1 : 0,
      event.metadata ? JSON.stringify(event.metadata) : null,
      event.createdAt,
      event.updatedAt
    );

    stmt.run();

    return event;
  }

  /**
   * Get event by ID
   */
  async getEvent(eventId: string, userId: string): Promise<CalendarEvent | null> {
    const stmt = this.sql.prepare(`
      SELECT * FROM calendar_events
      WHERE id = ? AND user_id = ?
    `);

    const row = stmt.bind(eventId, userId).first();
    if (!row) return null;

    return this.rowToEvent(row);
  }

  /**
   * Get events for a user within a date range
   */
  async getEvents(query: EventQuery): Promise<CalendarEvent[]> {
    let sql = `
      SELECT * FROM calendar_events
      WHERE user_id = ?
    `;
    const params: any[] = [query.userId];

    if (query.startDate !== undefined) {
      sql += ` AND start_time >= ?`;
      params.push(query.startDate);
    }

    if (query.endDate !== undefined) {
      sql += ` AND start_time <= ?`;
      params.push(query.endDate);
    }

    if (query.createdByAI !== undefined) {
      sql += ` AND created_by_ai = ?`;
      params.push(query.createdByAI ? 1 : 0);
    }

    sql += ` ORDER BY start_time ASC`;

    if (query.limit) {
      sql += ` LIMIT ?`;
      params.push(query.limit);
    }

    const stmt = this.sql.prepare(sql);
    const rows = stmt.bind(...params).all();

    return rows.results.map(row => this.rowToEvent(row));
  }

  /**
   * Get upcoming events for a user
   */
  async getUpcomingEvents(userId: string, limit: number = 10): Promise<CalendarEvent[]> {
    const now = Date.now();

    const stmt = this.sql.prepare(`
      SELECT * FROM calendar_events
      WHERE user_id = ? AND start_time >= ?
      ORDER BY start_time ASC
      LIMIT ?
    `);

    const rows = stmt.bind(userId, now, limit).all();
    return rows.results.map(row => this.rowToEvent(row));
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    eventId: string,
    userId: string,
    input: UpdateEventInput
  ): Promise<CalendarEvent | null> {
    // First check if event exists and belongs to user
    const existing = await this.getEvent(eventId, userId);
    if (!existing) {
      return null;
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      params.push(input.title);
    }

    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(input.description);
    }

    if (input.startTime !== undefined) {
      updates.push('start_time = ?');
      params.push(input.startTime);
    }

    if (input.endTime !== undefined) {
      updates.push('end_time = ?');
      params.push(input.endTime);
    }

    if (input.location !== undefined) {
      updates.push('location = ?');
      params.push(input.location);
    }

    if (input.attendees !== undefined) {
      updates.push('attendees = ?');
      params.push(JSON.stringify(input.attendees));
    }

    if (input.metadata !== undefined) {
      updates.push('metadata = ?');
      params.push(JSON.stringify(input.metadata));
    }

    if (updates.length === 0) {
      return existing; // No changes
    }

    updates.push('updated_at = ?');
    params.push(Date.now());

    params.push(eventId, userId);

    const sql = `
      UPDATE calendar_events
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `;

    const stmt = this.sql.prepare(sql);
    stmt.bind(...params).run();

    return this.getEvent(eventId, userId);
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string, userId: string): Promise<boolean> {
    const stmt = this.sql.prepare(`
      DELETE FROM calendar_events
      WHERE id = ? AND user_id = ?
    `);

    const result = stmt.bind(eventId, userId).run();
    return result.changes > 0;
  }

  /**
   * Check for conflicting events
   */
  async hasConflict(
    userId: string,
    startTime: number,
    endTime: number,
    excludeEventId?: string
  ): Promise<boolean> {
    let sql = `
      SELECT COUNT(*) as count FROM calendar_events
      WHERE user_id = ?
      AND (
        (start_time < ? AND end_time > ?)
        OR (start_time >= ? AND start_time < ?)
        OR (end_time > ? AND end_time <= ?)
      )
    `;
    const params: any[] = [
      userId,
      endTime, startTime,
      startTime, endTime,
      startTime, endTime
    ];

    if (excludeEventId) {
      sql += ` AND id != ?`;
      params.push(excludeEventId);
    }

    const stmt = this.sql.prepare(sql);
    const result = stmt.bind(...params).first();

    return (result?.count as number) > 0;
  }

  /**
   * Get statistics for user's calendar
   */
  async getStats(userId: string): Promise<{
    total: number;
    upcoming: number;
    createdByAI: number;
  }> {
    const now = Date.now();

    const totalStmt = this.sql.prepare(`
      SELECT COUNT(*) as count FROM calendar_events WHERE user_id = ?
    `);
    const total = (totalStmt.bind(userId).first()?.count as number) || 0;

    const upcomingStmt = this.sql.prepare(`
      SELECT COUNT(*) as count FROM calendar_events
      WHERE user_id = ? AND start_time >= ?
    `);
    const upcoming = (upcomingStmt.bind(userId, now).first()?.count as number) || 0;

    const aiStmt = this.sql.prepare(`
      SELECT COUNT(*) as count FROM calendar_events
      WHERE user_id = ? AND created_by_ai = 1
    `);
    const createdByAI = (aiStmt.bind(userId).first()?.count as number) || 0;

    return { total, upcoming, createdByAI };
  }

  /**
   * Convert database row to CalendarEvent
   */
  private rowToEvent(row: any): CalendarEvent {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      startTime: row.start_time,
      endTime: row.end_time,
      location: row.location,
      attendees: row.attendees ? JSON.parse(row.attendees) : undefined,
      createdByAI: row.created_by_ai === 1,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
