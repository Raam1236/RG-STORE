
import type { Dispatch, SetStateAction } from 'react';

export enum Role {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
}

export interface User {
  id: string;
  username: string;
  password?: string; // Optional: In Cloud mode, we rely on Auth provider, not storing it locally/in-doc
  role: Role;
}

export interface StockLogEntry {
  id: string;
  date: string; // ISO string
  change: number; // positive for addition, negative for removal
  previousStock: number;
  newStock: number;
  reason: string; // e.g., "Restock", "Sale", "Correction", "Manual Update"
  userId: string; // ID of the user who made the change
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  expireDate: string; // YYYY-MM-DD
  stock: number;
  stockHistory?: StockLogEntry[];
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  loyaltyPoints: number; // Legacy points, can serve as 'tier' points
  walletBalance: number; // Actual currency for redemption
  isMember: boolean; // Membership status
  photo?: string; // Base64 string of the customer's face
  faceAttributes?: string; // AI description (e.g., "Male, approx 30s, glasses")
}

export interface BillItem extends Product {
  quantity: number;
  discount?: {
    type: 'percentage' | 'fixed';
    value: number;
  };
}

export interface Sale {
  id: string;
  date: string; // ISO string
  items: BillItem[];
  total: number;
  employeeId: string;
  customerName?: string;
  customerMobile?: string;
  paymentMethod?: 'CASH' | 'UPI' | 'NET_BANKING';
  taxAmount?: number;
  walletRedeemed?: number; // Amount paid via wallet
  walletEarned?: number; // 5% cashback earned
}

export interface ShopDetails {
  name: string;
  address: string;
  contact: string;
  // Payment & Tax
  upiId?: string; // VPA for QR generation
  gstNumber?: string;
  defaultGstRate?: number; // Percentage
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    ifscCode: string;
  };
}

export interface Bill {
  customerName: string;
  customerMobile: string;
  items: BillItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  paymentMethod?: 'CASH' | 'UPI' | 'NET_BANKING';
  billDiscount?: {
    type: 'percentage' | 'fixed';
    value: number;
  };
}

export interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  logout: () => void;
  products: Product[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  sales: Sale[];
  addSale: (bill: Bill) => void;
  shopDetails: ShopDetails;
  updateShopDetails: (details: ShopDetails) => void;
  employees: User[];
  setEmployees: Dispatch<SetStateAction<User[]>>;
  customers: Customer[];
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}
