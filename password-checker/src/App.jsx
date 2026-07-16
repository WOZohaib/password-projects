import { useMemo, useState } from 'react';
import './App.css';
import sha1 from 'js-sha1';
import {
  Check,
  Clipboard,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';

const STRENGTH_LEVELS = [
  { label: 'Very Weak', color: '#ff4d4d' },
  { label: 'Weak', color: '#ff7a45' },
  { label: 'Okay', color: '#facc15' },
  { label: 'Strong', color: '#84cc16' },
  { label: 'Very Strong', color: '#4ade80' },
  { label: 'Excellent', color: '#22c55e' },
];

const COMMON_PATTERNS = [
  '123456',
  'password',
  'qwerty',
  'letmein',
  'welcome',
  'admin',
  'abc123',
];

const CHARACTER_GROUPS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?',
};

const getScore = (password) => {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[\W_]/.test(password)) score += 1;

  return score;
};

const getCharacterPoolSize = (password) => {
  let poolSize = 0;

  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/\d/.test(password)) poolSize += 10;
  if (/[\W_]/.test(password)) poolSize += 33;

  return poolSize;
};

const estimateEntropy = (password) => {
  if (!password) return 0;

  const poolSize = getCharacterPoolSize(password);
  if (!poolSize) return 0;

  return Math.round(password.length * Math.log2(poolSize));
};

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) return 'effectively forever';
  if (seconds < 1) return 'less than a second';
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 31557600) return `${Math.round(seconds / 86400)} days`;
  if (seconds < 31557600 * 1000) {
    return `${Math.round(seconds / 31557600).toLocaleString()} years`;
  }

  return 'thousands of years';
};

const estimateCrackTime = (entropy) => {
  if (!entropy) return 'Instantly';

  // Approximation assuming 10 billion guesses per second.
  const guesses = 2 ** entropy;
  const seconds = guesses / 10_000_000_000;

  return formatDuration(seconds);
};

const hasRepeatedCharacters = (password) => /(.)\1{2,}/.test(password);

const hasSequentialPattern = (password) => {
  const normalized = password.toLowerCase();
  const sequences = [
    '0123456789',
    '9876543210',
    'abcdefghijklmnopqrstuvwxyz',
    'zyxwvutsrqponmlkjihgfedcba',
    'qwertyuiop',
    'poiuytrewq',
  ];

  return sequences.some((sequence) => {
    for (let i = 0; i <= sequence.length - 4; i += 1) {
      if (normalized.includes(sequence.slice(i, i + 4))) return true;
    }
    return false;
  });
};

const getFeedback = (password) => {
  if (!password) return [];

  const feedback = [];

  if (password.length < 12) {
    feedback.push('Use at least 12 characters.');
  }

  if (!/[A-Z]/.test(password)) {
    feedback.push('Add an uppercase letter.');
  }

  if (!/[a-z]/.test(password)) {
    feedback.push('Add a lowercase letter.');
  }

  if (!/\d/.test(password)) {
    feedback.push('Add a number.');
  }

  if (!/[\W_]/.test(password)) {
    feedback.push('Add a symbol.');
  }

  if (hasRepeatedCharacters(password)) {
    feedback.push('Avoid repeating the same character three times.');
  }

  if (hasSequentialPattern(password)) {
    feedback.push('Avoid keyboard and alphabetical sequences.');
  }

  if (COMMON_PATTERNS.some((pattern) => password.toLowerCase().includes(pattern))) {
    feedback.push('Avoid common words and password patterns.');
  }

  if (feedback.length === 0) {
    feedback.push('Strong mix of length and character variety.');
  }

  return feedback;
};

const buildChecklist = (password) => [
  { label: 'At least 12 characters', passed: password.length >= 12 },
  { label: 'Contains uppercase letters', passed: /[A-Z]/.test(password) },
  { label: 'Contains lowercase letters', passed: /[a-z]/.test(password) },
  { label: 'Contains numbers', passed: /\d/.test(password) },
  { label: 'Contains symbols', passed: /[\W_]/.test(password) },
  {
    label: 'Avoids obvious repeated characters',
    passed: password.length > 0 && !hasRepeatedCharacters(password),
  },
  {
    label: 'Avoids common sequences',
    passed: password.length > 0 && !hasSequentialPattern(password),
  },
];

const generatePassword = (length = 18) => {
  const groups = Object.values(CHARACTER_GROUPS);
  const allCharacters = groups.join('');

  const requiredCharacters = groups.map((group) => {
    const index = crypto.getRandomValues(new Uint32Array(1))[0] % group.length;
    return group[index];
  });

  const remainingCharacters = Array.from(
    { length: Math.max(length - requiredCharacters.length, 0) },
    () => {
      const index =
        crypto.getRandomValues(new Uint32Array(1))[0] % allCharacters.length;
      return allCharacters[index];
    }
  );

  const combined = [...requiredCharacters, ...remainingCharacters];

  for (let i = combined.length - 1; i > 0; i -= 1) {
    const randomIndex =
      crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [combined[i], combined[randomIndex]] = [
      combined[randomIndex],
      combined[i],
    ];
  }

  return combined.join('');
};

function App() {
  const [password, setPassword] = useState('');
  const [breachCount, setBreachCount] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isCheckingBreach, setIsCheckingBreach] = useState(false);
  const [copied, setCopied] = useState(false);

  const score = useMemo(() => getScore(password), [password]);
  const strength = STRENGTH_LEVELS[score];
  const entropy = useMemo(() => estimateEntropy(password), [password]);
  const crackTime = useMemo(() => estimateCrackTime(entropy), [entropy]);
  const feedback = useMemo(() => getFeedback(password), [password]);
  const checklist = useMemo(() => buildChecklist(password), [password]);

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
    setBreachCount(null);
    setCopied(false);
  };

  const handleGeneratePassword = () => {
    setPassword(generatePassword());
    setBreachCount(null);
    setCopied(false);
  };

  const handleClear = () => {
    setPassword('');
    setBreachCount(null);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!password) return;

    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error('Unable to copy password:', error);
    }
  };

  const checkBreach = async () => {
    if (!password || isCheckingBreach) return;

    const hash = sha1(password).toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    setIsCheckingBreach(true);
    setBreachCount(null);

    try {
      const response = await fetch(
        `https://api.pwnedpasswords.com/range/${prefix}`,
        {
          headers: {
            'Add-Padding': 'true',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Breach service returned ${response.status}`);
      }

      const text = await response.text();
      const match = text
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.startsWith(`${suffix}:`));

      const count = match ? Number.parseInt(match.split(':')[1], 10) : 0;
      setBreachCount(Number.isNaN(count) ? 0 : count);
    } catch (error) {
      console.error('Error checking breach:', error);
      setBreachCount(-1);
    } finally {
      setIsCheckingBreach(false);
    }
  };

  return (
    <div className="wrapper">
      <main className="container">
        <div className="app-heading">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              <span className="brand-mark-core" />
            </div>
            <div>
              <p className="eyebrow">PassMetric</p>
            <h1>Measure password security.</h1>
              <p className="subtitle">
                Analyze strength, estimate crack resistance, check breach exposure,
                and generate stronger passwords from one focused workspace.
              </p>
            </div>
          </div>

        </div>

        <section className="password-section">
          <label htmlFor="password-input">Password to evaluate</label>

          <div className="password-wrapper">
            <input
              id="password-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter or generate a password"
              value={password}
              onChange={handlePasswordChange}
              autoComplete="new-password"
            />

            <button
              type="button"
              className="icon-button"
              onClick={() => setShowPassword((current) => !current)}
              title={showPassword ? 'Hide password' : 'Show password'}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="password-actions">
            <button type="button" onClick={handleGeneratePassword}>
              <RefreshCw size={18} />
              Generate password
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={handleCopy}
              disabled={!password}
            >
              <Clipboard size={18} />
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={handleClear}
              disabled={!password}
            >
              <Trash2 size={18} />
              Clear
            </button>
          </div>
        </section>

        {password && (
          <>
            <section className="strength-section">
              <div className="section-heading-row">
                <div>
                  <p className="section-kicker">Overall strength</p>
                  <h2>{strength.label}</h2>
                </div>
                <span className="score-pill">{score}/5</span>
              </div>

              <div className="strength-bar-wrapper" aria-hidden="true">
                <div
                  className="strength-bar"
                  style={{
                    width: `${(score / 5) * 100}%`,
                    backgroundColor: strength.color,
                  }}
                />
              </div>

              <div className="strength-scale" aria-hidden="true">
                {STRENGTH_LEVELS.slice(1).map((level, index) => (
                  <span
                    key={level.label}
                    className={index < score ? 'active' : ''}
                  />
                ))}
              </div>

              <div className="metrics-grid">
                <article className="metric-card">
                  <span>Estimated entropy</span>
                  <strong>{entropy} bits</strong>
                </article>

                <article className="metric-card">
                  <span>Estimated offline crack time</span>
                  <strong>{crackTime}</strong>
                </article>

                <article className="metric-card">
                  <span>Password length</span>
                  <strong>{password.length} characters</strong>
                </article>
              </div>
            </section>

            <section className="analysis-grid">
              <article className="analysis-card">
                <h2>Requirement checklist</h2>
                <ul className="checklist">
                  {checklist.map((item) => (
                    <li key={item.label} className={item.passed ? 'passed' : ''}>
                      {item.passed ? <Check size={18} /> : <X size={18} />}
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="analysis-card">
                <h2>Recommendations</h2>
                <ul className="feedback-list">
                  {feedback.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </section>
          </>
        )}

        <section className="breach-section">
          <div>
            <p className="section-kicker">Known breach database</p>
            <h2>Has this password appeared before?</h2>
            <p>
              Only the first five characters of the SHA-1 hash are sent to the
              breach-check service.
            </p>
          </div>

          <button
            type="button"
            onClick={checkBreach}
            disabled={!password || isCheckingBreach}
          >
            {isCheckingBreach ? (
              <>
                <RefreshCw size={18} className="spin" />
                Checking...
              </>
            ) : (
              <>
                <ShieldAlert size={18} />
                Check breach status
              </>
            )}
          </button>
        </section>

        {breachCount !== null && breachCount >= 0 && (
          <div
            className={`breach-result ${
              breachCount > 0 ? 'breach-alert' : 'breach-safe'
            }`}
          >
            {breachCount > 0 ? (
              <>
                <ShieldAlert size={22} />
                <p>
                  This password appeared in{' '}
                  <strong>{breachCount.toLocaleString()}</strong> known breach
                  records. Do not use it.
                </p>
              </>
            ) : (
              <>
                <ShieldCheck size={22} />
                <p>
                  This exact password was not found in the known breach
                  database. It should still be unique for every account.
                </p>
              </>
            )}
          </div>
        )}

        {breachCount === -1 && (
          <div className="breach-result breach-error">
            <ShieldAlert size={22} />
            <p>
              The breach service could not be reached. Please try again later.
            </p>
          </div>
        )}

        <p className="privacy-note">
          Password analysis happens in your browser. Never reuse a password
          across multiple accounts.
        </p>
      </main>

      <footer className="footer">
        <p>PassMetric · Created by Zohaib S. Khan</p>
      </footer>
    </div>
  );
}

export default App;
