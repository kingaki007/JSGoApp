/** Introduces JSGoApp, links to the playground, and presents truthful desktop installer availability. */
import { useTheme } from './theme';
import ThemeSwitcher from './ThemeSwitcher';
import { desktopDownloads } from './desktopDownloads';
import './styles/landing.css';

/** Renders the lightweight product home using the same tokens and theme preference as the editor. */
export default function LandingPage() {
  const { preference, setPreference } = useTheme();
  return (
    <div className="landing">
      <a className="landing-skip" href="#main">
        Skip to content
      </a>
      <header className="landing-header">
        <a className="brand" href="/" aria-label="JSGoApp home">
          <span className="brand-mark" aria-hidden="true">
            JS
          </span>
          <span>JSGoApp</span>
        </a>
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="/playground">Playground</a>
          <a href="#desktop">Desktop app</a>
        </nav>
        <ThemeSwitcher value={preference} onChange={setPreference} />
      </header>
      <main id="main">
        <section className="landing-hero" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <p className="landing-eyebrow">
              <span className="status-dot ready" aria-hidden="true" /> A LITTLE SPACE TO EXPERIMENT
            </p>
            <h1 id="hero-heading">
              A playground for
              <br />
              <span>your next idea.</span>
            </h1>
            <p className="hero-description">
              Write JavaScript and TypeScript, test a thought, and see what happens. Your scratchpad
              is one click away.
            </p>
            <div className="landing-actions">
              <a className="landing-button primary" href="/playground">
                Open playground <span aria-hidden="true">↗</span>
              </a>
              <a className="landing-button secondary" href="#desktop">
                Get the desktop app <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className="hero-footnote">No account needed. Just you and your code.</p>
          </div>
          <div
            className="landing-demo"
            role="img"
            aria-label="JavaScript example: double the numbers 1, 2, 3 to get 2, 4, 6."
          >
            <div className="demo-chrome">
              <span className="demo-lights" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>an-idea.js</span>
              <span className="demo-language">JS</span>
            </div>
            <div className="demo-code" aria-hidden="true">
              <span className="demo-line">1</span>
              <code className="demo-comment">// Big ideas start small.</code>
              <span className="demo-line">2</span>
              <code>
                <span className="demo-keyword">const</span> numbers = [
                <span className="demo-number">1, 2, 3</span>];
              </code>
              <span className="demo-line">3</span>
              <code>
                <span className="demo-keyword">const</span> doubled = numbers.map(
              </code>
              <span className="demo-line">4</span>
              <code>
                {' '}
                number <span className="demo-keyword">=&gt;</span> number *{' '}
                <span className="demo-number">2</span>
              </code>
              <span className="demo-line">5</span>
              <code>);</code>
              <span className="demo-line">6</span>
              <code>console.log(doubled);</code>
              <span className="demo-line">7</span>
              <code className="demo-cursor"> </code>
            </div>
            <div className="demo-output" aria-hidden="true">
              <p>
                <span className="status-dot ready" /> CONSOLE <span>Finished</span>
              </p>
              <code>[ 2, 4, 6 ]</code>
            </div>
            <div className="demo-bottom" aria-hidden="true">
              <span>JavaScript</span>
              <span>A fresh start, every time.</span>
            </div>
          </div>
        </section>
        <section className="landing-features" aria-label="A few things to make room for ideas">
          <div>
            <span className="feature-index">01 / WRITE</span>
            <h2>JavaScript. TypeScript.</h2>
            <p>Switch languages in a familiar editor built for small experiments.</p>
          </div>
          <div>
            <span className="feature-index">02 / EXPLORE</span>
            <h2>Pick your environment.</h2>
            <p>Browser or Node.js. One clear Env selector, with results beside your code.</p>
          </div>
          <div>
            <span className="feature-index">03 / COME BACK</span>
            <h2>Keep your train of thought.</h2>
            <p>Your scratchpads save on this device, ready when inspiration returns.</p>
          </div>
        </section>
        <section className="landing-desktop" id="desktop" aria-labelledby="desktop-heading">
          <div className="desktop-intro">
            <div>
              <p className="landing-eyebrow">A HOME FOR YOUR SCRATCHPAD</p>
              <h2 id="desktop-heading">A little closer to your desktop.</h2>
            </div>
            <p>
              Our desktop app is taking shape. Installers for Windows, macOS, and Linux will appear
              here when they’re ready.
            </p>
          </div>
          <div className="download-grid">
            {desktopDownloads.map((download) => (
              <article className="download-option" key={download.platform}>
                <span className="platform-symbol" aria-hidden="true">
                  {download.symbol}
                </span>
                <div>
                  <h3>{download.platform}</h3>
                  <p>{download.description}</p>
                </div>
                {download.url ? (
                  <a className="landing-button secondary" href={download.url}>
                    Download for {download.platform} <span aria-hidden="true">↓</span>
                  </a>
                ) : (
                  <button
                    className="landing-button secondary"
                    type="button"
                    disabled
                    aria-label={`Download for ${download.platform} — coming soon`}
                  >
                    Coming soon <span aria-hidden="true">↗</span>
                  </button>
                )}
              </article>
            ))}
          </div>
          <p className="download-note">
            Want to try it today?{' '}
            <a href="/playground">
              Open the browser playground <span aria-hidden="true">↗</span>
            </a>
          </p>
        </section>
      </main>
      <footer className="landing-footer">
        <a className="brand" href="/">
          JSGoApp
          <span className="footer-dot" aria-hidden="true">
            .
          </span>
        </a>
        <span>Small experiments. New possibilities.</span>
        <a href="/playground">
          Let’s make something <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </div>
  );
}
