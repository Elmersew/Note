import { AuthForm } from '@/components/auth-form';

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-brand">
        <span className="brand-mark">拾</span>
        <p className="eyebrow">STICKY NOTES · AI</p>
        <h1>把零散想法，<br />变成清晰行动。</h1>
        <p className="auth-lead">随手记录、离线编辑、多端同步，并让 AI 帮你润色、总结和整理。</p>
        <div className="auth-feature-row">
          <span>本地优先</span>
          <span>隐私隔离</span>
          <span>实时同步</span>
        </div>
      </section>
      <AuthForm />
    </main>
  );
}
