import { useEffect, useMemo, useState } from 'react';
import './App.css';
import sha1 from 'js-sha1';
import {
  Check,
  Clipboard,
  Eye,
  EyeOff,
  Moon,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Sun,
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
  'iloveyou',
  'monkey',
  'dragon',
  'football',
  'baseball',
  'login',
  'master',
  'princess',
  'sunshine',
];

const CHARACTER_GROUPS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?',
};

const LEET_REPLACEMENTS = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's',
  '!': 'i',
};

const normalizePredictableText = (password) =>
  password
    .toLowerCase()
    .split('')
    .map((character) => LEET_REPLACEMENTS[character] ?? character)
    .join('');

const hasRepeatedCharacters = (password) => /(.)\1{2,}/.test(password);

const getRepeatedChunkPenalty = (password) => {
  const normalized = password.toLowerCase();

  for (
    let chunkLength = 1;
    chunkLength <= Math.floor(normalized.length / 2);
    chunkLength += 1
  ) {
    const chunk = normalized.slice(0, chunkLength);

    if (
      normalized.length % chunkLength === 0 &&
      chunk.repeat(normalized.length / chunkLength) === normalized
    ) {
      return Math.min(28, 10 + normalized.length);
    }
  }

  return 0;
};

const hasSequentialPattern = (password) => {
  const normalized = password.toLowerCase();
  const sequences = [
    '0123456789',
    '9876543210',
    'abcdefghijklmnopqrstuvwxyz',
    'zyxwvutsrqponmlkjihgfedcba',
    'qwertyuiop',
    'poiuytrewq',
    'asdfghjkl',
    'lkjhgfdsa',
    'zxcvbnm',
    'mnbvcxz',
  ];

  return sequences.some((sequence) => {
    for (let i = 0; i <= sequence.length - 3; i += 1) {
      if (normalized.includes(sequence.slice(i, i + 3))) return true;
    }

    return false;
  });
};

const hasDatePattern = (password) =>
  /(?:19|20)\d{2}/.test(password) ||
  /(?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])/.test(password);

const getCharacterPoolSize = (password) => {
  let poolSize = 0;

  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/\d/.test(password)) poolSize += 10;
  if (/[\W_]/.test(password)) poolSize += 33;

  return poolSize;
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

  // Approximation assuming 10 billion offline guesses per second.
  const guesses = 2 ** entropy;
  const seconds = guesses / 10_000_000_000;

  return formatDuration(seconds);
};

const analyzePassword = (password) => {
  if (!password) {
    return {
      score: 0,
      level: 0,
      entropy: 0,
      crackTime: 'Instantly',
    };
  }

  const length = password.length;
  const normalized = normalizePredictableText(password);
  const uniqueRatio = new Set(password).size / length;
  const categoryCount = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[\W_]/.test(password),
  ].filter(Boolean).length;

  const rawEntropy =
    length * Math.log2(Math.max(getCharacterPoolSize(password), 1));

  let score = Math.min(52, length * 3.25);
  score += categoryCount * 7;
  score += Math.min(10, uniqueRatio * 12);

  if (length >= 16) score += 6;
  if (length >= 20) score += 5;
  if (length >= 24) score += 4;

  let penalty = 0;

  if (length < 8) penalty += 32;
  else if (length < 12) penalty += 14;

  if (categoryCount === 1) penalty += 16;
  else if (categoryCount === 2) penalty += 7;

  if (uniqueRatio < 0.45) penalty += 18;
  else if (uniqueRatio < 0.65) penalty += 8;

  if (hasRepeatedCharacters(password)) penalty += 12;
  penalty += getRepeatedChunkPenalty(password);

  if (hasSequentialPattern(password)) penalty += 18;
  if (hasDatePattern(password)) penalty += 10;

  if (COMMON_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    penalty += 35;
  }

  if (/^[A-Z][a-z]+\d{1,4}[!@#$%^&*]?$/.test(password)) {
    penalty += 16;
  }

  score = Math.max(0, Math.min(100, Math.round(score - penalty)));

  const effectiveEntropy = Math.max(
    0,
    Math.round(rawEntropy - penalty * 1.35 - (1 - uniqueRatio) * 22)
  );

  const level =
    score >= 90
      ? 5
      : score >= 75
        ? 4
        : score >= 55
          ? 3
          : score >= 35
            ? 2
            : score >= 18
              ? 1
              : 0;

  return {
    score,
    level,
    entropy: effectiveEntropy,
    crackTime: estimateCrackTime(effectiveEntropy),
  };
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

  const normalized = normalizePredictableText(password);

  if (COMMON_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    feedback.push('Avoid common words, even with substitutions like @ for a.');
  }

  if (getRepeatedChunkPenalty(password) > 0) {
    feedback.push('Avoid repeating the same word or character block.');
  }

  if (hasDatePattern(password)) {
    feedback.push('Avoid years, birthdays, and other recognizable dates.');
  }

  if (/^[A-Z][a-z]+\d{1,4}[!@#$%^&*]?$/.test(password)) {
    feedback.push('Avoid the predictable Word123! format.');
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

const AMBIGUOUS_CHARACTERS = new Set(['0', 'O', 'o', '1', 'I', 'l', '|']);

const getRandomCharacter = (characters) => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return characters[values[0] % characters.length];
};

const generatePassword = ({
  length = 18,
  lowercase = true,
  uppercase = true,
  numbers = true,
  symbols = true,
  avoidAmbiguous = true,
} = {}) => {
  const enabledGroups = [
    lowercase && CHARACTER_GROUPS.lowercase,
    uppercase && CHARACTER_GROUPS.uppercase,
    numbers && CHARACTER_GROUPS.numbers,
    symbols && CHARACTER_GROUPS.symbols,
  ].filter(Boolean);

  if (enabledGroups.length === 0) return '';

  const cleanGroup = (group) =>
    avoidAmbiguous
      ? [...group].filter((character) => !AMBIGUOUS_CHARACTERS.has(character)).join('')
      : group;

  const groups = enabledGroups.map(cleanGroup).filter(Boolean);
  const allCharacters = groups.join('');
  const requiredCharacters = groups.map(getRandomCharacter);

  const remainingCharacters = Array.from(
    { length: Math.max(length - requiredCharacters.length, 0) },
    () => getRandomCharacter(allCharacters)
  );

  const combined = [...requiredCharacters, ...remainingCharacters];

  for (let i = combined.length - 1; i > 0; i -= 1) {
    const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [combined[i], combined[randomIndex]] = [combined[randomIndex], combined[i]];
  }

  return combined.join('');
};

function App() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = window.localStorage.getItem('passmetric-theme');

    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;

    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  });
  const [password, setPassword] = useState('');
  const [breachCount, setBreachCount] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isCheckingBreach, setIsCheckingBreach] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGeneratorSettings, setShowGeneratorSettings] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [generatorSettings, setGeneratorSettings] = useState({
    length: 18,
    lowercase: true,
    uppercase: true,
    numbers: true,
    symbols: true,
    avoidAmbiguous: true,
  });

  const analysis = useMemo(() => analyzePassword(password), [password]);
  const { score, level, entropy, crackTime } = analysis;
  const strength = STRENGTH_LEVELS[level];
  const feedback = useMemo(() => getFeedback(password), [password]);
  const checklist = useMemo(() => buildChecklist(password), [password]);
  const uniqueCharacters = useMemo(() => new Set(password).size, [password]);
  const passwordDna = useMemo(
    () =>
      [...password].map((character, index) => ({
        id: `${character}-${index}`,
        type: /[a-z]/.test(character)
          ? 'lowercase'
          : /[A-Z]/.test(character)
            ? 'uppercase'
            : /\d/.test(character)
              ? 'number'
              : 'symbol',
      })),
    [password]
  );
  const enabledGeneratorGroups = [
    generatorSettings.lowercase,
    generatorSettings.uppercase,
    generatorSettings.numbers,
    generatorSettings.symbols,
  ].filter(Boolean).length;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('passmetric-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const updateTheme = () => {
      setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
    };
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (!document.startViewTransition || prefersReducedMotion) {
      updateTheme();
      return;
    }

    document.startViewTransition(updateTheme);
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
    setBreachCount(null);
    setCopied(false);
  };

  const handleGeneratePassword = () => {
    setPassword(generatePassword(generatorSettings));
    setBreachCount(null);
    setCopied(false);
  };


  const updateGeneratorSetting = (setting, value) => {
    setGeneratorSettings((current) => ({ ...current, [setting]: value }));
  };

  const handleInputKeyState = (event) => {
    setCapsLockOn(event.getModifierState?.('CapsLock') ?? false);
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
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            <span className="theme-toggle-icon" aria-hidden="true">
              {theme === 'dark' ? (
                <Sun key="sun" size={17} />
              ) : (
                <Moon key="moon" size={17} />
              )}
            </span>
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
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
              onKeyDown={handleInputKeyState}
              onKeyUp={handleInputKeyState}
              onBlur={() => setCapsLockOn(false)}
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

          <div className="input-meta-row">
            <span>{password.length} characters</span>
            {capsLockOn && <span className="caps-lock-warning">Caps Lock is on</span>}
          </div>

          <div className="password-actions">
            <button type="button" onClick={handleGeneratePassword}>
              <RefreshCw size={18} />
              Generate password
            </button>

            <button
              type="button"
              className={`secondary-button ${showGeneratorSettings ? 'active' : ''}`}
              onClick={() => setShowGeneratorSettings((current) => !current)}
              aria-expanded={showGeneratorSettings}
            >
              <SlidersHorizontal size={18} />
              Customize
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

          {showGeneratorSettings && (
            <div className="generator-panel">
              <div className="generator-panel-heading">
                <div>
                  <p className="section-kicker">Generator controls</p>
                  <h2>Build your password</h2>
                </div>
                <span>{generatorSettings.length} characters</span>
              </div>

              <label className="length-control" htmlFor="password-length">
                <span>Length</span>
                <input
                  id="password-length"
                  type="range"
                  min="8"
                  max="40"
                  value={generatorSettings.length}
                  onChange={(event) =>
                    updateGeneratorSetting('length', Number(event.target.value))
                  }
                />
              </label>

              <div className="generator-options">
                {[
                  ['lowercase', 'Lowercase', 'a-z'],
                  ['uppercase', 'Uppercase', 'A-Z'],
                  ['numbers', 'Numbers', '0-9'],
                  ['symbols', 'Symbols', '#!?'],
                ].map(([key, label, sample]) => (
                  <label className="generator-option" key={key}>
                    <input
                      type="checkbox"
                      checked={generatorSettings[key]}
                      disabled={generatorSettings[key] && enabledGeneratorGroups === 1}
                      onChange={(event) => updateGeneratorSetting(key, event.target.checked)}
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>{sample}</small>
                    </span>
                  </label>
                ))}

                <label className="generator-option wide-option">
                  <input
                    type="checkbox"
                    checked={generatorSettings.avoidAmbiguous}
                    onChange={(event) =>
                      updateGeneratorSetting('avoidAmbiguous', event.target.checked)
                    }
                  />
                  <span>
                    <strong>Avoid ambiguous characters</strong>
                    <small>Removes characters like O, 0, I, l, and 1</small>
                  </span>
                </label>
              </div>

              <button type="button" className="generate-now-button" onClick={handleGeneratePassword}>
                <Sparkles size={18} />
                Generate with these settings
              </button>
            </div>
          )}
        </section>

        {password && (
          <>
            <section className="strength-section">
              <div className="section-heading-row">
                <div>
                  <p className="section-kicker">Overall strength</p>
                  <h2>{strength.label}</h2>
                </div>
                <span className="score-pill">{score}/100</span>
              </div>

              <div className="strength-bar-wrapper" aria-hidden="true">
                <div
                  className="strength-bar"
                  style={{
                    width: `${score}%`,
                    backgroundColor: strength.color,
                  }}
                />
              </div>

              <div className="strength-scale" aria-hidden="true">
                {STRENGTH_LEVELS.slice(1).map((level, index) => (
                  <span
                    key={level.label}
                    className={index < level ? 'active' : ''}
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
                  <span>Unique characters</span>
                  <strong>{uniqueCharacters} of {password.length}</strong>
                </article>
              </div>

              <div className="password-dna">
                <div className="dna-heading">
                  <div>
                    <p className="section-kicker">Pattern insight</p>
                    <h2>Password DNA</h2>
                  </div>
                  <div className="dna-legend" aria-label="Password DNA legend">
                    <span className="lowercase">lowercase</span>
                    <span className="uppercase">uppercase</span>
                    <span className="number">number</span>
                    <span className="symbol">symbol</span>
                  </div>
                </div>
                <div
                  className="dna-strip"
                  role="img"
                  aria-label={`Character pattern for a ${password.length}-character password`}
                >
                  {passwordDna.map((segment) => (
                    <span key={segment.id} className={segment.type} />
                  ))}
                </div>
                <p className="dna-note">
                  A varied rhythm is harder to predict than long blocks of the same type.
                </p>
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
