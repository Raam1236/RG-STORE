
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updatePassword } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc,
  updateDoc, 
  query, 
  where, 
  serverTimestamp, 
  Timestamp,
  orderBy,
  limit
} from "firebase/firestore";
import { firebaseConfig, isFirebaseConfigured } from "./firebaseConfig";
import { Product, Sale, Customer, User, Role, ShopDetails } from "../types";

// --- Configuration ---
const isCloud = isFirebaseConfigured();

// --- Firebase Initialization (Cloud Mode) ---
let auth: any = null;
let db: any = null;

if (isCloud) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase Connected");
  } catch (error) {
    console.error("Firebase Initialization Error:", error);
  }
}

// --- SQLite Simulation (Local Mode) ---
// OPTIMIZED: Uses In-Memory Cache to prevent slow JSON.parse() on every operation

class SQLiteSimulator {
    // In-memory cache
    private cache: { [key: string]: any[] } = {};
    private shopDetailsCache: ShopDetails | null = null;
    
    constructor() {
        this.init();
    }

    private init() {
        // Initialize tables if missing
        if (!localStorage.getItem('table_users')) localStorage.setItem('table_users', JSON.stringify([]));
        if (!localStorage.getItem('table_products')) localStorage.setItem('table_products', JSON.stringify([]));
        if (!localStorage.getItem('table_sales')) localStorage.setItem('table_sales', JSON.stringify([]));
        if (!localStorage.getItem('table_customers')) localStorage.setItem('table_customers', JSON.stringify([]));
        if (!localStorage.getItem('table_shop_details')) localStorage.setItem('table_shop_details', JSON.stringify(null));

        // Load into memory (RAM) for speed
        this.cache['table_users'] = this.loadFromDisk('table_users');
        this.cache['table_products'] = this.loadFromDisk('table_products');
        this.cache['table_sales'] = this.loadFromDisk('table_sales');
        this.cache['table_customers'] = this.loadFromDisk('table_customers');
        
        const details = localStorage.getItem('table_shop_details');
        this.shopDetailsCache = details ? JSON.parse(details) : null;
    }

    private loadFromDisk(tableName: string): any[] {
        const data = localStorage.getItem(tableName);
        return data ? JSON.parse(data) : [];
    }

    // Helper to get table data (READ from RAM)
    private getTable(tableName: string): any[] {
        return this.cache[tableName] || [];
    }

    // Helper to save table data (WRITE to RAM & Disk)
    private saveTable(tableName: string, data: any[]) {
        this.cache[tableName] = data; // Update RAM immediately
        // Async write to disk to not block UI (simulated)
        setTimeout(() => {
            localStorage.setItem(tableName, JSON.stringify(data));
        }, 0);
    }

    // 2. FUNCTIONS FOR LOGIN SYSTEM (Ported from Python)
    register_user(username: string, password: string): boolean {
        const users = this.getTable('table_users');
        
        if (users.find((u: any) => u.username === username)) {
            return false;
        }

        const newUser = {
            id: users.length + 1,
            username,
            password,
            role: 'ADMIN'
        };

        // Mutation must be careful with reference, best to clone or push
        const newUsers = [...users, newUser]; 
        this.saveTable('table_users', newUsers);
        return true;
    }

    check_login(username: string, password: string): User | null {
        const users = this.getTable('table_users');
        const user = users.find((u: any) => u.username === username && u.password === password);
        
        if (user) {
            return {
                id: user.id.toString(),
                username: user.username,
                role: (user.role as Role) || Role.EMPLOYEE
            };
        }
        return null;
    }

    save_employee(user: User, password?: string) {
        const users = [...this.getTable('table_users')];
        const existingIndex = users.findIndex((u: any) => u.username === user.username);

        if (existingIndex >= 0) {
            users[existingIndex] = { ...users[existingIndex], ...user, password: password || users[existingIndex].password };
        } else {
            users.push({
                id: users.length + 1,
                username: user.username,
                password: password || '1234',
                role: Role.EMPLOYEE
            });
        }
        this.saveTable('table_users', users);
    }

    get_all_employees(): User[] {
        const users = this.getTable('table_users');
        return users
            .filter((u: any) => u.role === Role.EMPLOYEE)
            .map((u: any) => ({ id: u.id.toString(), username: u.username, role: Role.EMPLOYEE }));
    }
    
    delete_user(userId: string) {
        let users = this.getTable('table_users');
        users = users.filter((u: any) => u.id.toString() !== userId);
        this.saveTable('table_users', users);
    }

    update_user_credentials(userId: string, newUsername?: string, newPassword?: string): boolean {
        const users = [...this.getTable('table_users')];
        const index = users.findIndex((u: any) => u.id.toString() === userId);
        
        if (index !== -1) {
            if (newUsername) users[index].username = newUsername;
            if (newPassword) users[index].password = newPassword;
            this.saveTable('table_users', users);
            return true;
        }
        return false;
    }

    recover_admin(newPassword: string): boolean {
        const users = [...this.getTable('table_users')];
        const adminIndex = users.findIndex((u: any) => u.role === 'ADMIN');
        
        if (adminIndex >= 0) {
            users[adminIndex].username = 'admin'; 
            users[adminIndex].password = newPassword;
            this.saveTable('table_users', users);
            return true;
        } else {
            return this.register_user('admin', newPassword);
        }
    }

    // 3. FUNCTIONS FOR PRODUCTS
    add_product(product: Product) {
        const products = [...this.getTable('table_products')];
        const existingIndex = products.findIndex((p: any) => p.id === product.id);

        const row = {
            id: product.id,
            product_name: product.name,
            price: product.price,
            quantity: product.stock,
            brand: product.brand,
            expireDate: product.expireDate,
            stockHistory: product.stockHistory
        };

        if (existingIndex >= 0) {
            products[existingIndex] = row;
        } else {
            products.push(row);
        }

        this.saveTable('table_products', products);
    }

    get_all_products(): Product[] {
        const rows = this.getTable('table_products');
        return rows.map((row: any) => ({
            id: row.id,
            name: row.product_name,
            price: row.price,
            stock: row.quantity,
            brand: row.brand || 'Generic',
            expireDate: row.expireDate || '',
            stockHistory: row.stockHistory || []
        }));
    }

    delete_product(productId: string) {
        let products = this.getTable('table_products');
        products = products.filter((p: any) => p.id !== productId);
        this.saveTable('table_products', products);
    }

    get_all_sales(): Sale[] {
        return this.getTable('table_sales');
    }

    add_sale(sale: Sale) {
        const sales = [...this.getTable('table_sales')];
        sales.push(sale);
        this.saveTable('table_sales', sales);
    }

    get_all_customers(): Customer[] {
        return this.getTable('table_customers');
    }

    save_customer(customer: Customer) {
        const customers = [...this.getTable('table_customers')];
        const index = customers.findIndex((c: any) => c.id === customer.id);
        if (index >= 0) customers[index] = customer;
        else customers.push(customer);
        this.saveTable('table_customers', customers);
    }
    
    delete_customer(id: string) {
        let customers = this.getTable('table_customers');
        customers = customers.filter((c: any) => c.id !== id);
        this.saveTable('table_customers', customers);
    }

    get_shop_details(): ShopDetails | null {
        return this.shopDetailsCache;
    }

    save_shop_details(details: ShopDetails) {
        this.shopDetailsCache = details;
        localStorage.setItem('table_shop_details', JSON.stringify(details));
    }

    export_database(): string {
        const data = {
            users: this.getTable('table_users'),
            products: this.getTable('table_products'),
            sales: this.getTable('table_sales'),
            customers: this.getTable('table_customers'),
            shop_details: this.shopDetailsCache
        };
        return JSON.stringify(data, null, 2);
    }

    import_database(jsonData: string): boolean {
        try {
            const data = JSON.parse(jsonData);
            if (data.users) this.saveTable('table_users', data.users);
            if (data.products) this.saveTable('table_products', data.products);
            if (data.sales) this.saveTable('table_sales', data.sales);
            if (data.customers) this.saveTable('table_customers', data.customers);
            if (data.shop_details) this.save_shop_details(data.shop_details);
            return true;
        } catch (e) {
            console.error("Import failed", e);
            return false;
        }
    }
}

const sqlite = new SQLiteSimulator();

// --- Helper for Invoice Number ---
const generateInvoiceNumber = () => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const timeStr = now.getTime().toString().slice(-6);
  return `RG-INV-${dateStr}-${timeStr}`;
};

const database = {
  isCloud,

  // --- Auth ---
  async login(usernameOrEmail: string, password: string): Promise<User | null> {
    if (isCloud) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, usernameOrEmail, password);
        const fbUser = userCredential.user;
        const userDocRef = doc(db, "users", fbUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          return { id: fbUser.uid, username: userData.username || userData.displayName || fbUser.email, role: userData.role as Role };
        } else {
            return { id: fbUser.uid, username: fbUser.email?.split('@')[0] || 'User', role: Role.EMPLOYEE };
        }
      } catch (error) {
        console.error("Cloud Login Error:", error);
        return null;
      }
    } else {
      return sqlite.check_login(usernameOrEmail, password);
    }
  },

  async registerAdmin(user: User, password: string): Promise<boolean> {
    if (isCloud) {
      try {
        const email = user.username.includes('@') ? user.username : `${user.username}@rgshop.com`;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const fbUser = userCredential.user;
        await setDoc(doc(db, "users", fbUser.uid), {
          id: fbUser.uid, email: email, username: user.username, displayName: user.username, role: Role.ADMIN, createdAt: serverTimestamp()
        });
        return true;
      } catch (error) {
        console.error("Cloud Register Error:", error);
        return false;
      }
    } else {
      return sqlite.register_user(user.username, password);
    }
  },
  
  async recoverLocalAdmin(newPassword: string): Promise<boolean> {
      if (isCloud) return false;
      return sqlite.recover_admin(newPassword);
  },

  async updateCurrentUserCredentials(userId: string, newUsername?: string, newPassword?: string): Promise<boolean> {
      if (isCloud) {
         try {
             const user = auth.currentUser;
             if (user && user.uid === userId) {
                 if (newPassword) await updatePassword(user, newPassword);
                 if (newUsername) {
                     await updateDoc(doc(db, "users", userId), { username: newUsername });
                 }
                 return true;
             }
             return false;
         } catch (e) {
             console.error("Cloud update error", e);
             return false;
         }
      } else {
          return sqlite.update_user_credentials(userId, newUsername, newPassword);
      }
  },
  
  async logout() {
      if (isCloud && auth) await signOut(auth);
  },

  // --- Products ---
  async getProducts(): Promise<Product[]> {
    if (isCloud) {
      // Optimizing Firestore Read
      const querySnapshot = await getDocs(collection(db, "products"));
      return querySnapshot.docs.map(docData => {
         const data = docData.data();
         return { 
             id: docData.id, 
             name: data.name,
             brand: data.brand,
             price: data.currentPrice || data.basePrice || 0,
             expireDate: data.expireDate || '', 
             stock: data.stock || 0,
             stockHistory: data.stockHistory || []
         } as Product;
      });
    } else {
      return sqlite.get_all_products();
    }
  },

  async saveProduct(product: Product): Promise<void> {
    if (isCloud) {
      const docRef = doc(db, "products", product.id);
      const productData = {
          name: product.name,
          brand: product.brand,
          basePrice: product.price, 
          currentPrice: product.price,
          stock: product.stock,
          expireDate: product.expireDate,
          stockHistory: product.stockHistory || [],
          qrCodeData: `rgstore://product/${product.id}`,
          lastPriceUpdate: serverTimestamp(),
      };
      await setDoc(docRef, productData, { merge: true }); 
    } else {
      sqlite.add_product(product);
    }
  },
  
  async deleteProduct(productId: string): Promise<void> {
      if (isCloud) await deleteDoc(doc(db, "products", productId));
      else sqlite.delete_product(productId);
  },

  // --- Sales ---
  async getSales(limitCount?: number): Promise<Sale[]> {
    if (isCloud) {
      let q;
      // Optimize Cloud: If limit provided (e.g. for dashboard recent activity), use it.
      // Note: We normally need ALL sales for total revenue stats. 
      // For now, we order by date to ensure consistency.
      if (limitCount) {
         q = query(collection(db, "sales"), orderBy("saleDate", "desc"), limit(limitCount));
      } else {
         q = query(collection(db, "sales"), orderBy("saleDate", "desc"));
      }
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(docData => {
          const data = docData.data();
          return {
              id: docData.id,
              date: data.saleDate instanceof Timestamp ? data.saleDate.toDate().toISOString() : data.saleDate,
              items: data.items.map((i: any) => ({ id: i.productId, name: i.name, brand: i.brand, price: i.unitPrice, quantity: i.quantity })),
              total: data.totalAmount,
              employeeId: data.generatedByEmployeeId,
              customerName: data.customerName,
              customerMobile: data.customerMobile
          } as Sale;
      });
    } else {
      const sales = sqlite.get_all_sales();
      return sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  },

  async addSale(sale: Sale): Promise<void> {
    if (isCloud) {
      const invoiceNumber = generateInvoiceNumber();
      const shopDetails = await this.getShopDetails();
      const saleRecord = {
        invoiceNumber: invoiceNumber,
        saleDate: serverTimestamp(),
        customerName: sale.customerName || "Walk-in Customer",
        customerMobile: sale.customerMobile || null,
        items: sale.items.map(item => ({
            productId: item.id, name: item.name, brand: item.brand, unitPrice: item.price, quantity: item.quantity, totalItemPrice: item.price * item.quantity
        })),
        totalAmount: sale.total,
        generatedByEmployeeId: sale.employeeId,
        shopDetails: shopDetails || { name: "RG Shop" },
        thankYouMessage: "THANK YOU ❣️",
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, "sales", sale.id), saleRecord);
    } else {
      sqlite.add_sale(sale);
    }
  },

  // --- Customers ---
  async getCustomers(): Promise<Customer[]> {
    if (isCloud) {
      const querySnapshot = await getDocs(collection(db, "customers"));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    } else {
      return sqlite.get_all_customers();
    }
  },

  async saveCustomer(customer: Customer): Promise<void> {
    if (isCloud) await setDoc(doc(db, "customers", customer.id), customer, { merge: true });
    else sqlite.save_customer(customer);
  },
  
  async deleteCustomer(customerId: string): Promise<void> {
      if (isCloud) await deleteDoc(doc(db, "customers", customerId));
      else sqlite.delete_customer(customerId);
  },

  // --- Employees ---
  async getEmployees(): Promise<User[]> {
    if (isCloud) {
       const q = query(collection(db, "users"), where("role", "==", Role.EMPLOYEE));
       const querySnapshot = await getDocs(q);
       return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    } else {
      return sqlite.get_all_employees();
    }
  },

  async saveEmployee(user: User, password?: string): Promise<void> {
      if (isCloud) {
          await setDoc(doc(db, "users", user.id), { ...user, password, createdAt: serverTimestamp() }); 
      } else {
          sqlite.save_employee(user, password);
      }
  },
  
  async deleteEmployee(userId: string): Promise<void> {
      if(isCloud) await deleteDoc(doc(db, "users", userId));
      else sqlite.delete_user(userId);
  },

  // --- Shop Details ---
  async getShopDetails(): Promise<ShopDetails | null> {
    if (isCloud) {
        const docRef = doc(db, "settings", "shop_details");
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() as ShopDetails : null;
    } else {
        return sqlite.get_shop_details();
    }
  },

  async saveShopDetails(details: ShopDetails): Promise<void> {
    if (isCloud) await setDoc(doc(db, "settings", "shop_details"), details);
    else sqlite.save_shop_details(details);
  },

  // --- Backup / Restore ---
  async backupData(): Promise<string> {
      if(isCloud) return "Backup not available for Cloud mode directly.";
      return sqlite.export_database();
  },

  async restoreData(jsonData: string): Promise<boolean> {
      if(isCloud) return false;
      return sqlite.import_database(jsonData);
  }
};

export default database;
