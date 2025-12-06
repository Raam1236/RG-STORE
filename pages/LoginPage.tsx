
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { User, Role } from '../types';
import database from '../services/database';

// Icons
const AdminIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
const EmployeeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const BackIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>;

const LoginPage: React.FC = () => {
  const { setCurrentUser, showToast, setIsLoading } = useAppContext();
  
  // States: 'checking' -> 'create_admin' OR 'selection' -> 'login_admin'/'login_employee' -> 'forgot_password'
  const [view, setView] = useState<'checking' | 'create_admin' | 'selection' | 'login_admin' | 'login_employee' | 'forgot_password'>('checking');
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
      const checkAdmin = async () => {
          // Check for existing admin logic
          if (!database.isCloud) {
              // In Local mode (SQLite sim), we check table_users for an ADMIN role
              const users = JSON.parse(localStorage.getItem('table_users') || '[]');
              const hasAdmin = users.some((u: any) => u.role === 'ADMIN');
              
              if (!hasAdmin) {
                  setView('create_admin');
              } else {
                  setView('selection');
              }
          } else {
              setView('selection');
          }
      };
      checkAdmin();
  }, []);

  const triggerError = (message: string) => {
    setError(message);
    setIsShaking(true);
    setTimeout(() => {
        setIsShaking(false);
    }, 820);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const isAdminAttempt = view === 'login_admin';

    try {
        const user = await database.login(username, password);
        
        if (user) {
            // Strict Role Check based on Portal
            if (isAdminAttempt && user.role !== Role.ADMIN) {
                triggerError('Access Denied: This account does not have Admin privileges.');
            } else if (!isAdminAttempt && user.role !== Role.EMPLOYEE) {
                triggerError('Access Denied: This account is not authorized for POS.');
            } else {
                setCurrentUser(user);
                showToast(`Welcome back, ${user.username}!`);
            }
        } else {
            triggerError('Invalid credentials. Please try again.');
        }
    } catch (e) {
        triggerError('Login failed. Please check your connection.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      setIsLoading(true);
      const newAdmin: User = { id: 'temp', username, role: Role.ADMIN }; // ID assigned by service
      const success = await database.registerAdmin(newAdmin, password);
      setIsLoading(false);
      
      if (success) {
          // Auto login after creation
          const user = await database.login(username, password);
          if (user) setCurrentUser(user);
          showToast('Admin account created successfully!');
      } else {
          triggerError("Failed to create admin. Username might be taken.");
      }
    } else {
        triggerError("Username and password cannot be empty.");
    }
  };

  const handleRecoverAccount = async (e: React.FormEvent) => {
      e.preventDefault();
      // Hardcoded Recovery Key for this Local App version
      if (recoveryKey === 'RGcreation') {
          if (newPassword.length < 4) {
              triggerError("New Password must be at least 4 characters.");
              return;
          }
          
          const success = await database.recoverLocalAdmin(newPassword);
          if (success) {
              showToast("Admin account recovered! Username reset to 'admin'.");
              setView('login_admin');
              setUsername('admin');
              setPassword('');
          } else {
              triggerError("Recovery failed. Cloud mode not supported for this method.");
          }
      } else {
          triggerError("Invalid Recovery Key.");
      }
  };

  const handleBackToSelection = () => {
      setError('');
      setUsername('');
      setPassword('');
      setView('selection');
  };

  // --- Render Helpers ---

  const renderCreateAdminForm = () => (
    <div className="animate-fade-in-down w-full max-w-md bg-surface p-8 rounded-lg shadow-2xl">
        <form onSubmit={handleCreateAdmin} className="space-y-6">
        <div className="text-center">
            <h2 className="text-2xl font-bold text-on-primary">Setup Shop Admin</h2>
            <p className="text-sm text-on-surface/70 mt-2">
                {database.isCloud ? "Create your Cloud Admin login." : "Create the main owner account for this device."}
            </p>
        </div>
        <div>
            <label className="block text-sm font-medium text-on-surface">Admin Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3 mt-1 bg-background border border-on-surface/20 rounded-md focus:ring-2 focus:ring-primary focus:border-primary text-on-surface transition-all duration-300" required autoFocus />
        </div>
        <div>
            <label className="block text-sm font-medium text-on-surface">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 mt-1 bg-background border border-on-surface/20 rounded-md focus:ring-2 focus:ring-primary focus:border-primary text-on-surface transition-all duration-300" required />
        </div>
        {error && <p className={`text-red-500 dark:text-red-400 text-sm text-center ${isShaking ? 'animate-shake' : ''}`}>{error}</p>}
        <button type="submit" className="w-full py-3 px-4 bg-primary text-on-primary font-semibold rounded-md hover:bg-indigo-500 transition-colors duration-300 shadow-lg">Create Admin Account</button>
        </form>
    </div>
  );

  const renderPortalSelection = () => (
      <div className="animate-fade-in-down w-full max-w-2xl">
          <h2 className="text-3xl font-bold text-center text-on-surface mb-8">Select Login Portal</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Admin Card */}
              <button 
                onClick={() => setView('login_admin')}
                className="flex flex-col items-center justify-center p-8 bg-surface rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-on-surface/10 group"
              >
                  <div className="bg-primary/10 p-4 rounded-full group-hover:bg-primary/20 transition-colors">
                    <span className="text-primary"><AdminIcon /></span>
                  </div>
                  <h3 className="text-xl font-bold text-on-surface mt-4">Admin Dashboard</h3>
                  <p className="text-sm text-on-surface/60 mt-2 text-center">Manage products, prices, employees, and view analytics.</p>
              </button>

              {/* Employee Card */}
              <button 
                onClick={() => setView('login_employee')}
                className="flex flex-col items-center justify-center p-8 bg-surface rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-on-surface/10 group"
              >
                  <div className="bg-secondary/10 p-4 rounded-full group-hover:bg-secondary/20 transition-colors">
                    <span className="text-secondary"><EmployeeIcon /></span>
                  </div>
                  <h3 className="text-xl font-bold text-on-surface mt-4">Employee POS</h3>
                  <p className="text-sm text-on-surface/60 mt-2 text-center">Billing, inventory checks, and customer handling.</p>
              </button>
          </div>
      </div>
  );

  const renderLoginForm = () => {
      const isAdmin = view === 'login_admin';
      return (
        <div className="animate-fade-in-down w-full max-w-md bg-surface p-8 rounded-lg shadow-2xl relative">
            <button 
                onClick={handleBackToSelection} 
                className="absolute top-4 left-4 text-on-surface/60 hover:text-primary transition-colors flex items-center text-sm font-medium"
            >
                <BackIcon /> Back
            </button>

            <div className="text-center mb-6 mt-4">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${isAdmin ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                    {isAdmin ? <AdminIcon /> : <EmployeeIcon />}
                </div>
                <h2 className="text-2xl font-bold text-on-surface">{isAdmin ? 'Admin Login' : 'Employee Login'}</h2>
                <p className="text-sm text-on-surface/60">Please enter your credentials</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-on-surface">
                        {isAdmin && database.isCloud ? "Email Address" : "Username / ID"}
                    </label>
                    <input 
                        type="text" 
                        value={username} 
                        onChange={e => setUsername(e.target.value)} 
                        className="w-full p-3 mt-1 bg-background border border-on-surface/20 rounded-md focus:ring-2 focus:ring-primary focus:border-primary text-on-surface transition-all duration-300" 
                        autoFocus
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-on-surface">Password</label>
                    <input 
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        className="w-full p-3 mt-1 bg-background border border-on-surface/20 rounded-md focus:ring-2 focus:ring-primary focus:border-primary text-on-surface transition-all duration-300" 
                    />
                </div>
                {error && <p className={`text-red-500 dark:text-red-400 text-sm text-center ${isShaking ? 'animate-shake' : ''}`}>{error}</p>}
                
                <button 
                    type="submit" 
                    className={`w-full py-3 px-4 text-on-primary font-semibold rounded-md transition-colors duration-300 shadow-md ${isAdmin ? 'bg-primary hover:bg-indigo-600' : 'bg-secondary hover:bg-green-600'}`}
                >
                    {isAdmin ? 'Access Dashboard' : 'Open POS Terminal'}
                </button>
            </form>
            
            {isAdmin && !database.isCloud && (
                <div className="text-center mt-4">
                    <button onClick={() => setView('forgot_password')} className="text-xs text-primary hover:underline">
                        Forgot Password?
                    </button>
                </div>
            )}
        </div>
      );
  };
  
  const renderForgotPassword = () => (
      <div className="animate-fade-in-down w-full max-w-md bg-surface p-8 rounded-lg shadow-2xl relative">
          <button 
              onClick={() => setView('login_admin')} 
              className="absolute top-4 left-4 text-on-surface/60 hover:text-primary transition-colors flex items-center text-sm font-medium"
          >
              <BackIcon /> Cancel
          </button>
          
          <div className="text-center mb-6 mt-4">
               <h2 className="text-xl font-bold text-on-surface">Recover Admin Account</h2>
               <p className="text-sm text-on-surface/60 mt-2">Enter the Master Recovery Key provided by your developer.</p>
          </div>
          
          <form onSubmit={handleRecoverAccount} className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-on-surface">Recovery Code</label>
                  <input 
                      type="password" 
                      value={recoveryKey} 
                      onChange={e => setRecoveryKey(e.target.value)} 
                      placeholder="Enter Master Key"
                      className="w-full p-3 mt-1 bg-background border border-on-surface/20 rounded-md text-on-surface" 
                  />
              </div>
              <div>
                  <label className="block text-sm font-medium text-on-surface">New Admin Password</label>
                  <input 
                      type="text" 
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      placeholder="Set new password"
                      className="w-full p-3 mt-1 bg-background border border-on-surface/20 rounded-md text-on-surface" 
                  />
              </div>
               {error && <p className={`text-red-500 dark:text-red-400 text-sm text-center ${isShaking ? 'animate-shake' : ''}`}>{error}</p>}
               <button 
                  type="submit" 
                  className="w-full py-3 px-4 bg-orange-500 text-white font-semibold rounded-md hover:bg-orange-600 transition-colors duration-300 shadow-md"
              >
                  Reset Account
              </button>
          </form>
      </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 flex-col">
        {/* Header Branding */}
        <div className="mb-8 text-center animate-fade-in-down">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                RG Shop Billing Pro
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
                {database.isCloud ? (
                    <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs font-bold border border-green-500/20">● Cloud Database</span>
                ) : (
                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-bold border border-yellow-500/20">● Local Mode</span>
                )}
            </div>
        </div>

        {/* Main Content Area */}
        {view === 'checking' && <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>}
        {view === 'create_admin' && renderCreateAdminForm()}
        {view === 'selection' && renderPortalSelection()}
        {(view === 'login_admin' || view === 'login_employee') && renderLoginForm()}
        {view === 'forgot_password' && renderForgotPassword()}

        {/* Footer */}
        {!database.isCloud && view !== 'checking' && (
            <p className="mt-8 text-xs text-on-surface/40 text-center max-w-sm">
                Running in Local Mode using Simulated SQLite. All data is stored securely in this browser instance.
            </p>
        )}
    </div>
  );
};

export default LoginPage;
