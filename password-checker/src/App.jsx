import { useState } from 'react';
import './App.css';
import sha1 from 'js-sha1';
import { Eye, EyeOff } from 'lucide-react';

// Strength scoring helper
const getScore = (pwd) => {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[\W_]/.test(pwd)) score++;
  return score;
};

const getBarColor = (score) => {
  if (score <= 2) return '#ff4d4d';          // red
  if (score === 3 || score === 4) return '#facc15'; // yellow
  return '#4ade80';                          // green
};

function App() {
  const [password, setPassword] = useState('');
  const [strength, setStrength] = useState('');
  const [breachCount, setBreachCount] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const pwd = e.target.value;
    setPassword(pwd);
    setStrength(checkStrength(pwd));
    setBreachCount(null);
  };

  const checkStrength = (pwd) => {
    const score = getScore(pwd);
    const levels = ["Very Weak", "Weak", "Okay", "Strong", "Very Strong", "Excellent"];
    return levels[score];
  };

  const checkBreach = async () => {
    if (!password) return;

    const hash = sha1(password).toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    try {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
      const text = await response.text();

      const lines = text.split('\n');
      const match = lines.find(line => line.startsWith(suffix));
      const count = match ? parseInt(match.split(':')[1]) : 0;

      setBreachCount(count);
    } catch (error) {
      console.error('Error checking breach:', error);
      setBreachCount(-1);
    }
  };

  return (
    <div className="wrapper">
      <div className="container">
        <h1>Password Strength & Breach Checker 🔐</h1>

        <div className="password-wrapper">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={handleChange}
          />
          <button
            type="button"
            className="toggle-password"
            onClick={() => setShowPassword(prev => !prev)}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {password && (
          <>
            <p><strong>Strength:</strong> {strength}</p>
            <div className="strength-bar-wrapper">
              <div
                className="strength-bar"
                style={{
                  width: `${(getScore(password) / 5) * 100}%`,
                  backgroundColor: getBarColor(getScore(password))
                }}
              ></div>
            </div>
          </>
        )}

        <button onClick={checkBreach}>
          Check Breach
        </button>

        {breachCount !== null && breachCount >= 0 && (
          <p className={breachCount > 0 ? 'breach-alert' : 'breach-safe'}>
            {breachCount > 0
              ? `⚠️ This password has appeared in ${breachCount.toLocaleString()} breach${breachCount > 1 ? 'es' : ''}!`
              : '✅ This password has not appeared in any known breaches.'}
          </p>
        )}

        {breachCount === -1 && (
          <p className="breach-error">
            ⚠️ Error checking breach status. Please try again later.
          </p>
        )}
      </div>

      <footer className="footer">
        <p>Created by Zohaib S. Khan</p>
      </footer>
    </div>
  );
}

export default App;