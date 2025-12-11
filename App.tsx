
import React, { useState, useEffect, useCallback } from 'react';
import { Role, User, Product, Bill, ShopDetails, Sale, Customer, StockLogEntry } from './types';
import { AppContext } from './hooks/AppContext';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './components/admin/AdminDashboard';
import EmployeePOS from './components/employee/EmployeePOS';
import Toast from './components/Toast';
import database from './services/database';

// Initial Mock Data (used only if local storage/db is empty)
const initialShopDetails: ShopDetails = {
  name: "RG General Store",
  address: "123 Market St, Commerce City",
  contact: "555-123-4567"
};

// 100+ Realistic Indian Grocery Products
const initialProductsMock: Product[] = [
    // --- Dairy & Bread ---
    { id: 'd1', name: 'Milk (Nandini Blue)', brand: 'Nandini', price: 24.00, expireDate: '2026-02-01', stock: 50 },
    { id: 'd2', name: 'Milk (Nandini Green)', brand: 'Nandini', price: 28.00, expireDate: '2026-02-01', stock: 40 },
    { id: 'd3', name: 'Curd (500g)', brand: 'Nandini', price: 30.00, expireDate: '2026-02-01', stock: 25 },
    { id: 'd4', name: 'Paneer (200g)', brand: 'Amul', price: 95.00, expireDate: '2026-02-01', stock: 15 },
    { id: 'd5', name: 'Butter (100g)', brand: 'Amul', price: 58.00, expireDate: '2026-02-01', stock: 30 },
    { id: 'd6', name: 'Cheese Slices', brand: 'Amul', price: 140.00, expireDate: '2026-02-01', stock: 20 },
    { id: 'd7', name: 'Bread (White)', brand: 'Modern', price: 45.00, expireDate: '2026-02-01', stock: 40 },
    { id: 'd8', name: 'Bread (Brown)', brand: 'Britannia', price: 50.00, expireDate: '2026-02-01', stock: 25 },
    { id: 'd9', name: 'Eggs (Dozen)', brand: 'Farm Fresh', price: 84.00, expireDate: '2026-02-01', stock: 60 },
    
    // --- Staples (Rice, Atta, Dal) ---
    { id: 's1', name: 'Sona Masoori Rice (1kg)', brand: 'Royal', price: 65.00, expireDate: '2026-02-01', stock: 200 },
    { id: 's2', name: 'Basmati Rice (1kg)', brand: 'India Gate', price: 120.00, expireDate: '2026-02-01', stock: 100 },
    { id: 's3', name: 'Atta (5kg)', brand: 'Aashirvaad', price: 245.00, expireDate: '2026-02-01', stock: 50 },
    { id: 's4', name: 'Atta (1kg)', brand: 'Pillsbury', price: 55.00, expireDate: '2026-02-01', stock: 80 },
    { id: 's5', name: 'Toor Dal (1kg)', brand: 'Tata Sampann', price: 160.00, expireDate: '2026-02-01', stock: 100 },
    { id: 's6', name: 'Moong Dal (1kg)', brand: 'Loose', price: 110.00, expireDate: '2026-02-01', stock: 80 },
    { id: 's7', name: 'Chana Dal (1kg)', brand: 'Loose', price: 90.00, expireDate: '2026-02-01', stock: 70 },
    { id: 's8', name: 'Urad Dal (1kg)', brand: 'Tata Sampann', price: 150.00, expireDate: '2026-02-01', stock: 60 },
    { id: 's9', name: 'Sugar (1kg)', brand: 'Madhur', price: 48.00, expireDate: '2026-02-01', stock: 150 },
    { id: 's10', name: 'Jaggery (1kg)', brand: 'Organic', price: 80.00, expireDate: '2026-02-01', stock: 40 },
    { id: 's11', name: 'Salt (1kg)', brand: 'Tata Salt', price: 28.00, expireDate: '2026-02-01', stock: 200 },
    { id: 's12', name: 'Rava / Sooji (500g)', brand: 'Naga', price: 35.00, expireDate: '2026-02-01', stock: 45 },
    { id: 's13', name: 'Maida (500g)', brand: 'Naga', price: 32.00, expireDate: '2026-02-01', stock: 45 },
    { id: 's14', name: 'Poha (1kg)', brand: 'Loose', price: 50.00, expireDate: '2026-02-01', stock: 60 },

    // --- Oils & Ghee ---
    { id: 'o1', name: 'Sunflower Oil (1L)', brand: 'Sunpure', price: 145.00, expireDate: '2026-02-01', stock: 100 },
    { id: 'o2', name: 'Sunflower Oil (1L)', brand: 'Gold Winner', price: 148.00, expireDate: '2026-02-01', stock: 80 },
    { id: 'o3', name: 'Groundnut Oil (1L)', brand: 'Freedom', price: 190.00, expireDate: '2026-02-01', stock: 40 },
    { id: 'o4', name: 'Mustard Oil (1L)', brand: 'Fortune', price: 160.00, expireDate: '2026-02-01', stock: 30 },
    { id: 'o5', name: 'Ghee (500ml)', brand: 'Nandini', price: 320.00, expireDate: '2026-02-01', stock: 50 },
    { id: 'o6', name: 'Ghee (200ml)', brand: 'GRB', price: 150.00, expireDate: '2026-02-01', stock: 40 },

    // --- Spices & Masalas ---
    { id: 'sp1', name: 'Chilli Powder (100g)', brand: 'Everest', price: 45.00, expireDate: '2026-02-01', stock: 100 },
    { id: 'sp2', name: 'Turmeric Powder (100g)', brand: 'Everest', price: 35.00, expireDate: '2026-02-01', stock: 100 },
    { id: 'sp3', name: 'Coriander Powder (100g)', brand: 'MTR', price: 40.00, expireDate: '2026-02-01', stock: 80 },
    { id: 'sp4', name: 'Garam Masala (50g)', brand: 'Everest', price: 38.00, expireDate: '2026-02-01', stock: 90 },
    { id: 'sp5', name: 'Chicken Masala (50g)', brand: 'Eastern', price: 40.00, expireDate: '2026-02-01', stock: 70 },
    { id: 'sp6', name: 'Sambar Powder (100g)', brand: 'MTR', price: 55.00, expireDate: '2026-02-01', stock: 100 },
    { id: 'sp7', name: 'Jeera / Cumin (100g)', brand: 'Loose', price: 60.00, expireDate: '2026-02-01', stock: 50 },
    { id: 'sp8', name: 'Mustard Seeds (100g)', brand: 'Loose', price: 20.00, expireDate: '2026-02-01', stock: 60 },
    { id: 'sp9', name: 'Pepper (50g)', brand: 'Loose', price: 55.00, expireDate: '2026-02-01', stock: 40 },

    // --- Snacks & Biscuits ---
    { id: 'sn1', name: 'Maggi Noodles (Single)', brand: 'Nestle', price: 14.00, expireDate: '2026-02-01', stock: 500 },
    { id: 'sn2', name: 'Maggi Noodles (4-Pack)', brand: 'Nestle', price: 56.00, expireDate: '2026-02-01', stock: 100 },
    { id: 'sn3', name: 'Good Day Butter', brand: 'Britannia', price: 30.00, expireDate: '2026-02-01', stock: 120 },
    { id: 'sn4', name: 'Marie Gold', brand: 'Britannia', price: 25.00, expireDate: '2026-02-01', stock: 150 },
    { id: 'sn5', name: 'Parle-G', brand: 'Parle', price: 10.00, expireDate: '2026-02-01', stock: 300 },
    { id: 'sn6', name: 'Oreo (Original)', brand: 'Cadbury', price: 35.00, expireDate: '2026-02-01', stock: 100 },
    { id: 'sn7', name: 'Dark Fantasy', brand: 'Sunfeast', price: 40.00, expireDate: '2026-02-01', stock: 80 },
    { id: 'sn8', name: 'Lays Classic Salted', brand: 'Lays', price: 20.00, expireDate: '2026-02-01', stock: 100 },
    { id: 'sn9', name: 'Lays Magic Masala', brand: 'Lays', price: 20.00, expireDate: '2026-02-01', stock: 150 },
    { id: 'sn10', name: 'Kurkure Masala Munch', brand: 'Pepsico', price: 20.00, expireDate: '2026-02-01', stock: 140 },
    { id: 'sn11', name: 'Bhujia Sev (200g)', brand: 'Haldirams', price: 55.00, expireDate: '2026-02-01', stock: 60 },
    
    // --- Beverages ---
    { id: 'b1', name: 'Tea Powder (250g)', brand: 'Red Label', price: 140.00, expireDate: '2026-02-01', stock: 50 },
    { id: 'b2', name: 'Tea Powder (250g)', brand: '3 Roses', price: 160.00, expireDate: '2026-02-01', stock: 45 },
    { id: 'b3', name: 'Coffee Powder (50g)', brand: 'Nescafe', price: 180.00, expireDate: '2026-02-01', stock: 60 },
    { id: 'b4', name: 'Coffee Powder (50g)', brand: 'Bru', price: 165.00, expireDate: '2026-02-01', stock: 65 },
    { id: 'b5', name: 'Boost (500g)', brand: 'Nestle', price: 280.00, expireDate: '2026-02-01', stock: 30 },
    { id: 'b6', name: 'Horlicks (500g)', brand: 'GSK', price: 290.00, expireDate: '2026-02-01', stock: 30 },
    { id: 'b7', name: 'Coca Cola (750ml)', brand: 'Coke', price: 40.00, expireDate: '2026-02-01', stock: 80 },
    { id: 'b8', name: 'Sprite (750ml)', brand: 'Coke', price: 40.00, expireDate: '2026-02-01', stock: 70 },
    { id: 'b9', name: 'Maaza (600ml)', brand: 'Coke', price: 38.00, expireDate: '2026-02-01', stock: 90 },

    // --- Personal Care ---
    { id: 'pc1', name: 'Lux Soap', brand: 'Unilever', price: 32.00, expireDate: '2026-02-01', stock: 100 },
    { id: 'pc2', name: 'Santoor Soap', brand: 'Wipro', price: 34.00, expireDate: '2026-02-01', stock: 120 },
    { id: 'pc3', name: 'Lifebuoy Soap', brand: 'Unilever', price: 28.00, expireDate: '2026-02-01', stock: 110 },
    { id: 'pc4', name: 'Dove Soap', brand: 'Unilever', price: 55.00, expireDate: '2026-02-01', stock: 60 },
    { id: 'pc5', name: 'Colgate Toothpaste (100g)', brand: 'Colgate', price: 60.00, expireDate: '2026-02-01', stock: 100 },
    { id: 'pc6', name: 'Close Up (100g)', brand: 'Unilever', price: 58.00, expireDate: '2026-02-01', stock: 80 },
    { id: 'pc7', name: 'Clinic Plus Shampoo (80ml)', brand: 'Unilever', price: 45.00, expireDate: '2026-02-01', stock: 50 },
    { id: 'pc8', name: 'Head & Shoulders (80ml)', brand: 'P&G', price: 90.00, expireDate: '2026-02-01', stock: 40 },
    { id: 'pc9', name: 'Coconut Oil (200ml)', brand: 'Parachute', price: 95.00, expireDate: '2026-02-01', stock: 60 },

    // --- Household ---
    { id: 'h1', name: 'Rin Bar', brand: 'Unilever', price: 20.00, expireDate: '2026-02-01', stock: 150 },
    { id: 'h2', name: 'Vim Bar', brand: 'Unilever', price: 20.00, expireDate: '2026-02-01', stock: 150 },
    { id: 'h3', name: 'Surf Excel Powder (1kg)', brand: 'Unilever', price: 140.00, expireDate: '2026-02-01', stock: 80 },
    { id: 'h4', name: 'Tide Powder (1kg)', brand: 'P&G', price: 120.00, expireDate: '2026-02-01', stock: 80 },
    { id: 'h5', name: 'Harpic Toilet Cleaner', brand: 'Reckitt', price: 95.00, expireDate: '2026-02-01', stock: 40 },
    { id: 'h6', name: 'Lizol Floor Cleaner', brand: 'Reckitt', price: 110.00, expireDate: '2026-02-01', stock: 40 },
    { id: 'h7', name: 'Comfort Fabric Conditioner', brand: 'Unilever', price: 220.00, expireDate: '2026-02-01', stock: 20 },

    // --- Vegetables (Mock IDs) ---
    { id: 'v1', name: 'Potatoes (1kg)', brand: 'Farm Fresh', price: 45.00, expireDate: '2026-02-01', stock: 200 },
    { id: 'v2', name: 'Onions (1kg)', brand: 'Farm Fresh', price: 50.00, expireDate: '2026-02-01', stock: 200 },
    { id: 'v3', name: 'Tomatoes (1kg)', brand: 'Farm Fresh', price: 30.00, expireDate: '2026-02-01', stock: 100 },
    { id: 'v4', name: 'Green Chillies (250g)', brand: 'Farm Fresh', price: 20.00, expireDate: '2026-02-01', stock: 50 },
    { id: 'v5', name: 'Coriander Bunch', brand: 'Farm Fresh', price: 15.00, expireDate: '2026-02-01', stock: 40 },
    { id: 'v6', name: 'Carrots (500g)', brand: 'Farm Fresh', price: 35.00, expireDate: '2026-02-01', stock: 60 },
    
    // --- Dry Fruits ---
    { id: 'df1', name: 'Cashews / Kaju (100g)', brand: 'Good Life', price: 120.00, expireDate: '2026-02-01', stock: 50 },
    { id: 'df2', name: 'Almonds / Badam (100g)', brand: 'Good Life', price: 110.00, expireDate: '2026-02-01', stock: 50 },
    { id: 'df3', name: 'Raisins / Kishmish (100g)', brand: 'Good Life', price: 60.00, expireDate: '2026-02-01', stock: 60 },
    
    // --- Pooja Items ---
    { id: 'po1', name: 'Agarbatti (Pack)', brand: 'Cycle', price: 20.00, expireDate: '2026-02-01', stock: 100 },
    { id: 'po2', name: 'Camphor / Kapoor', brand: 'Cycle', price: 40.00, expireDate: '2026-02-01', stock: 80 },
    { id: 'po3', name: 'Oil Lamp Wicks', brand: 'Local', price: 10.00, expireDate: '2026-02-01', stock: 200 },
];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('rg_current_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [shopDetails, setShopDetails] = useState<ShopDetails>(initialShopDetails);
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('rg_theme') as 'light' | 'dark' | null;
    return savedTheme || 'dark';
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // --- Data Loading ---
  useEffect(() => {
    const loadCriticalData = async () => {
      setIsLoading(true);
      try {
        // 1. Load Critical Data First (Products, Shop Details, Employees)
        // This ensures the POS can be usable almost immediately
        const [loadedProducts, loadedShop, loadedEmployees] = await Promise.all([
          database.getProducts(),
          database.getShopDetails(),
          database.getEmployees()
        ]);

        if (loadedProducts.length === 0 && !database.isCloud) {
            setProducts(initialProductsMock);
            initialProductsMock.forEach(p => database.saveProduct(p));
        } else {
            setProducts(loadedProducts);
        }

        if (loadedShop) setShopDetails(loadedShop);
        setEmployees(loadedEmployees);
        
        // 2. Unblock UI - App is now interactive
        setIsLoading(false);

        // 3. Load Heavy Data in Background (Sales, Customers)
        // Use timeout to push this to next tick
        setTimeout(async () => {
             try {
                const [loadedSales, loadedCustomers] = await Promise.all([
                    database.getSales(),
                    database.getCustomers()
                ]);
                setSales(loadedSales);
                setCustomers(loadedCustomers);
             } catch (bgError) {
                 console.error("Background data load error", bgError);
             }
        }, 100);

      } catch (error) {
        console.error("Critical Data load error", error);
        showToast("Error loading critical data", "error");
        setIsLoading(false);
      }
    };

    loadCriticalData();
  }, []);

  // --- Persistence Wrappers ---
  
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('rg_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('rg_current_user');
    }
  }, [currentUser]);
  
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('rg_theme', theme);
  }, [theme]);


  const handleSetCurrentUser = (user: User | null) => {
    setCurrentUser(user);
    if (!user) {
        database.logout();
    }
  };
  
  const handleSetTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
  };

  const logout = () => {
    handleSetCurrentUser(null);
  };

  const addSale = useCallback(async (bill: Bill) => {
    if (!currentUser) return;
    const newSale: Sale = {
      id: `sale_${Date.now()}`,
      date: new Date().toISOString(),
      items: bill.items,
      total: bill.total,
      employeeId: currentUser.id,
      customerName: bill.customerName,
      customerMobile: bill.customerMobile
    };

    // Optimistic Update: Update UI instantly
    setSales(prev => [...prev, newSale]);
    
    // Async DB update
    database.addSale(newSale).catch(err => console.error("Failed to sync sale", err));
    
    // Optimistic Stock Update
    const updatedProducts = [...products];
    for (const item of bill.items) {
        const productIndex = updatedProducts.findIndex(p => p.id === item.id);
        if (productIndex !== -1) {
            const product = { ...updatedProducts[productIndex] };
            const previousStock = product.stock;
            const newStock = product.stock - item.quantity;
            product.stock = newStock;

            const logEntry: StockLogEntry = {
                id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                date: new Date().toISOString(),
                change: -item.quantity,
                previousStock: previousStock,
                newStock: newStock,
                reason: 'Sale',
                userId: currentUser.id
            };
            product.stockHistory = [...(product.stockHistory || []), logEntry];
            updatedProducts[productIndex] = product;
            
            // Async DB Save
            database.saveProduct(product).catch(err => console.error("Failed to sync stock", err));
        }
    }
    setProducts(updatedProducts);

  }, [currentUser, products]);

  const updateShopDetails = useCallback(async (details: ShopDetails) => {
    setShopDetails(details);
    await database.saveShopDetails(details);
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const renderContent = () => {
    if (!currentUser) {
      return <LoginPage />;
    }
    if (currentUser.role === Role.ADMIN) {
      return <AdminDashboard />;
    }
    if (currentUser.role === Role.EMPLOYEE) {
      return <EmployeePOS />;
    }
    return <LoginPage />;
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      setCurrentUser: handleSetCurrentUser,
      logout,
      products,
      setProducts, 
      sales,
      addSale,
      shopDetails,
      updateShopDetails,
      employees,
      setEmployees,
      customers,
      setCustomers,
      theme,
      setTheme: handleSetTheme,
      isLoading,
      setIsLoading,
      showToast
    }}>
      <div className="min-h-screen bg-background">
        {/* Status Bar */}
        <div className={`h-1 w-full ${database.isCloud ? 'bg-green-500' : 'bg-yellow-500'}`} title={database.isCloud ? "Connected to Cloud Database" : "Local Mode (Data saved in browser)"}></div>
        {renderContent()}
      </div>
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AppContext.Provider>
  );
};

export default App;
