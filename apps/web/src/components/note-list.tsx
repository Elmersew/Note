'use client';

import type { NoteDto, TagDto } from '@sticky-notes/contracts';

interface NoteListProps {
  notes: Array<NoteDto & { pending?: boolean }>;
  tags: TagDto[];
  selectedId: string | null;
  query: string;
  selectedTag: string;
  title: string;
  onQueryChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

function relativeDate(value: string): string {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function NoteList({
  notes,
  tags,
  selectedId,
  query,
  selectedTag,
  title,
  onQueryChange,
  onTagChange,
  onSelect,
  onCreate,
}: NoteListProps) {
  return (
    <section className="note-list-panel" aria-label="便签列表">
      <header className="list-header">
        <div>
          <p className="eyebrow">YOUR SPACE</p>
          <h2>{title}</h2>
        </div>
        <button className="icon-button add-button" onClick={onCreate} type="button" aria-label="新建便签">＋</button>
      </header>
      <label className="search-box">
        <span aria-hidden="true">⌕</span>
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索标题和正文" />
      </label>
      <div className="tag-filter" aria-label="标签筛选">
        <button className={!selectedTag ? 'active' : ''} onClick={() => onTagChange('')} type="button">全部</button>
        {tags.map((tag) => (
          <button className={selectedTag === tag.name ? 'active' : ''} onClick={() => onTagChange(tag.name)} type="button" key={tag.id}>{tag.name}</button>
        ))}
      </div>
      <div className="note-list" role="list">
        {notes.length === 0 && (
          <div className="empty-list">
            <span>空</span>
            <p>这里还没有便签</p>
            <button type="button" onClick={onCreate}>写下第一条</button>
          </div>
        )}
        {notes.map((note) => (
          <button
            type="button"
            role="listitem"
            className={`note-card ${selectedId === note.id ? 'selected' : ''}`}
            key={note.id}
            onClick={() => onSelect(note.id)}
          >
            <div className="note-card-top">
              <span className="note-date">{relativeDate(note.updatedAt)}</span>
              <span className="note-indicators">{note.pending ? '同步中' : ''}{note.isPinned ? ' · 置顶' : ''}</span>
            </div>
            <strong>{note.title || '未命名便签'}</strong>
            <p>{note.plainText || '开始写点什么…'}</p>
            {note.tags.length > 0 && <div className="note-tags">{note.tags.slice(0, 3).map((tag) => <span key={tag.id}>#{tag.name}</span>)}</div>}
          </button>
        ))}
      </div>
    </section>
  );
}
