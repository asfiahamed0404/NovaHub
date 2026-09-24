import NovaHubLogo from "./NovaHubLogo.jsx";
import ThemeSelector from "./ThemeSelector.jsx";
import { CheckIcon, MessageIcon, SparklesIcon } from "./Icons.jsx";

function AuthLayout({ title, description, children, footer }) {
  return (
    <main className="app-shell auth-shell">
      <section className="auth-story" aria-labelledby="auth-brand-heading">
        <NovaHubLogo showTagline />
        <div className="auth-story-copy">
          <p className="eyebrow">LESS NOISE. MORE MOMENTUM.</p>
          <h1 id="auth-brand-heading">
            Your team.
            <br />
            One space.
            <br />
            <em>Endless possibility.</em>
          </h1>
          <p>
            A home for the conversations, ideas, and decisions that move your
            team forward.
          </p>
        </div>
        <div
          className="auth-product-preview"
          aria-label="An illustration of NovaHub collaboration"
        >
          <div className="preview-title">
            <span>
              <span className="preview-hash">#</span> Product studio
            </span>
            <span className="preview-label">WORKSPACE PREVIEW</span>
          </div>
          <div className="preview-message">
            <span className="preview-avatar">JD</span>
            <div>
              <strong>
                Jamie <small>Design team</small>
              </strong>
              <p>The new direction is ready. Let's bring it all together.</p>
            </div>
          </div>
          <div className="preview-nova">
            <span className="preview-nova-icon">
              <SparklesIcon className="size-5" />
            </span>
            <div>
              <strong>A little help from Nova</strong>
              <p>
                Catch up on the conversation. Find the decision. Keep moving.
              </p>
              <span className="preview-source">
                <MessageIcon className="size-3" /> Answers with workspace
                context
              </span>
            </div>
          </div>
        </div>
        <div className="auth-proof">
          <span>
            <CheckIcon />
            Real-time conversations
          </span>
          <span>
            <CheckIcon />
            AI with context
          </span>
        </div>
        <p className="auth-story-footer">
          A little more connected. A lot more possible.
        </p>
      </section>
      <section className="auth-form-side">
        <div className="auth-theme">
          <ThemeSelector compact />
        </div>
        <div
          className="page-enter auth-form-card"
          aria-labelledby="auth-form-heading"
        >
          <span className="auth-welcome-mark">
            <SparklesIcon className="size-6" />
          </span>
          <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
          <h2 id="auth-form-heading">{title}</h2>
          <p className="text-muted mt-3 text-sm leading-6">{description}</p>
          {children}
          <div className="border-theme text-muted mt-7 border-t pt-6 text-center text-sm">
            {footer}
          </div>
        </div>
        <p className="auth-form-footer">NovaHub · Built around your team</p>
      </section>
    </main>
  );
}
export default AuthLayout;
