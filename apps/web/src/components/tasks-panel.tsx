'use client';

import type { TaskDto, TaskPriority, TaskStatus } from '@sticky-notes/contracts';
import { FormEvent, useState } from 'react';
import { tasksApi } from '@/lib/api';
import { randomId } from '@/lib/random-id';

interface TasksPanelProps {
  tasks: TaskDto[];
  online: boolean;
  onChanged: () => Promise<void>;
}

const nextStatus: Record<TaskStatus, TaskStatus> = { TODO: 'IN_PROGRESS', IN_PROGRESS: 'DONE', DONE: 'TODO' };
const statusText: Record<TaskStatus, string> = { TODO: '待处理', IN_PROGRESS: '进行中', DONE: '已完成' };
const priorityText: Record<TaskPriority, string> = { LOW: '低', MEDIUM: '中', HIGH: '高' };

export function TasksPanel({ tasks, online, onChanged }: TasksPanelProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState('');

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setError('');
    try {
      await tasksApi.create({ id: randomId(), title: title.trim(), priority, ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}) });
      setTitle('');
      setDueAt('');
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法创建任务');
    }
  }

  async function advance(task: TaskDto) {
    try {
      await tasksApi.update(task.id, { baseVersion: task.version, status: nextStatus[task.status] });
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法更新任务');
    }
  }

  async function remove(task: TaskDto) {
    try {
      await tasksApi.remove(task.id);
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法删除任务');
    }
  }

  return (
    <main className="module-page">
      <header className="module-header">
        <div><p className="eyebrow">ACTION BOARD</p><h1>任务</h1><p>把便签里的想法，推进成可以完成的行动。</p></div>
        <span className="module-count">{tasks.filter((task) => task.status !== 'DONE').length} 项待完成</span>
      </header>
      <form className="quick-create" onSubmit={create}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="添加一个任务…" disabled={!online} />
        <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} disabled={!online}>
          <option value="LOW">低优先级</option><option value="MEDIUM">中优先级</option><option value="HIGH">高优先级</option>
        </select>
        <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} disabled={!online} />
        <button className="primary-button" disabled={!online || !title.trim()} type="submit">添加</button>
      </form>
      {!online && <p className="inline-notice">任务操作需要联网；便签仍可离线编辑。</p>}
      {error && <p className="form-error">{error}</p>}
      <div className="task-columns">
        {(['TODO', 'IN_PROGRESS', 'DONE'] as TaskStatus[]).map((status) => (
          <section className="task-column" key={status}>
            <header><span>{statusText[status]}</span><strong>{tasks.filter((task) => task.status === status).length}</strong></header>
            <div>
              {tasks.filter((task) => task.status === status).map((task) => (
                <article className="task-card" key={task.id}>
                  <button className={`task-check ${task.status === 'DONE' ? 'done' : ''}`} type="button" onClick={() => void advance(task)} disabled={!online} aria-label="切换任务状态">{task.status === 'DONE' ? '✓' : ''}</button>
                  <div><h3>{task.title}</h3><p>{task.dueAt ? new Date(task.dueAt).toLocaleString('zh-CN') : '未设置截止时间'}</p><span className={`priority ${task.priority.toLowerCase()}`}>{priorityText[task.priority]}优先级</span></div>
                  <button className="card-delete" type="button" onClick={() => void remove(task)} disabled={!online}>删除</button>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
