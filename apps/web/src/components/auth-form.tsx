'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, authApi } from '@/lib/api';

type Mode = 'login' | 'register';

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await authApi.login(identifier, password);
      } else {
        const account = identifier.includes('@') ? { email: identifier } : { phone: identifier };
        await authApi.register({ ...account, password, displayName });
      }
      router.replace('/workspace');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : '暂时无法完成操作，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-tabs" role="tablist">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">登录</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')} type="button">创建账号</button>
      </div>
      <div className="auth-card-copy">
        <p className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'START HERE'}</p>
        <h2 id="auth-title">{mode === 'login' ? '继续记录' : '建立你的私人空间'}</h2>
        <p>{mode === 'login' ? '登录后继续访问所有设备上的内容。' : '你的便签默认仅自己可见。'}</p>
      </div>
      <form onSubmit={submit}>
        {mode === 'register' && (
          <label>
            <span>昵称</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} autoComplete="name" required />
          </label>
        )}
        <label>
          <span>邮箱或手机号</span>
          <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required />
        </label>
        <label>
          <span>密码</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button auth-submit" disabled={submitting} type="submit">
          {submitting ? '处理中…' : mode === 'login' ? '登录' : '创建账号'}
        </button>
      </form>
      <p className="privacy-note">AI 功能只发送当前操作所需内容，账号凭据由 HttpOnly Cookie 保存。</p>
    </section>
  );
}
