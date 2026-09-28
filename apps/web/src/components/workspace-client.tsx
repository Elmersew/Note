'use client';

import type { CalendarEventDto, ChangeDto, NoteDto, SessionUser, TagDto, TaskDto } from '@sticky-notes/contracts';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { authApi, eventsApi, notesApi, syncApi, tasksApi } from '@/lib/api';
import { cacheServerNotes, clearAccountCache, getCachedNotes, getSyncCursor, setSyncCursor } from '@/lib/offline-db';
import { createLocalNote, flushNoteOutbox, queueNoteDelete, queueNoteUpsert } from '@/lib/note-sync';
import { CalendarPanel } from './calendar-panel';
import { NoteEditor } from './note-editor';
import { NoteList } from './note-list';
import { TasksPanel } from './tasks-panel';

type Section = 'notes' | 'archive' | 'trash' | 'tasks' | 'calendar';
type LocalNote = NoteDto & { pending?: boolean };

const websocketUrl = process.env.NEXT_PUBLIC_WS_URL || undefined;

export function WorkspaceClient() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [tags, setTags] = useState<TagDto[]>([]);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [events, setEvents] = useState<CalendarEventDto[]>([]);
  const [section, setSection] = useState<Section>('notes');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [searchResults, setSearchResults] = useState<NoteDto[] | null>(null);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const syncing = useRef(false);
  const flushRequested = useRef(false);
  const socketRef = useRef<Socket | null>(null);

  const upsertNoteState = useCallback((note: LocalNote) => {
    setNotes((current) => [note, ...current.filter(({ id }) => id !== note.id)]);
  }, []);

  const refreshNotes = useCallback(async (userId: string) => {
    const [active, archived, trash, nextTags] = await Promise.all([
      notesApi.list(),
      notesApi.list('archived=true'),
      notesApi.list('trash=true'),
      notesApi.tags(),
    ]);
    const merged = [...active, ...archived, ...trash].filter((note, index, all) => all.findIndex(({ id }) => id === note.id) === index);
    setNotes((current) => {
      const pending = current.filter((note) => note.pending);
      const pendingIds = new Set(pending.map(({ id }) => id));
      return [...pending, ...merged.filter(({ id }) => !pendingIds.has(id))];
    });
    setTags(nextTags);
    await cacheServerNotes(userId, merged);
    return merged;
  }, []);

  const refreshTasks = useCallback(async () => {
    setTasks(await tasksApi.list());
  }, []);

  const refreshEvents = useCallback(async () => {
    setEvents(await eventsApi.list());
  }, []);

  const refreshAll = useCallback(async (userId: string) => {
    await Promise.all([refreshNotes(userId), refreshTasks(), refreshEvents()]);
  }, [refreshEvents, refreshNotes, refreshTasks]);

  const flush = useCallback(async (activeUser: SessionUser) => {
    if (!navigator.onLine) return;
    if (syncing.current) {
      flushRequested.current = true;
      return;
    }
    syncing.current = true;
    try {
      do {
        flushRequested.current = false;
        await flushNoteOutbox(activeUser.id, {
          onApplied: (note) => upsertNoteState({ ...note, pending: false }),
          onVersionAdvanced: (noteId, version) => {
            setNotes((current) => current.map((note) => note.id === noteId ? { ...note, version, pending: true } : note));
          },
          onConflict: (serverNote, localCopy) => {
            setNotes((current) => [localCopy, serverNote, ...current.filter(({ id }) => id !== serverNote.id && id !== localCopy.id)]);
            setSelectedId(localCopy.id);
            setNotice('检测到其他设备的修改，已保留一份冲突副本');
          },
          onError: (message) => setNotice(message),
        });
        const pulled = await syncApi.pull(await getSyncCursor(activeUser.id));
        await setSyncCursor(activeUser.id, pulled.cursor);
      } while (flushRequested.current);
    } finally {
      syncing.current = false;
    }
  }, [upsertNoteState]);

  useEffect(() => {
    setOnline(navigator.onLine);
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        void navigator.serviceWorker.register('/sw.js');
      } else {
        void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())));
        void caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('sticky-notes-')).map((key) => caches.delete(key))));
      }
    }
    authApi.me()
      .then(async ({ user: currentUser }) => {
        setUser(currentUser);
        const cached = await getCachedNotes(currentUser.id);
        if (cached.length) {
          setNotes(cached);
          setSelectedId(cached.find(({ deletedAt, isArchived }) => !deletedAt && !isArchived)?.id ?? null);
        }
        if (navigator.onLine) {
          const serverNotes = await refreshNotes(currentUser.id);
          setSelectedId((current) => current ?? serverNotes.find(({ deletedAt, isArchived }) => !deletedAt && !isArchived)?.id ?? null);
          await Promise.all([refreshTasks(), refreshEvents(), flush(currentUser)]);
        }
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [flush, refreshEvents, refreshNotes, refreshTasks, router]);

  useEffect(() => {
    if (!user) return;
    const socket = io(websocketUrl, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    let refreshTimer: number | undefined;
    socket.on('change', (_change: ChangeDto) => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void refreshAll(user.id).catch(() => undefined), 250);
    });
    return () => {
      window.clearTimeout(refreshTimer);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [refreshAll, user]);

  useEffect(() => {
    if (!user) return;
    const handleOnline = () => {
      setOnline(true);
      void flush(user).then(() => refreshAll(user.id)).catch((error: unknown) => setNotice(error instanceof Error ? error.message : '同步失败'));
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flush, refreshAll, user]);

  useEffect(() => {
    if (!user || !online || (!query.trim() && !selectedTag) || !['notes', 'archive', 'trash'].includes(section)) {
      setSearchResults(null);
      return;
    }
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (selectedTag) params.set('tag', selectedTag);
      if (section === 'archive') params.set('archived', 'true');
      if (section === 'trash') params.set('trash', 'true');
      notesApi.list(params.toString()).then(setSearchResults).catch(() => setSearchResults(null));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [online, query, section, selectedTag, user]);

  const localFilteredNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
    return notes
      .filter((note) => {
        if (section === 'trash') return Boolean(note.deletedAt);
        if (section === 'archive') return !note.deletedAt && note.isArchived;
        return !note.deletedAt && !note.isArchived;
      })
      .filter((note) => !selectedTag || note.tags.some(({ name }) => name === selectedTag))
      .filter((note) => !normalizedQuery || `${note.title} ${note.plainText}`.toLocaleLowerCase('zh-CN').includes(normalizedQuery))
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, query, section, selectedTag]);

  const displayedNotes = searchResults ?? localFilteredNotes;
  const selectedNote = notes.find(({ id }) => id === selectedId) ?? null;

  const createNote = useCallback(async () => {
    if (!user) return;
    const note = createLocalNote();
    const local = { ...note, cacheKey: `${user.id}:${note.id}`, userId: user.id };
    setSection('notes');
    upsertNoteState(local);
    setSelectedId(note.id);
    await queueNoteUpsert(user.id, note);
    await flush(user);
  }, [flush, upsertNoteState, user]);

  const saveNote = useCallback(async (note: NoteDto) => {
    if (!user) return;
    upsertNoteState({ ...note, pending: true });
    await queueNoteUpsert(user.id, note);
    await flush(user);
  }, [flush, upsertNoteState, user]);

  const deleteNote = useCallback(async (note: NoteDto) => {
    if (!user) return;
    await queueNoteDelete(user.id, note);
    setNotes((current) => current.map((item) => item.id === note.id ? { ...item, deletedAt: new Date().toISOString(), pending: true } : item));
    setSelectedId(null);
    await flush(user);
  }, [flush, user]);

  const restoreNote = useCallback(async (note: NoteDto) => {
    if (!user || !online) return setNotice('恢复便签需要联网');
    const restored = await notesApi.restore(note.id, note.version);
    upsertNoteState(restored);
    setSection('notes');
    setSelectedId(restored.id);
  }, [online, upsertNoteState, user]);

  const permanentlyDelete = useCallback(async (note: NoteDto) => {
    if (!online) return setNotice('永久删除需要联网');
    if (!window.confirm('永久删除后无法恢复，确认继续吗？')) return;
    await notesApi.permanentDelete(note.id);
    setNotes((current) => current.filter(({ id }) => id !== note.id));
    setSelectedId(null);
  }, [online]);

  async function logout() {
    if (!user) return;
    await authApi.logout();
    await clearAccountCache(user.id);
    router.replace('/login');
  }

  if (loading) return <main className="loading-screen"><span className="brand-mark">拾</span><p>正在打开你的空间…</p></main>;
  if (!user) return null;

  const noteSection = section === 'notes' || section === 'archive' || section === 'trash';
  const sectionTitle = section === 'trash' ? '回收站' : section === 'archive' ? '归档' : '全部便签';

  return (
    <div className="workspace-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand"><span className="brand-mark small">拾</span><div><strong>拾光便签</strong><span>STICKY NOTES</span></div></div>
        <nav aria-label="主导航">
          <button className={section === 'notes' ? 'active' : ''} onClick={() => setSection('notes')} type="button"><span>◫</span>便签</button>
          <button className={section === 'tasks' ? 'active' : ''} onClick={() => setSection('tasks')} type="button"><span>✓</span>任务</button>
          <button className={section === 'calendar' ? 'active' : ''} onClick={() => setSection('calendar')} type="button"><span>□</span>日程</button>
          <button className={section === 'archive' ? 'active' : ''} onClick={() => setSection('archive')} type="button"><span>⌑</span>归档</button>
          <button className={section === 'trash' ? 'active' : ''} onClick={() => setSection('trash')} type="button"><span>♲</span>回收站</button>
        </nav>
        <div className="sidebar-status"><span className={`status-dot ${online ? 'online' : ''}`} /><div><strong>{online ? '云端已连接' : '离线模式'}</strong><span>{online ? '变更自动同步' : '便签保存在本机'}</span></div></div>
        <div className="user-menu"><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{user.email ?? user.phone}</small></div><button type="button" onClick={() => void logout()}>退出</button></div>
      </aside>
      {noteSection ? (
        <>
          <NoteList
            notes={displayedNotes}
            tags={tags}
            selectedId={selectedId}
            query={query}
            selectedTag={selectedTag}
            title={sectionTitle}
            onQueryChange={setQuery}
            onTagChange={setSelectedTag}
            onSelect={setSelectedId}
            onCreate={() => void createNote()}
          />
          <NoteEditor
            note={selectedNote}
            isTrash={section === 'trash'}
            online={online}
            onSave={saveNote}
            onDelete={deleteNote}
            onRestore={restoreNote}
            onPermanentDelete={permanentlyDelete}
            onClose={() => setSelectedId(null)}
          />
        </>
      ) : section === 'tasks' ? (
        <TasksPanel tasks={tasks} online={online} onChanged={refreshTasks} />
      ) : (
        <CalendarPanel events={events} online={online} onChanged={refreshEvents} />
      )}
      {notice && <button className="toast" type="button" onClick={() => setNotice('')}>{notice}</button>}
    </div>
  );
}
