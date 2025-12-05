import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import LoadingScreen from './pages/LoadingScreen';
import Login from './pages/Login';
import Home from './pages/Home';
import Rewards from './pages/Rewards';
import Collections from './pages/Collections';
import Promotions from './pages/Promotions';
import Profile from './pages/Profile';
import ClaimHistory from './pages/ClaimHistory';
import QRCodeView from './pages/QRCodeView';
import MyVouchers from './pages/MyVouchers';

function PrivateRoute({ children }) {
  const { user, token, fetchUser } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token && !user) {
      fetchUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, user, fetchUser]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  const { fetchUser, token } = useAuthStore();
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      if (token) {
        await fetchUser();
      }
      // Show loading screen for at least 1.5 seconds on initial load
      setTimeout(() => {
        setInitialLoading(false);
      }, 1500);
    };
    
    initializeApp();
  }, [token, fetchUser]);

  if (initialLoading) {
    return (
      <div className="mobile-container" style={{ position: 'relative', padding: 0 }}>
        <LoadingScreen />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="mobile-container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            }
          />
          <Route
            path="/rewards"
            element={
              <PrivateRoute>
                <Rewards />
              </PrivateRoute>
            }
          />
          <Route
            path="/collections"
            element={
              <PrivateRoute>
                <Collections />
              </PrivateRoute>
            }
          />
          <Route
            path="/promotions"
            element={
              <PrivateRoute>
                <Promotions />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
          <Route
            path="/claim-history"
            element={
              <PrivateRoute>
                <ClaimHistory />
              </PrivateRoute>
            }
          />
                <Route
                  path="/qr"
                  element={
                    <PrivateRoute>
                      <QRCodeView />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/vouchers"
                  element={
                    <PrivateRoute>
                      <MyVouchers />
                    </PrivateRoute>
                  }
                />
              </Routes>
            </div>
          </BrowserRouter>
        );
      }

export default App;

