import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import AgentPage from './pages/AgentPage';
import ProductsPage from './pages/ProductsPage';
import ComparePage from './pages/ComparePage';
import CartPage from './pages/CartPage';
import RecommendationsPage from './pages/RecommendationsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OtpPage from './pages/OtpPage';
import { cartAPI } from './services/api';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages that require a logged-in, verified user. Anything not in this list
// (landing, login, register, otp) is publicly reachable.
const PROTECTED_PAGES = new Set(['dashboard', 'agent', 'products', 'compare', 'deals', 'cart']);

function AppInner() {
  const { isAuthenticated, isReady, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState('landing');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingOtp, setPendingOtp] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);

  const [cart, setCart] = useState({
    items: [],
    subtotal: 0.0,
    delivery_fee: 0.0,
    total: 0.0,
    ai_suggestion: "Loading suggestions..."
  });
  
  // Shared state to allow pages to navigate and execute queries automatically
  const [agentPrompt, setAgentPrompt] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Load cart state once the user is authenticated (cart endpoints require login)
  useEffect(() => {
    if (!isAuthenticated) return;
    async function loadCart() {
      try {
        const data = await cartAPI.get();
        setCart(data);
      } catch (err) {
        console.error("Could not fetch cart items. Backend might be offline:", err);
      }
    }
    loadCart();
  }, [isAuthenticated]);

  // Route guard: bounce unauthenticated users away from protected pages,
  // and drop stale cart state on logout.
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated && PROTECTED_PAGES.has(currentPage)) {
      setCurrentPage('login');
      setCart({ items: [], subtotal: 0.0, delivery_fee: 0.0, total: 0.0, ai_suggestion: "Loading suggestions..." });
    }
  }, [isReady, isAuthenticated, currentPage]);

  const handleLogout = async () => {
    await logout();
    setCurrentPage('landing');
  };

  const totalCartCount = cart.items.reduce((acc, item) => acc + item.quantity, 0);

  // Don't render protected pages until we've confirmed auth state (prevents a
  // flash of the dashboard before a refresh-time redirect kicks in).
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="h-8 w-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderPage = () => {
    if (PROTECTED_PAGES.has(currentPage) && !isAuthenticated) {
      return <LoginPage setCurrentPage={setCurrentPage} />;
    }
    switch (currentPage) {
      case 'landing':
        return <LandingPage setCurrentPage={setCurrentPage} />;
      case 'login':
        return <LoginPage setCurrentPage={setCurrentPage} />;
      case 'register':
        return (
          <RegisterPage
            setCurrentPage={setCurrentPage}
            setPendingEmail={setPendingEmail}
            setPendingOtp={setPendingOtp}
            setIsDemoMode={setIsDemoMode}
          />
        );
      case 'otp':
        return (
          <OtpPage
            setCurrentPage={setCurrentPage}
            pendingEmail={pendingEmail}
            pendingOtp={pendingOtp}
            setPendingOtp={setPendingOtp}
            isDemoMode={isDemoMode}
          />
        );
      case 'dashboard':
        return (
          <Dashboard
            cart={cart}
            setCurrentPage={setCurrentPage}
            setAgentPrompt={setAgentPrompt}
            setCategoryFilter={setCategoryFilter}
          />
        );
      case 'agent':
        return (
          <AgentPage
            initialPrompt={agentPrompt}
            setInitialPrompt={setAgentPrompt}
            updateCart={setCart}
          />
        );
      case 'products':
        return (
          <ProductsPage
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            updateCart={setCart}
          />
        );
      case 'compare':
        return <ComparePage updateCart={setCart} />;
      case 'deals':
        return (
          <RecommendationsPage
            updateCart={setCart}
            setCurrentPage={setCurrentPage}
            setAgentPrompt={setAgentPrompt}
          />
        );
      case 'cart':
        return (
          <CartPage
            cart={cart}
            updateCart={setCart}
            setCurrentPage={setCurrentPage}
            setAgentPrompt={setAgentPrompt}
          />
        );
      default:
        return <LandingPage setCurrentPage={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <div>
        <Navbar 
          currentPage={currentPage} 
          setCurrentPage={setCurrentPage} 
          cartCount={totalCartCount}
          onLogout={handleLogout}
        />
        <main className="max-w-7xl mx-auto w-full">
          {renderPage()}
        </main>
      </div>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
