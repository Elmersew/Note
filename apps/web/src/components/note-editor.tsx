'use client';

import type { AiOperation, JsonObject, NoteDto } from '@sticky-notes/contracts';
import { useEffect, useRef, useState } from 'react';
import { notesApi, streamAi } from '@/lib/api';
import { normalizeContentText } from '@/lib/content';
import { RichTextEditor, type RichTextEditorHandle } from './rich-text-editor';

interface NoteEditorProps {
  note: NoteDto | null;
  isTrash: boolean;
  online: boolean;
  onSave: (note: NoteDto) => Promise<void>;
  onDelete: (note: NoteDto) => Promise<void>;
  onRestore: (note: NoteDto) => Promise<void>;
  onPermanentDelete: (note: NoteDto) => Promise<void>;
  onClose: () => void;
}

const aiActions: Array<{ operation: AiOperation; label: string }> = [
  { operation: 'POLISH', label: '润色' },
  { operation: 'SUMMARIZE', label: '总结' },
  { operation: 'CONTINUE', label: '续写' },
  { operation: 'KEY_POINTS', label: '提取要点' },
  { operation: 'CLASSIFY', label: '智能分类' },
];

export function NoteEditor({ note, isTrash, online, onSave, onDelete, onRestore, onPermanentDelete, onClose }: NoteEditorProps) {
  const editorRef = useRef<RichTextEditorHandle>(null);
  const editRevision = useRef(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<JsonObject>({ type: 'doc', content: [{ type: 'paragraph' }] });
  const [tagInput, setTagInput] = useState('');
  const [isPinned, setPinned] = useState(false);
  const [isArchived, setArchived] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiOperation, setAiOperation] = useState<AiOperation | 'ASK'>('SUMMARIZE');
  const [question, setQuestion] = useState('');
  const [message, setMessage] = useState('');

  const markDirty = () => {
    editRevision.current += 1;
    setDirty(true);
  };

  useEffect(() => {
    setTitle(note?.title ?? '');
    setContent(note?.content ?? { type: 'doc', content: [{ type: 'paragraph' }] });
    setTagInput(note?.tags.map(({ name }) => name).join(', ') ?? '');
    setPinned(note?.isPinned ?? false);
    setArchived(note?.isArchived ?? false);
    editRevision.current = 0;
    setDirty(false);
    setAiOpen(false);
    setAiResult('');
    setMessage('');
  }, [note?.id]);

  useEffect(() => {
    if (!note || !dirty || isTrash) return;
    const timer = window.setTimeout(async () => {
      const revision = editRevision.current;
      setSaving(true);
      const now = new Date().toISOString();
      try {
        await onSave({
          ...note,
          title,
          content,
          plainText: normalizeContentText(content),
          isPinned,
          isArchived,
          tags: tagInput.split(/[,，]/).map((name) => name.trim()).filter(Boolean).slice(0, 20).map((name) => ({ id: `local:${name}`, name, color: '#6d5dfc' })),
          updatedAt: now,
        });
        if (editRevision.current === revision) setDirty(false);
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [content, dirty, isArchived, isPinned, isTrash, note, onSave, tagInput, title]);

  if (!note) {
    return (
      <section className="editor-empty">
        <span className="empty-glyph">✦</span>
        <p>选择一条便签开始编辑</p>
      </section>
    );
  }

  const updateContent = (next: JsonObject) => {
    setContent(next);
    markDirty();
  };

  async function runAi(operation: AiOperation) {
    setAiOpen(true);
    setAiBusy(true);
    setAiResult('');
    setAiOperation(operation);
    setMessage('');
    const selectedText = editorRef.current?.selectedText();
    try {
      await streamAi('/ai/transform/stream', { operation, noteId: note!.id, ...(selectedText ? { selectedText } : {}) }, (delta) => {
        setAiResult((current) => current + delta);
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AI 请求失败');
    } finally {
      setAiBusy(false);
    }
  }

  async function askCurrentNote() {
    if (!question.trim()) return;
    setAiOpen(true);
    setAiBusy(true);
    setAiResult('');
    setAiOperation('ASK');
    setMessage('');
    try {
      await streamAi('/ai/ask/stream', { noteId: note!.id, question: question.trim() }, (delta) => {
        setAiResult((current) => current + delta);
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AI 请求失败');
    } finally {
      setAiBusy(false);
    }
  }

  function applyAiResult() {
    if (!aiResult) return;
    if (aiOperation === 'CLASSIFY') {
      const suggested = aiResult.split(/[,，\n]/).map((item) => item.trim().replace(/^[-#\s]+/, '')).filter(Boolean);
      const existing = tagInput.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
      setTagInput([...new Set([...existing, ...suggested])].slice(0, 20).join(', '));
      markDirty();
    } else if (aiOperation === 'POLISH' && editorRef.current?.selectedText()) {
      editorRef.current.replaceSelection(aiResult);
    } else if (aiOperation !== 'ASK') {
      editorRef.current?.appendText(aiResult);
    }
    setAiOpen(false);
  }

  async function shareNote() {
    try {
      const { token } = await notesApi.createShare(note!.id);
      const url = `${window.location.origin}/share/${token}`;
      await navigator.clipboard.writeText(url);
      setMessage('只读分享链接已复制');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法创建分享链接');
    }
  }

  return (
    <section className="note-editor-panel">
      <header className="note-editor-header">
        <div className="document-state">
          <button className="mobile-back" type="button" onClick={onClose} aria-label="返回便签列表">←</button>
          <span className={`status-dot ${online ? 'online' : ''}`} />
          <span>{online ? saving || dirty ? '正在保存' : '已同步' : '离线编辑'}</span>
        </div>
        <div className="document-actions">
          {!isTrash ? (
            <>
              <button type="button" className={isPinned ? 'active' : ''} onClick={() => { setPinned((value) => !value); markDirty(); }}>{isPinned ? '取消置顶' : '置顶'}</button>
              <button type="button" className={isArchived ? 'active' : ''} onClick={() => { setArchived((value) => !value); markDirty(); }}>{isArchived ? '移出归档' : '归档'}</button>
              <button type="button" onClick={shareNote} disabled={!online || note.version === 0}>分享</button>
              <button type="button" className="danger-text" onClick={() => void onDelete(note)}>删除</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => void onRestore(note)}>恢复</button>
              <button type="button" className="danger-text" onClick={() => void onPermanentDelete(note)}>永久删除</button>
            </>
          )}
        </div>
      </header>
      <div className="document-scroll">
        <input
          className="note-title-input"
          value={title}
          onChange={(event) => { setTitle(event.target.value); markDirty(); }}
          placeholder="未命名便签"
          maxLength={255}
          disabled={isTrash}
        />
        <div className="note-meta-row">
          <span>{new Date(note.updatedAt).toLocaleString('zh-CN')}</span>
          <label>
            <span>标签</span>
            <input value={tagInput} onChange={(event) => { setTagInput(event.target.value); markDirty(); }} placeholder="工作, 灵感" disabled={isTrash} />
          </label>
        </div>
        <RichTextEditor key={note.id} ref={editorRef} content={content} onChange={updateContent} disabled={isTrash} />
      </div>
      {!isTrash && (
        <div className="ai-dock">
          <div className="ai-dock-title"><span>AI</span><strong>写作助手</strong></div>
          <div className="ai-actions">
            {aiActions.map((action) => <button type="button" key={action.operation} disabled={aiBusy || !online || note.version === 0} onClick={() => void runAi(action.operation)}>{action.label}</button>)}
          </div>
          <div className="ai-question">
            <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="基于当前便签提问…" onKeyDown={(event) => { if (event.key === 'Enter') void askCurrentNote(); }} />
            <button type="button" disabled={aiBusy || !online || !question.trim() || note.version === 0} onClick={() => void askCurrentNote()}>提问</button>
          </div>
        </div>
      )}
      {aiOpen && (
        <aside className="ai-result-panel" aria-live="polite">
          <div className="ai-result-header"><strong>AI 建议</strong><button type="button" onClick={() => setAiOpen(false)}>关闭</button></div>
          <div className="ai-result-content">{aiResult || (aiBusy ? '正在生成…' : '暂无结果')}</div>
          {aiResult && aiOperation !== 'ASK' && <button className="primary-button" type="button" onClick={applyAiResult}>{aiOperation === 'CLASSIFY' ? '应用标签' : '插入正文'}</button>}
        </aside>
      )}
      {message && <div className="toast" role="status" onClick={() => setMessage('')}>{message}</div>}
    </section>
  );
}
