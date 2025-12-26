
import React, { useRef, useState, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { Customer } from '../../types';
import { analyzeCustomerFace, identifyCustomerFromImage } from '../../services/geminiService';

interface CustomerFaceCameraProps {
    onIdentify: (customer: Customer) => void;
    isActive?: boolean; // New prop to control camera state
    onClose?: () => void;
}

interface VisitorLog {
    id: string;
    slNo: number;
    name: string;
    mobile: string;
    image: string; // Base64
    timestamp: string;
    note: string;
}

const CustomerFaceCamera: React.FC<CustomerFaceCameraProps> = ({ onIdentify, isActive = true, onClose }) => {
    const { customers, setCustomers, showToast } = useAppContext();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [permissionError, setPermissionError] = useState(false);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    
    // Window Position & Drag State
    const [position, setPosition] = useState({ x: window.innerWidth - 300, y: window.innerHeight - 350 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    
    // Auto Capture & Monitoring State
    const [waitingTimer, setWaitingTimer] = useState(0);
    const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>(() => {
        const saved = localStorage.getItem('rg_visitor_logs');
        return saved ? JSON.parse(saved) : [];
    });
    
    // Registration State
    const [isRegistering, setIsRegistering] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerMobile, setNewCustomerMobile] = useState('');
    const [faceAttributes, setFaceAttributes] = useState('');

    // Handle Active State Changes
    useEffect(() => {
        if (isActive && !isMinimized) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isActive, isMinimized, facingMode]); // Re-run when facingMode changes

    useEffect(() => {
        // Timer Logic
        const interval = setInterval(() => {
            if (isActive && !isMinimized && stream) {
                setWaitingTimer(prev => prev + 1);
            } else {
                setWaitingTimer(0);
            }
        }, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [isActive, isMinimized, stream]);

    useEffect(() => {
        localStorage.setItem('rg_visitor_logs', JSON.stringify(visitorLogs));
    }, [visitorLogs]);

    // Drag Logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.current.x,
                    y: e.clientY - dragOffset.current.y
                });
            }
        };
        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only allow drag from the header
        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    // Auto Capture Logic: If waiting time > 2 minutes (120s)
    useEffect(() => {
        if (waitingTimer === 120) { 
             autoCapture("Customer Waiting > 2 Mins");
        }
    }, [waitingTimer]);

    const startCamera = async () => {
        // If stream exists and we are just toggling visibility, we might not need to restart,
        // but if facingMode changed, we must restart. 
        // For simplicity, we restart if stream is null or if called by effect.
        if (stream) {
            stopCamera();
        }

        if (!isActive) return;

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: facingMode } 
            });
            setStream(mediaStream);
            setPermissionError(false);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err: any) {
            console.error("Live Monitor Camera Error:", err);
            setPermissionError(true);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const toggleCameraFlip = (e: React.MouseEvent) => {
        e.stopPropagation();
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    const captureFrame = (): string | null => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                const { videoWidth, videoHeight } = videoRef.current;
                canvasRef.current.width = videoWidth;
                canvasRef.current.height = videoHeight;
                // Flip horizontally if user facing for mirror effect (optional, but standard for preview)
                // But for raw capture data, we usually want natural orientation.
                context.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);
                return canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];
            }
        }
        return null;
    };
    
    const autoCapture = (reason: string) => {
        const image = captureFrame();
        if (image) {
            const newLog: VisitorLog = {
                id: `visit_${Date.now()}`,
                slNo: visitorLogs.length + 1,
                name: "Unknown / Waiting",
                mobile: "-",
                image: image,
                timestamp: new Date().toLocaleString(),
                note: reason
            };
            setVisitorLogs(prev => [newLog, ...prev]);
            showToast("📸 Auto-captured waiting customer photo.");
        }
    };

    const handleRegisterStart = async () => {
        if (permissionError) {
             showToast("Camera permission denied.", "error");
             return;
        }
        const image = captureFrame();
        if (image) {
            setCapturedImage(image);
            setIsRegistering(true);
            const attrs = await analyzeCustomerFace(image);
            setFaceAttributes(attrs);
        }
    };

    const handleSaveNewCustomer = () => {
        if (!newCustomerName || !newCustomerMobile) {
            showToast("Name and Mobile are required.", "error");
            return;
        }

        const newCustomer: Customer = {
            id: `cust_${Date.now()}`,
            name: newCustomerName,
            mobile: newCustomerMobile,
            loyaltyPoints: 0,
            walletBalance: 0,
            isMember: false,
            photo: capturedImage || undefined,
            faceAttributes: faceAttributes
        };

        setCustomers(prev => [...prev, newCustomer]);
        
        if (capturedImage) {
            const newLog: VisitorLog = {
                id: `visit_${Date.now()}`,
                slNo: visitorLogs.length + 1,
                name: newCustomerName,
                mobile: newCustomerMobile,
                image: capturedImage,
                timestamp: new Date().toLocaleString(),
                note: "Registration"
            };
            setVisitorLogs(prev => [newLog, ...prev]);
        }

        showToast("Face Registered Successfully!");
        onIdentify(newCustomer);
        
        setIsRegistering(false);
        setCapturedImage(null);
        setNewCustomerName('');
        setNewCustomerMobile('');
        setFaceAttributes('');
        setWaitingTimer(0);
    };

    const handleScanFace = async () => {
        if (permissionError) {
             showToast("Camera permission denied.", "error");
             return;
        }
        const image = captureFrame();
        if (!image) return;

        showToast("Scanning face...");
        
        try {
            // Use Gemini AI to identify based on face attributes matching
            const matchedId = await identifyCustomerFromImage(image, customers);
            
            if (matchedId) {
                const customer = customers.find(c => c.id === matchedId);
                if (customer) {
                    showToast(`Face Match Found: ${customer.name}`);
                    onIdentify(customer);
                    setWaitingTimer(0);
                } else {
                    showToast("ID matched but customer record missing.", "error");
                }
            } else {
                 showToast("No matching face found. Please Register.", "error");
                 handleRegisterStart();
            }
        } catch (e) {
            console.error(e);
            showToast("Identification failed.", "error");
        }
    };
    
    const exportData = () => {
         let html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Visitors</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
            <body>
            <table border="1">
                <thead>
                    <tr>
                        <th>SL. NO</th>
                        <th>Customer Name</th>
                        <th>Mobile Number</th>
                        <th>Timestamp</th>
                        <th>Note</th>
                        <th>Image</th>
                    </tr>
                </thead>
                <tbody>
         `;

         visitorLogs.forEach(log => {
             html += `
                <tr>
                    <td>${log.slNo}</td>
                    <td>${log.name}</td>
                    <td>${log.mobile}</td>
                    <td>${log.timestamp}</td>
                    <td>${log.note}</td>
                    <td height="100" width="100">
                        <img src="data:image/jpeg;base64,${log.image}" width="80" height="80" />
                    </td>
                </tr>
             `;
         });

         html += `</tbody></table></body></html>`;

         const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = 'Visitor_Log_With_Images.xls';
         a.click();
    };

    // Style for the floating window
    const windowStyle: React.CSSProperties = {
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 50,
        // When minimized, fixed size. When open, resizeable.
        width: isMinimized ? '200px' : undefined,
        height: isMinimized ? '40px' : undefined,
        resize: isMinimized ? 'none' : 'both',
        overflow: 'hidden',
        minWidth: '200px',
        minHeight: '40px',
        display: isActive ? 'flex' : 'none', // Directly control visibility
    };

    return (
        <div 
            style={windowStyle}
            className={`bg-black border-2 border-primary rounded-lg shadow-2xl flex flex-col transition-shadow duration-200`}
        >
            <div 
                className="bg-primary px-2 py-1 flex justify-between items-center cursor-move flex-shrink-0 select-none" 
                onMouseDown={handleMouseDown}
            >
                <span className="text-white text-xs font-bold flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${waitingTimer > 60 ? 'bg-red-500 animate-ping' : 'bg-green-500 animate-pulse'}`}></span>
                    Live Monitor
                </span>
                <div className="flex items-center gap-2">
                    {/* Camera Flip Button */}
                    {!isMinimized && (
                         <button 
                            className="text-white hover:bg-white/20 p-1 rounded" 
                            onClick={toggleCameraFlip}
                            title="Flip Camera"
                            onMouseDown={(e) => e.stopPropagation()} // Prevent drag
                         >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    )}
                    <span 
                        className="text-white text-xs cursor-pointer px-2 hover:bg-white/20 rounded" 
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                        title={isMinimized ? "Expand" : "Minimize"}
                    >
                        {isMinimized ? 'MAX' : 'MIN'}
                    </span>
                    <button 
                        className="text-white hover:bg-red-500/80 p-1 rounded transition-colors"
                        onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}
                        title="Close Monitor"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <div className="p-2 flex flex-col gap-2 flex-grow overflow-hidden bg-gray-900 h-full w-full">
                    <div className="relative w-full flex-grow bg-black rounded overflow-hidden group min-h-[150px]">
                        {!isActive ? (
                             <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                                <span className="text-2xl mb-2">⏸️</span>
                                <span className="text-xs font-bold">Paused for other camera use</span>
                            </div>
                        ) : permissionError ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 p-4 text-center">
                                <span className="text-2xl mb-2">🚫</span>
                                <span className="text-xs font-bold">Camera Permission Denied</span>
                                <button onClick={() => { setPermissionError(false); startCamera(); }} className="mt-2 bg-gray-700 px-2 py-1 rounded text-xs text-white">Retry</button>
                            </div>
                        ) : (
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                className={`w-full h-full object-cover transform ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} // Mirror if user facing
                            />
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 flex-shrink-0">
                        <button onClick={handleRegisterStart} disabled={permissionError || !isActive} className="bg-blue-600 hover:bg-blue-500 text-white text-xs py-1 px-2 rounded disabled:opacity-50">
                            + Register
                        </button>
                        <button onClick={handleScanFace} disabled={permissionError || !isActive} className="bg-green-600 hover:bg-green-500 text-white text-xs py-1 px-2 rounded disabled:opacity-50">
                            Scan Face (AI)
                        </button>
                    </div>
                     <button onClick={exportData} className="bg-gray-700 hover:bg-gray-600 text-white text-[10px] py-1 px-2 rounded w-full flex-shrink-0">
                        Download Excel (With Images)
                    </button>
                    <div className="text-[10px] text-gray-400 text-center select-none">
                        Drag corner to resize • Drag header to move
                    </div>
                </div>
            )}

            {isRegistering && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]" onMouseDown={(e) => e.stopPropagation()}>
                    <div className="bg-surface p-4 rounded-lg w-64 shadow-xl border border-primary">
                        <h3 className="text-on-surface font-bold text-sm mb-2">Register New Face</h3>
                        {capturedImage && (
                            <img src={`data:image/jpeg;base64,${capturedImage}`} alt="Captured" className="w-20 h-20 object-cover rounded mx-auto mb-2 border border-gray-500" />
                        )}
                        <p className="text-xs text-secondary mb-2 italic">{faceAttributes}</p>
                        
                        <input 
                            className="w-full mb-2 p-1 text-xs rounded border border-gray-600 bg-gray-700 text-white" 
                            placeholder="Customer Name" 
                            value={newCustomerName}
                            onChange={e => setNewCustomerName(e.target.value)}
                        />
                        <input 
                            className="w-full mb-2 p-1 text-xs rounded border border-gray-600 bg-gray-700 text-white" 
                            placeholder="Mobile" 
                            value={newCustomerMobile}
                            onChange={e => setNewCustomerMobile(e.target.value)}
                        />
                        
                        <div className="flex justify-between mt-2">
                            <button onClick={() => setIsRegistering(false)} className="text-xs text-gray-400 hover:text-white">Cancel</button>
                            <button onClick={handleSaveNewCustomer} className="text-xs bg-primary text-white px-2 py-1 rounded">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerFaceCamera;
