'use client';

import type { NoteDto } from '@sticky-notes/contracts';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RichTextEditor } from './rich-text-editor';

export function SharedNote() {
  const params = useParams<{ token: string }>();
  const [note, setNote] = useState<NoteDto | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<NoteDto>(`/shares/${encodeURIComponent(params.token)}`).then(setNote).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : '分享链接已失效');
    });
  }, [params.token]);

  return (
    <main className="shared-page">
      <header><span className="brand-mark small">拾</span><strong>拾光便签</strong><span>只读分享</span></header>
      {error ? <section className="shared-error"><h1>无法打开便签</h1><p>{error}</p></section> : !note ? <section className="shared-error"><p>正在加载…</p></section> : (
        <article className="shared-document">
          <p className="eyebrow">SHARED NOTE</p>
          <h1>{note.title || '未命名便签'}</h1>
          <div className="shared-meta"><span>{new Date(note.updatedAt).toLocaleString('zh-CN')}</span>{note.tags.map((tag) => <span key={tag.id}>#{tag.name}</span>)}</div>
          <RichTextEditor content={note.content} onChange={() => undefined} disabled />
        </article>
      )}
    </main>
  );
}
