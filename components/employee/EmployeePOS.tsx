import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { Product, BillItem, Bill } from '../../types';
import InvoiceModal from './InvoiceModal';
import QRScannerModal from './QRScannerModal';
import VisualScannerModal from './VisualScannerModal';
import CustomerFaceCamera from './CustomerFaceCamera';
import MarketNews from './MarketNews';
import { processVoiceCommand, analyzeImageForBilling, getSmartUpsellSuggestion } from '../../services/geminiService';

// --- PAYMENT MODAL COMPONENT ---
interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    bill: Bill;
    onConfirm: (method: 'CASH' | 'UPI' | 'NET_BANKING') => void;
    upiId?: string;
    shopName: string;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, bill, onConfirm, upiId, shopName }) => {
    const [method, setMethod] = useState<'CASH' | 'UPI' | 'NET_BANKING'>('CASH');
    const [qrError, setQrError] = useState<string | null>(null);

    // Helper to ensure QR Lib is loaded
    const ensureQrLib = async (): Promise<any> => {
        if ((window as any).QRCode) return (window as any).QRCode;
        if ((window as any).qrcode) return (window as any).qrcode;

        return new Promise((resolve, reject) => {
            console.log("QR Lib missing, attempting dynamic load...");
            const script = document.createElement('script');
            // Use a reliable CDN fallback
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.1/qrcode.min.js";
            script.async = true;
            script.onload = () => {
                console.log("QR Lib loaded dynamically");
                resolve((window as any).QRCode || (window as any).qrcode);
            };
            script.onerror = () => {
                console.error("Dynamic QR Lib load failed");
                reject(new Error("Failed to load QR library"));
            };
            document.body.appendChild(script);
        });
    };

    // Use Callback Ref to ensure canvas exists before drawing
    const qrCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
        if (node !== null && method === 'UPI' && upiId) {
            setQrError("Initializing QR...");
            
            const startGeneration = async () => {
                try {
                    const lib = await ensureQrLib();
                    if (!lib) throw new Error("Library not found");
                    generate(node, lib);
                } catch (e) {
                    console.error(e);
                    setQrError("QR Library Failed to Load. Check Internet.");
                }
            };

            startGeneration();
        }
    }, [method, upiId, bill.total, shopName]);

    const generate = (canvas: HTMLCanvasElement, lib: any) => {
        try {
             // UPI String Format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&cu=INR
             const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${bill.total.toFixed(2)}&cu=INR`;
             
             // Check if toCanvas exists (node-qrcode style)
             if (lib.toCanvas) {
                 lib.toCanvas(canvas, upiString, {
                     width: 200,
                     margin: 2,
                     color: {
                         dark: "#000000",
                         light: "#ffffff"
                     },
                     errorCorrectionLevel: 'M'
                 }, (error: any) => {
                     if (error) {
                         console.error("QR Gen Error:", error);
                         setQrError("Failed to generate QR");
                     } else {
                         setQrError(null);
                     }
                 });
             } else {
                 console.warn("Using fallback QR generation or incompatible lib");
                 setQrError("Incompatible QR Lib");
             }
        } catch (e) {
             console.error("QR Logic Error:", e);
             setQrError("Error creating QR code");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center z-[70] bg-black/80 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                <div className="bg-blue-600 p-4 text-white text-center">
                    <h2 className="text-xl font-bold">Select Payment Mode</h2>
                    <p className="text-blue-100 text-sm">Total Payable: <span className="text-white font-mono text-lg font-bold">₹{bill.total.toFixed(2)}</span></p>
                </div>
                
                <div className="p-6">
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {/* UPDATED: Cash button now immediately confirms the payment for speed */}
                        <button onClick={() => onConfirm('CASH')} className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all border-green-600 bg-green-50 text-green-700 hover:bg-green-100 hover:shadow-lg transform hover:scale-105 active:scale-95`}>
                            <span className="text-2xl">💵</span>
                            <span className="text-xs font-bold">CASH (Direct)</span>
                        </button>
                        <button onClick={() => setMethod('UPI')} className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${method === 'UPI' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            <span className="text-2xl">📱</span>
                            <span className="text-xs font-bold">UPI QR</span>
                        </button>
                        <button onClick={() => setMethod('NET_BANKING')} className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${method === 'NET_BANKING' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            <span className="text-2xl">🏦</span>
                            <span className="text-xs font-bold">BANK</span>
                        </button>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-6 min-h-[220px] flex flex-col items-center justify-center border border-gray-200">
                        {method === 'CASH' && (
                            <div className="text-center">
                                <p className="text-gray-500 mb-2">Cash Payment Selected</p>
                                <div className="text-4xl font-bold text-slate-800">₹{bill.total.toFixed(2)}</div>
                                <p className="text-xs text-green-600 mt-2 font-bold animate-pulse">Click "CASH (Direct)" above for instant bill</p>
                            </div>
                        )}

                        {method === 'UPI' && (
                            <div className="text-center flex flex-col items-center w-full">
                                {upiId ? (
                                    <>
                                        <div className="bg-white p-2 border border-gray-300 rounded-lg shadow-sm mb-3 mx-auto relative min-h-[200px] min-w-[200px] flex items-center justify-center">
                                            <canvas ref={qrCanvasRef} key="upi-qr-canvas"></canvas>
                                            {qrError && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 text-xs font-bold text-center p-2 bg-white/95">
                                                    <p>{qrError}</p>
                                                    {qrError.includes("Failed") && <button onClick={() => setMethod('CASH')} className="mt-2 text-blue-600 underline">Switch to Cash</button>}
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 font-mono mb-1">ID: {upiId}</p>
                                        <p className="text-sm font-bold text-blue-600 animate-pulse">Scan & Pay</p>
                                    </>
                                ) : (
                                    <p className="text-red-500 text-sm font-bold">UPI ID not configured in Admin Settings.</p>
                                )}
                            </div>
                        )}

                        {method === 'NET_BANKING' && (
                            <div className="text-center">
                                <p className="text-gray-500 text-sm mb-2">Record Net Banking / Card Transaction</p>
                                <div className="text-2xl font-bold text-slate-800 mb-1">₹{bill.total.toFixed(2)}</div>
                                <p className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">Verify payment in bank app manually</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-gray-100 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
                    <button onClick={() => onConfirm(method)} className="flex-[2] py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-md transition-colors flex items-center justify-center gap-2">
                        <span>✓</span> {method === 'CASH' ? 'Confirm Cash' : 'Payment Received'}
                    </button>
                </div>
            </div>
        </div>
    );
};


interface DiscountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (discount: { type: 'percentage' | 'fixed'; value: number }) => void;
    itemName: string;
}

const DiscountModal: React.FC<DiscountModalProps> = ({ isOpen, onClose, onApply, itemName }) => {
    const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
    const [value, setValue] = useState<number | ''>('');

    if (!isOpen) return null;

    const handleApply = () => {
        if (typeof value === 'number' && value >= 0) {
            onApply({ type, value });
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-[60] bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl p-6 w-80 animate-fade-in-up border border-blue-200">
                <h3 className="text-lg font-bold text-blue-900 mb-4">Discount: {itemName}</h3>
                
                <div className="flex gap-2 mb-4">
                    <label className={`flex-1 p-2 text-center rounded cursor-pointer border ${type === 'percentage' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>
                        <input type="radio" name="discount-type" value="percentage" checked={type === 'percentage'} onChange={() => setType('percentage')} className="hidden" />
                        % Percent
                    </label>
                    <label className={`flex-1 p-2 text-center rounded cursor-pointer border ${type === 'fixed' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>
                        <input type="radio" name="discount-type" value="fixed" checked={type === 'fixed'} onChange={() => setType('fixed')} className="hidden" />
                        ₹ Fixed
                    </label>
                </div>
                
                <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full p-2 border border-blue-300 rounded text-lg mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter value"
                    autoFocus
                />

                <div className="flex justify-end gap-2">
                     <button onClick={() => onApply({ type: 'fixed', value: -1 })} className="px-3 py-1 text-red-600 text-sm hover:bg-red-50 rounded">
                        Remove
                    </button>
                    <button onClick={onClose} className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                    <button onClick={handleApply} className="px-4 py-1 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">Apply</button>
                </div>
            </div>
        </div>
    );
};

const EmployeePOS: React.FC = () => {
    const { logout, products, addSale, showToast, currentUser, shopDetails } = useAppContext();
    const [currentBill, setCurrentBill] = useState<Bill>({ customerName: 'Walk-in', customerMobile: '', items: [], subtotal: 0, taxAmount: 0, total: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [invoiceReady, setInvoiceReady] = useState<Bill | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const recognitionRef = useRef<any>(null);
    
    // UI Toggles
    const [discountModal, setDiscountModal] = useState<{ isOpen: boolean; target: string | 'bill'; itemName: string } | null>(null);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    
    // Feature States
    const [selectedResultIndex, setSelectedResultIndex] = useState(0);
    const [showLiveMonitor, setShowLiveMonitor] = useState(false);
    const [showVisualScanner, setShowVisualScanner] = useState(false);
    const [isVoiceListening, setIsVoiceListening] = useState(false);
    const [upsellSuggestion, setUpsellSuggestion] = useState<string | null>(null);
    const [isProcessingVoice, setIsProcessingVoice] = useState(false);
    
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return () => { audioContextRef.current?.close(); }
    }, []);

    useEffect(() => {
        setSelectedResultIndex(0);
    }, [searchTerm]);

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return [];
        const lowerTerm = searchTerm.toLowerCase();
        return products.filter(p => 
            p.name.toLowerCase().includes(lowerTerm) || 
            p.id.toLowerCase().includes(lowerTerm) ||
            p.brand.toLowerCase().includes(lowerTerm)
        ).slice(0, 10);
    }, [products, searchTerm]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F1') { e.preventDefault(); searchInputRef.current?.focus(); }
            if (e.key === 'F2') { e.preventDefault(); setIsScannerOpen(true); }
            if (e.key === 'F3') { e.preventDefault(); toggleVoiceListening(); }
            if (e.key === 'F4') { e.preventDefault(); setShowVisualScanner(true); }
            if (e.key === 'F8') { e.preventDefault(); handleClearBill(); }
            if (e.key === 'F9') { e.preventDefault(); setShowLiveMonitor(prev => !prev); }
            
            // Checkout
            if (e.key === 'NumpadAdd' || (e.key === '+' && document.activeElement?.tagName !== 'INPUT')) {
                e.preventDefault(); 
                handleCheckout(); 
            }
            if (e.key === 'Escape') {
                if (isScannerOpen) setIsScannerOpen(false);
                else if (paymentModalOpen) setPaymentModalOpen(false);
                else searchInputRef.current?.focus();
            }
            
            // Search Grid Navigation
            if (document.activeElement === searchInputRef.current && searchTerm) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedResultIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedResultIndex(prev => Math.max(prev - 1, 0));
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredProducts.length > 0) {
                        addToBill(filteredProducts[selectedResultIndex]);
                        setSearchTerm('');
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [searchTerm, selectedResultIndex, filteredProducts, isScannerOpen, currentBill, paymentModalOpen]);

    // Upsell Logic
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (currentBill.items.length > 0) {
                const itemNames = currentBill.items.map(i => i.name);
                const suggestion = await getSmartUpsellSuggestion(itemNames);
                setUpsellSuggestion(suggestion);
            } else {
                setUpsellSuggestion(null);
            }
        }, 600);
        return () => clearTimeout(timer);
    }, [currentBill.items]);

    const playBeep = () => {
        if (audioContextRef.current) {
            const oscillator = audioContextRef.current.createOscillator();
            const gainNode = audioContextRef.current.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);
            oscillator.frequency.value = 1200;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;
            oscillator.start();
            setTimeout(() => oscillator.stop(), 100);
        }
    };

    const addToBill = (product: Product, quantity = 1, discount?: { type: 'percentage' | 'fixed'; value: number }) => {
        if (product.stock < quantity) {
            showToast(`Stock Low: ${product.name}`, 'error');
        }

        setCurrentBill(prev => {
            const existingItemIndex = prev.items.findIndex(item => item.id === product.id);
            let newItems = [...prev.items];

            if (existingItemIndex > -1) {
                const existingItem = newItems[existingItemIndex];
                newItems[existingItemIndex] = {
                    ...existingItem,
                    quantity: existingItem.quantity + quantity,
                    discount: discount || existingItem.discount
                };
            } else {
                newItems.push({ 
                    id: product.id,
                    name: product.name,
                    brand: product.brand,
                    price: product.price,
                    expireDate: product.expireDate,
                    stock: product.stock,
                    quantity, 
                    discount 
                });
            }
            playBeep();
            return calculateTotal({ ...prev, items: newItems });
        });
    };

    const handleUpdateItem = (id: string, discount: { type: 'percentage' | 'fixed'; value: number }) => {
        if (discount.value === -1) {
            removeFromBill(id);
            setDiscountModal(null);
            return;
        }
        setCurrentBill(prev => {
            const newItems = prev.items.map(item => {
                if (item.id === id) {
                    return { ...item, discount };
                }
                return item;
            });
            return calculateTotal({ ...prev, items: newItems });
        });
        setDiscountModal(null);
    };

    const removeFromBill = (productId: string) => {
        setCurrentBill(prev => {
            const newItems = prev.items.filter(item => item.id !== productId);
            return calculateTotal({ ...prev, items: newItems });
        });
    };

    const calculateTotal = (bill: Bill): Bill => {
        const subtotal = bill.items.reduce((sum, item) => {
            const gross = item.price * item.quantity;
            let discount = 0;
            if (item.discount) {
                discount = item.discount.type === 'fixed' 
                    ? item.discount.value 
                    : gross * (item.discount.value / 100);
            }
            return sum + (gross - discount);
        }, 0);

        let totalAfterDiscount = subtotal;
        if (bill.billDiscount) {
            const discountAmount = bill.billDiscount.type === 'fixed'
                ? bill.billDiscount.value
                : subtotal * (bill.billDiscount.value / 100);
            totalAfterDiscount -= discountAmount;
        }
        
        // Apply GST if Default Rate is set
        let taxAmount = 0;
        if (shopDetails.defaultGstRate && shopDetails.defaultGstRate > 0) {
            taxAmount = totalAfterDiscount * (shopDetails.defaultGstRate / 100);
        }

        const total = totalAfterDiscount + taxAmount;

        return { ...bill, subtotal, taxAmount, total: Math.max(0, total) };
    };

    const handleClearBill = () => {
        if (currentBill.items.length === 0) return;
        if (window.confirm("Clear current bill?")) {
            setCurrentBill({ customerName: 'Walk-in', customerMobile: '', items: [], subtotal: 0, taxAmount: 0, total: 0 });
        }
    };

    const handleQRScan = (data: string, keepOpen = false) => {
        let product = products.find(p => p.id === data || p.name === data);
        if (!product) {
            try {
                const parsed = JSON.parse(data);
                if (parsed.id) product = products.find(p => p.id === parsed.id);
            } catch(e) {}
        }
        if (product) {
            addToBill(product);
            if (!keepOpen) setIsScannerOpen(false);
        } else {
            showToast('Product Not Found', 'error');
        }
    };

    const handleVisualScan = async (base64Image: string) => {
        setShowVisualScanner(false);
        showToast("Analyzing...");
        const matches = await analyzeImageForBilling(base64Image, products);
        if (matches.length > 0) {
            matches.forEach(match => {
                const product = products.find(p => p.id === match.productId);
                if (product) addToBill(product, match.quantity);
            });
            showToast(`Added ${matches.length} items.`);
        } else {
            showToast("No items identified.", "error");
        }
    };

    const toggleVoiceListening = () => {
        if (isVoiceListening) {
            recognitionRef.current?.stop();
            setIsVoiceListening(false);
            return;
        }

        if (!('webkitSpeechRecognition' in window)) {
            showToast("Voice not supported", "error");
            return;
        }

        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        
        recognition.continuous = false; // Capture one command at a time for speed
        recognition.interimResults = false; // Ignore partial results, wait for completion
        recognition.lang = 'en-US';

        recognition.onstart = () => { 
            setIsVoiceListening(true); 
            showToast("🎤 Listening...", "success");
        };
        
        recognition.onend = () => { 
            setIsVoiceListening(false); 
        };
        
        recognition.onerror = (e: any) => {
            console.error(e);
            setIsVoiceListening(false);
            showToast("Voice Error. Try again.", "error");
        };

        recognition.onresult = async (event: any) => {
            const transcript = event.results[0][0].transcript;
            showToast(`Processing: "${transcript}"...`);
            setIsProcessingVoice(true);
            
            // Fast API call
            const result = await processVoiceCommand(transcript, products);
            setIsProcessingVoice(false);
            
            if (result) {
                if (result.type === 'ADD_ITEM' && result.productId) {
                    const product = products.find(p => p.id === result.productId);
                    if (product) {
                        addToBill(product, result.quantity || 1);
                        showToast(`Added ${product.name}`, "success");
                    } else {
                        showToast("Item not found", "error");
                    }
                } else if (result.type === 'CHECKOUT') {
                    handleCheckout();
                } else if (result.type === 'CLEAR_BILL') {
                    handleClearBill();
                }
            } else {
                showToast("Command not recognized", "error");
            }
        };
        
        recognition.start();
    };

    const handleCheckout = () => {
        if (currentBill.items.length === 0) {
            showToast("Add items to bill first", "error");
            return;
        }
        setPaymentModalOpen(true);
    };

    const handlePaymentComplete = (method: 'CASH' | 'UPI' | 'NET_BANKING') => {
        const finalizedBill = { ...currentBill, paymentMethod: method };
        addSale(finalizedBill);
        setInvoiceReady(finalizedBill);
        setPaymentModalOpen(false);
        setCurrentBill({ customerName: 'Walk-in', customerMobile: '', items: [], subtotal: 0, taxAmount: 0, total: 0 });
    };

    return (
        <div className="h-screen w-full bg-slate-100 flex flex-col font-sans text-sm text-slate-900">
             
             {/* 1. TOP HEADER - Dense Legacy Style */}
             <div className="bg-blue-700 text-white p-1 flex justify-between items-center shrink-0 shadow-md">
                <div className="flex items-center gap-4 px-2">
                    <span className="font-bold text-lg tracking-wide">{shopDetails.name}</span>
                    <div className="flex gap-2">
                        <span className="bg-blue-800 px-2 rounded text-xs border border-blue-600 shadow-sm flex items-center">
                            <span className="opacity-70 mr-1">POS:</span> 01
                        </span>
                        <span className="bg-blue-800 px-2 rounded text-xs border border-blue-600 shadow-sm flex items-center">
                            <span className="opacity-70 mr-1">User:</span> {currentUser?.username}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-2">
                    <div className="hidden md:block">
                        <MarketNews />
                    </div>
                    <div className="bg-blue-800 px-2 py-0.5 rounded border border-blue-600 font-mono font-bold text-xs">
                        {new Date().toLocaleDateString()}
                    </div>
                    <button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white px-3 py-0.5 rounded font-bold text-xs border border-red-800 shadow-sm">
                        LOGOUT
                    </button>
                </div>
             </div>

             {/* 2. INPUT & INFO BAR - Legacy Form Style */}
             <div className="bg-blue-100 p-2 border-b border-blue-300 grid grid-cols-12 gap-2 shrink-0">
                 {/* Input Field (F1) */}
                 <div className="col-span-8 md:col-span-6 lg:col-span-4 relative">
                     <div className="flex items-center bg-white border-2 border-blue-500 rounded h-12 shadow-inner">
                         <span className="px-3 font-bold text-blue-900 bg-blue-50 h-full flex items-center border-r border-blue-200 text-sm">SKU / F1</span>
                         <input 
                            ref={searchInputRef}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="flex-1 px-3 h-full outline-none font-bold text-xl uppercase text-slate-900 placeholder-gray-400"
                            placeholder="SCAN OR SEARCH..."
                            autoFocus
                         />
                         {searchTerm && (
                             <button onClick={() => setSearchTerm('')} className="px-3 text-gray-400 hover:text-red-600 font-bold">X</button>
                         )}
                     </div>
                     {/* Search Dropdown */}
                     {searchTerm && filteredProducts.length > 0 && (
                         <div className="absolute top-full left-0 right-0 bg-white border-2 border-blue-500 shadow-2xl z-50 max-h-80 overflow-y-auto mt-1 rounded">
                             {filteredProducts.map((p, idx) => (
                                 <div 
                                    key={p.id} 
                                    className={`p-2 flex justify-between border-b border-gray-100 cursor-pointer ${idx === selectedResultIndex ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-slate-900'}`}
                                    onClick={() => { addToBill(p); setSearchTerm(''); }}
                                 >
                                     <div>
                                         <div className="font-bold text-sm">{p.name}</div>
                                         <div className="text-xs opacity-80">{p.id} | {p.brand}</div>
                                     </div>
                                     <div className="font-bold text-md">₹{p.price}</div>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>

                 {/* Customer Info */}
                 <div className="col-span-4 md:col-span-6 lg:col-span-4 flex gap-2">
                     <div className="flex-1 bg-white border border-blue-300 rounded p-1 flex flex-col justify-center shadow-sm">
                         <label className="text-[10px] text-gray-500 uppercase font-bold px-1">Customer Name</label>
                         <input 
                            value={currentBill.customerName}
                            onChange={e => setCurrentBill({...currentBill, customerName: e.target.value})}
                            className="w-full outline-none font-semibold text-sm px-1 text-slate-900"
                         />
                     </div>
                     <div className="w-32 bg-white border border-blue-300 rounded p-1 flex flex-col justify-center shadow-sm">
                         <label className="text-[10px] text-gray-500 uppercase font-bold px-1">Mobile</label>
                         <input 
                            value={currentBill.customerMobile}
                            onChange={e => setCurrentBill({...currentBill, customerMobile: e.target.value})}
                            className="w-full outline-none font-semibold text-sm px-1 text-slate-900"
                            placeholder="Optional"
                         />
                     </div>
                 </div>

                 {/* Last Bill / Status */}
                 <div className="col-span-12 lg:col-span-4 bg-white border border-blue-300 rounded p-1 flex items-center justify-center shadow-sm">
                     {upsellSuggestion ? (
                         <div className="text-center animate-pulse flex items-center gap-2">
                             <span className="text-xs bg-yellow-300 text-yellow-900 px-1 rounded font-bold">AI TIP</span>
                             <span className="text-sm font-bold text-blue-800">{upsellSuggestion}</span>
                         </div>
                     ) : (
                         <div className="text-center text-gray-400 text-xs italic font-semibold">System Ready...</div>
                     )}
                 </div>
             </div>

             {/* 3. BILLING GRID - LEGACY TABLE STRUCTURE */}
             <div className="flex-grow bg-white border-y border-gray-300 overflow-auto relative shadow-inner">
                 <table className="w-full text-left border-collapse table-fixed">
                     <thead className="bg-blue-600 text-white sticky top-0 shadow-md z-10 text-xs uppercase">
                         <tr>
                             <th className="p-2 w-12 text-center border-r border-blue-500">#</th>
                             <th className="p-2 w-28 border-r border-blue-500">SKU / ID</th>
                             <th className="p-2 border-r border-blue-500">Description (Name & Brand)</th>
                             <th className="p-2 w-24 text-right border-r border-blue-500">Price</th>
                             <th className="p-2 w-24 text-center border-r border-blue-500">Qty</th>
                             <th className="p-2 w-20 text-center border-r border-blue-500">Disc</th>
                             <th className="p-2 w-32 text-right border-r border-blue-500">Amount</th>
                             <th className="p-2 w-12 text-center">Act</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-200 bg-white">
                         {currentBill.items.length > 0 ? (
                             currentBill.items.map((item, index) => (
                                 <tr key={item.id} className="hover:bg-blue-50 group transition-colors">
                                     <td className="p-2 text-center font-mono text-gray-500 border-r border-gray-100 text-xs">{index + 1}</td>
                                     <td className="p-2 font-mono text-xs text-gray-600 border-r border-gray-100 truncate">{item.id}</td>
                                     <td className="p-2 border-r border-gray-100">
                                         <div className="font-bold text-slate-900 text-sm truncate">{item.name}</div>
                                         <div className="text-[10px] text-gray-500">{item.brand}</div>
                                     </td>
                                     <td className="p-2 text-right font-mono text-slate-800 border-r border-gray-100">{item.price.toFixed(2)}</td>
                                     <td className="p-2 text-center border-r border-gray-100">
                                         <div className="flex items-center justify-center gap-1">
                                             <button onClick={() => addToBill(item, -1)} className="w-6 h-6 bg-gray-200 hover:bg-red-200 text-red-800 rounded font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">-</button>
                                             <span className="w-8 text-center font-bold text-slate-900">{item.quantity}</span>
                                             <button onClick={() => addToBill(item, 1)} className="w-6 h-6 bg-gray-200 hover:bg-green-200 text-green-800 rounded font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">+</button>
                                         </div>
                                     </td>
                                     <td 
                                        className="p-2 text-center text-xs text-red-600 cursor-pointer border-r border-gray-100 font-medium hover:bg-red-50 hover:underline"
                                        onClick={() => setDiscountModal({ isOpen: true, target: item.id, itemName: item.name })}
                                     >
                                         {item.discount ? (item.discount.type === 'fixed' ? `-${item.discount.value}` : `-${item.discount.value}%`) : '--'}
                                     </td>
                                     <td className="p-2 text-right font-bold font-mono text-slate-900 text-sm border-r border-gray-100">
                                         {((item.price * item.quantity) - (item.discount ? (item.discount.type==='fixed' ? item.discount.value : (item.price*item.quantity*item.discount.value/100)) : 0)).toFixed(2)}
                                     </td>
                                     <td className="p-2 text-center">
                                         <button onClick={() => removeFromBill(item.id)} className="text-gray-400 hover:text-red-600 font-bold transition-colors">✕</button>
                                     </td>
                                 </tr>
                             ))
                         ) : (
                            <tr>
                                <td colSpan={8} className="h-64 text-center align-middle">
                                    <div className="flex flex-col items-center justify-center opacity-30">
                                        <svg className="w-16 h-16 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                        <p className="text-xl font-bold text-gray-500">POS READY</p>
                                        <p className="text-sm text-gray-400">Scan Product (F2) or Search (F1)</p>
                                    </div>
                                </td>
                            </tr>
                         )}
                     </tbody>
                 </table>
             </div>

             {/* 4. TOTALS BAR - High Contrast */}
             <div className="bg-blue-100 border-t border-blue-300 p-2 flex justify-end items-center gap-6 shrink-0 shadow-inner">
                 <div className="flex flex-col items-end">
                     <span className="text-[10px] text-gray-500 uppercase font-bold">Total Items</span>
                     <span className="font-bold text-slate-800 text-xl leading-none">{currentBill.items.length}</span>
                 </div>
                 <div className="flex flex-col items-end">
                     <span className="text-[10px] text-gray-500 uppercase font-bold">Total Qty</span>
                     <span className="font-bold text-slate-800 text-xl leading-none">{currentBill.items.reduce((a,b) => a+b.quantity, 0)}</span>
                 </div>
                 <div className="h-8 w-px bg-blue-300"></div>
                 <div className="flex flex-col items-end">
                     <span className="text-[10px] text-gray-500 uppercase font-bold">Subtotal</span>
                     <span className="font-bold text-slate-800 text-xl leading-none">{currentBill.subtotal.toFixed(2)}</span>
                 </div>
                 {currentBill.billDiscount && (
                     <div className="flex flex-col items-end">
                         <span className="text-[10px] text-red-500 uppercase font-bold">Bill Disc</span>
                         <span className="font-bold text-red-600 text-xl leading-none">
                             {currentBill.billDiscount.type === 'fixed' ? `-${currentBill.billDiscount.value}` : `-${currentBill.billDiscount.value}%`}
                         </span>
                     </div>
                 )}
                 {currentBill.taxAmount > 0 && (
                     <div className="flex flex-col items-end">
                        <span className="text-[10px] text-blue-600 uppercase font-bold">GST {shopDetails.defaultGstRate}%</span>
                        <span className="font-bold text-blue-700 text-xl leading-none">+{currentBill.taxAmount.toFixed(2)}</span>
                     </div>
                 )}
                 <div className="bg-slate-900 text-green-400 px-6 py-2 rounded shadow-lg flex flex-col items-end min-w-[200px] ml-4 border border-slate-700">
                     <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Net Payable</span>
                     <span className="font-mono text-4xl font-bold leading-none">₹{currentBill.total.toFixed(2)}</span>
                 </div>
             </div>

             {/* 5. FUNCTION KEYS FOOTER - Legacy Grid */}
             <div className="bg-blue-200 p-1 shrink-0 grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1 border-t border-blue-300">
                 <button onClick={() => setIsScannerOpen(true)} className="bg-white hover:bg-blue-50 border-b-4 border-gray-300 active:border-b-0 active:mt-1 rounded p-1 flex flex-col items-center justify-center h-14 transition-all">
                     <span className="font-bold text-blue-800 text-xs bg-blue-100 px-2 rounded-full mb-1">F2</span>
                     <span className="text-xs text-gray-700 font-bold uppercase">Scan QR</span>
                 </button>
                 
                 <button onClick={toggleVoiceListening} className={`bg-white hover:bg-blue-50 border-b-4 border-gray-300 active:border-b-0 active:mt-1 rounded p-1 flex flex-col items-center justify-center h-14 transition-all ${isVoiceListening ? 'bg-red-50 border-red-300' : ''}`}>
                     <span className="font-bold text-blue-800 text-xs bg-blue-100 px-2 rounded-full mb-1">F3</span>
                     <span className={`text-xs font-bold uppercase ${isVoiceListening ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>Voice Cmd</span>
                 </button>

                 <button onClick={() => setShowVisualScanner(true)} className="bg-white hover:bg-blue-50 border-b-4 border-gray-300 active:border-b-0 active:mt-1 rounded p-1 flex flex-col items-center justify-center h-14 transition-all">
                     <span className="font-bold text-blue-800 text-xs bg-blue-100 px-2 rounded-full mb-1">F4</span>
                     <span className="text-xs text-gray-700 font-bold uppercase">Visual AI</span>
                 </button>

                 <button onClick={() => setDiscountModal({ isOpen: true, target: 'bill', itemName: 'Total Bill' })} className="bg-white hover:bg-blue-50 border-b-4 border-gray-300 active:border-b-0 active:mt-1 rounded p-1 flex flex-col items-center justify-center h-14 transition-all">
                     <span className="font-bold text-blue-800 text-xs bg-blue-100 px-2 rounded-full mb-1">F6</span>
                     <span className="text-xs text-gray-700 font-bold uppercase">Discount</span>
                 </button>

                 <button onClick={handleClearBill} className="bg-white hover:bg-red-50 border-b-4 border-red-200 active:border-b-0 active:mt-1 rounded p-1 flex flex-col items-center justify-center h-14 transition-all">
                     <span className="font-bold text-red-800 text-xs bg-red-100 px-2 rounded-full mb-1">F8</span>
                     <span className="text-xs text-red-600 font-bold uppercase">Clear</span>
                 </button>

                 <button onClick={() => setShowLiveMonitor(prev => !prev)} className={`hidden md:flex bg-white hover:bg-blue-50 border-b-4 border-gray-300 active:border-b-0 active:mt-1 rounded p-1 flex-col items-center justify-center h-14 transition-all ${showLiveMonitor ? 'border-green-400 bg-green-50' : ''}`}>
                     <span className="font-bold text-blue-800 text-xs bg-blue-100 px-2 rounded-full mb-1">F9</span>
                     <span className="text-xs text-gray-700 font-bold uppercase">Monitor</span>
                 </button>

                 <div className="hidden lg:block col-span-1"></div>

                 <button 
                    onClick={handleCheckout} 
                    className="col-span-1 md:col-span-1 bg-green-600 hover:bg-green-500 text-white border-b-4 border-green-800 active:border-b-0 active:mt-1 rounded p-1 flex flex-col items-center justify-center shadow-md h-14 transition-all"
                >
                     <span className="font-bold text-green-100 text-[10px] mb-1">NUM +</span>
                     <span className="text-sm font-black tracking-wider">CHECKOUT</span>
                 </button>
             </div>

            {/* Feature Modules */}
            <CustomerFaceCamera 
                onIdentify={(c) => { setCurrentBill(prev => ({ ...prev, customerName: c.name, customerMobile: c.mobile })); }} 
                isActive={showLiveMonitor} 
                onClose={() => setShowLiveMonitor(false)}
            />
            <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleQRScan} />
            <VisualScannerModal isOpen={showVisualScanner} onClose={() => setShowVisualScanner(false)} onCapture={handleVisualScan} isProcessing={isProcessingVoice} />
            
            {invoiceReady && <InvoiceModal bill={invoiceReady} onNewBill={() => setInvoiceReady(null)} />}
            
            {discountModal && <DiscountModal isOpen={discountModal.isOpen} onClose={() => setDiscountModal(null)} onApply={(d) => { if (discountModal.target === 'bill') { setCurrentBill(prev => calculateTotal({ ...prev, billDiscount: d })); setDiscountModal(null); } else { handleUpdateItem(discountModal.target, d); } }} itemName={discountModal.itemName} />}
            
            {paymentModalOpen && <PaymentModal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} bill={currentBill} onConfirm={handlePaymentComplete} upiId={shopDetails.upiId} shopName={shopDetails.name} />}
        </div>
    );
};

export default EmployeePOS;