'use client';

import type { CalendarEventDto } from '@sticky-notes/contracts';
import { FormEvent, useMemo, useState } from 'react';
import { eventsApi } from '@/lib/api';

interface CalendarPanelProps {
  events: CalendarEventDto[];
  online: boolean;
  onChanged: () => Promise<void>;
}

function localInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function CalendarPanel({ events, online, onChanged }: CalendarPanelProps) {
  const initialStart = useMemo(() => {
    const date = new Date();
    date.setMinutes(0, 0, 0);
    date.setHours(date.getHours() + 1);
    return localInput(date);
  }, []);
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState(initialStart);
  const [endsAt, setEndsAt] = useState(localInput(new Date(new Date(initialStart).getTime() + 60 * 60 * 1000)));
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');

  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await eventsApi.create({
        id: crypto.randomUUID(),
        title: title.trim(),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: location.trim() || null,
      });
      setTitle('');
      setLocation('');
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法创建日程');
    }
  }

  async function remove(event: CalendarEventDto) {
    try {
      await eventsApi.remove(event.id);
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法删除日程');
    }
  }

  const grouped = events.reduce<Record<string, CalendarEventDto[]>>((result, item) => {
    const key = new Date(item.startsAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    (result[key] ??= []).push(item);
    return result;
  }, {});

  return (
    <main className="module-page calendar-page">
      <header className="module-header">
        <div><p className="eyebrow">TIME MAP</p><h1>日程</h1><p>让计划落在明确的时间里。</p></div>
        <span className="module-count">{events.length} 项日程</span>
      </header>
      <form className="event-create" onSubmit={create}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="日程标题" required disabled={!online} />
        <label><span>开始</span><input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required disabled={!online} /></label>
        <label><span>结束</span><input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required disabled={!online} /></label>
        <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="地点（可选）" disabled={!online} />
        <button className="primary-button" type="submit" disabled={!online || !title.trim()}>创建日程</button>
      </form>
      {!online && <p className="inline-notice">日程操作需要联网；便签仍可离线编辑。</p>}
      {error && <p className="form-error">{error}</p>}
      <div className="agenda">
        {Object.keys(grouped).length === 0 && <div className="module-empty">近期没有日程</div>}
        {Object.entries(grouped).map(([date, dateEvents]) => (
          <section className="agenda-day" key={date}>
            <h2>{date}</h2>
            <div>
              {dateEvents.map((item) => (
                <article className="event-card" key={item.id}>
                  <time>{new Date(item.startsAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}<span>—</span>{new Date(item.endsAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time>
                  <div><h3>{item.title}</h3><p>{item.location || '未设置地点'}</p></div>
                  <button type="button" onClick={() => void remove(item)} disabled={!online}>删除</button>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
