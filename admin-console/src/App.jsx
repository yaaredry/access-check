import { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import People from './pages/People';
import Users from './pages/Users';
import Stats from './pages/Stats';
import Layout from './components/Layout';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp && Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const t = localStorage.getItem('token');
    if (t && isTokenExpired(t)) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      return null;
    }
    return t;
  });
  const [username, setUsername] = useState(() => localStorage.getItem('username'));

  function signIn(tok, user) {
    localStorage.setItem('token', tok);
    localStorage.setItem('username', user);
    setToken(tok);
    setUsername(user);
  }

  function signOut() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUsername(null);
  }

  return <AuthCtx.Provider value={{ token, username, signIn, signOut }}>{children}</AuthCtx.Provider>;
}

function RequireAuth({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/people" replace />} />
            <Route path="people" element={<People />} />
            <Route path="users" element={<Users />} />
            <Route path="stats" element={<Stats />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
