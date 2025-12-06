
import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { ShopDetails } from '../../types';
import database from '../../services/database';

const ShopSettings: React.FC = () => {
    const { shopDetails, updateShopDetails, showToast, currentUser, setCurrentUser } = useAppContext();
    const [details, setDetails] = useState<ShopDetails>(shopDetails);
    const [bankDetails, setBankDetails] = useState(shopDetails.bankDetails || { accountName: '', accountNumber: '', bankName: '', ifscCode: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Admin Credentials State
    const [adminCreds, setAdminCreds] = useState({ 
        username: currentUser?.username || '', 
        password: '', 
        confirmPassword: '' 
    });

    useEffect(() => {
        setDetails(shopDetails);
        setBankDetails(shopDetails.bankDetails || { accountName: '', accountNumber: '', bankName: '', ifscCode: '' });
    }, [shopDetails]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setDetails({ ...details, [name]: type === 'number' ? parseFloat(value) : value });
    };

    const handleBankChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBankDetails({ ...bankDetails, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updatedDetails = { ...details, bankDetails };
        updateShopDetails(updatedDetails);
        showToast('Shop details updated successfully!');
    };

    const handleBackup = async () => {
        const data = await database.backupData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rg_shop_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Database backup downloaded successfully!');
    };

    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const json = event.target?.result as string;
            if (json) {
                const success = await database.restoreData(json);
                if (success) {
                    showToast('Database restored successfully! Please refresh the page.', 'success');
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    showToast('Failed to restore database. Invalid file.', 'error');
                }
            }
        };
        reader.readAsText(file);
    };

    const handleUpdateAdminCreds = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        if (adminCreds.password && adminCreds.password !== adminCreds.confirmPassword) {
            showToast("Passwords do not match!", "error");
            return;
        }

        const success = await database.updateCurrentUserCredentials(
            currentUser.id, 
            adminCreds.username, 
            adminCreds.password || undefined
        );

        if (success) {
            showToast("Admin credentials updated successfully!");
            // Update local state if username changed
            if (adminCreds.username !== currentUser.username) {
                setCurrentUser({ ...currentUser, username: adminCreds.username });
            }
            setAdminCreds(prev => ({ ...prev, password: '', confirmPassword: '' }));
        } else {
            showToast("Failed to update credentials. Try again.", "error");
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-on-surface mb-6">Shop Settings</h1>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* General Settings */}
                <div className="bg-surface p-8 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-on-surface mb-6 border-b border-on-surface/20 pb-2">General Information</h2>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-on-surface mb-1">Shop Name</label>
                            <input
                                type="text"
                                name="name"
                                value={details.name}
                                onChange={handleChange}
                                className="w-full p-3 bg-background border border-on-surface/20 rounded-md text-on-surface"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface mb-1">Address</label>
                            <input
                                type="text"
                                name="address"
                                value={details.address}
                                onChange={handleChange}
                                className="w-full p-3 bg-background border border-on-surface/20 rounded-md text-on-surface"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface mb-1">Contact Number</label>
                            <input
                                type="text"
                                name="contact"
                                value={details.contact}
                                onChange={handleChange}
                                className="w-full p-3 bg-background border border-on-surface/20 rounded-md text-on-surface"
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Payment & Tax Settings */}
                <div className="bg-surface p-8 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-on-surface mb-6 border-b border-on-surface/20 pb-2">Payment & Tax Configuration</h2>
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1">GST Number (Optional)</label>
                                <input
                                    type="text"
                                    name="gstNumber"
                                    value={details.gstNumber || ''}
                                    onChange={handleChange}
                                    placeholder="GSTIN"
                                    className="w-full p-3 bg-background border border-on-surface/20 rounded-md text-on-surface"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1">Default GST Rate (%)</label>
                                <input
                                    type="number"
                                    name="defaultGstRate"
                                    value={details.defaultGstRate || 0}
                                    onChange={handleChange}
                                    placeholder="0"
                                    className="w-full p-3 bg-background border border-on-surface/20 rounded-md text-on-surface"
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-on-surface mb-1 text-primary font-bold">UPI ID (VPA) for QR Code</label>
                            <input
                                type="text"
                                name="upiId"
                                value={details.upiId || ''}
                                onChange={handleChange}
                                placeholder="e.g. shopname@okaxis"
                                className="w-full p-3 bg-background border-2 border-primary/20 focus:border-primary rounded-md text-on-surface"
                            />
                            <p className="text-xs text-on-surface/60 mt-1">Required to generate payment QR codes at checkout.</p>
                        </div>

                        <div className="border-t border-on-surface/10 pt-4 mt-4">
                            <h3 className="text-sm font-bold text-on-surface mb-3">Bank Account Details (For Reference)</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" name="accountName" value={bankDetails.accountName} onChange={handleBankChange} placeholder="Account Holder Name" className="p-2 bg-background border border-on-surface/20 rounded text-sm text-on-surface" />
                                <input type="text" name="bankName" value={bankDetails.bankName} onChange={handleBankChange} placeholder="Bank Name" className="p-2 bg-background border border-on-surface/20 rounded text-sm text-on-surface" />
                                <input type="text" name="accountNumber" value={bankDetails.accountNumber} onChange={handleBankChange} placeholder="Account Number" className="p-2 bg-background border border-on-surface/20 rounded text-sm text-on-surface" />
                                <input type="text" name="ifscCode" value={bankDetails.ifscCode} onChange={handleBankChange} placeholder="IFSC Code" className="p-2 bg-background border border-on-surface/20 rounded text-sm text-on-surface" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="md:col-span-2 flex justify-end">
                    <button type="submit" className="py-3 px-8 bg-primary text-on-primary font-bold text-lg rounded-md hover:bg-indigo-600 transition shadow-lg transform hover:scale-105">
                        Save Shop Configurations
                    </button>
                </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                {/* Admin Security Section */}
                <div className="bg-surface p-8 rounded-lg shadow-md border-l-4 border-orange-500">
                     <h2 className="text-xl font-semibold text-on-surface mb-6 border-b border-on-surface/20 pb-2">Admin Account Security</h2>
                     <form onSubmit={handleUpdateAdminCreds} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-on-surface mb-1">Admin ID / Username</label>
                            <input
                                type="text"
                                value={adminCreds.username}
                                onChange={(e) => setAdminCreds({...adminCreds, username: e.target.value})}
                                className="w-full p-3 bg-background border border-on-surface/20 rounded-md text-on-surface"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface mb-1">New Password (Optional)</label>
                            <input
                                type="password"
                                value={adminCreds.password}
                                onChange={(e) => setAdminCreds({...adminCreds, password: e.target.value})}
                                placeholder="Leave empty to keep current"
                                className="w-full p-3 bg-background border border-on-surface/20 rounded-md text-on-surface"
                            />
                        </div>
                        {adminCreds.password && (
                            <div className="animate-fade-in-down">
                                <label className="block text-sm font-medium text-on-surface mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={adminCreds.confirmPassword}
                                    onChange={(e) => setAdminCreds({...adminCreds, confirmPassword: e.target.value})}
                                    placeholder="Confirm password"
                                    className="w-full p-3 bg-background border border-on-surface/20 rounded-md text-on-surface"
                                    required
                                />
                            </div>
                        )}
                        <button type="submit" className="w-full py-2 bg-orange-500 text-white font-semibold rounded hover:bg-orange-600 transition">
                            Update Credentials
                        </button>
                     </form>
                </div>

                {/* Database Management */}
                <div className="bg-surface p-8 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-on-surface mb-6 border-b border-on-surface/20 pb-2">Database Tools</h2>
                    {!database.isCloud ? (
                        <div className="flex flex-col gap-4">
                            <div className="p-4 border border-on-surface/20 rounded-lg bg-background">
                                <h3 className="font-bold text-on-surface mb-2">Backup Data</h3>
                                <button onClick={handleBackup} className="w-full py-2 bg-secondary text-white rounded hover:bg-green-600 transition flex justify-center items-center gap-2">
                                    <DownloadIcon /> Download Backup
                                </button>
                            </div>

                            <div className="p-4 border border-on-surface/20 rounded-lg bg-background">
                                <h3 className="font-bold text-on-surface mb-2">Restore Data</h3>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange} 
                                    accept=".json" 
                                    className="hidden" 
                                />
                                <button onClick={handleRestoreClick} className="w-full py-2 bg-primary text-white rounded hover:bg-indigo-600 transition flex justify-center items-center gap-2">
                                    <UploadIcon /> Upload & Restore
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-6 bg-blue-500/10 rounded-lg border border-blue-500/30">
                            <h3 className="font-bold text-blue-400 mb-2">Cloud Mode Active</h3>
                            <p className="text-sm text-on-surface/80">
                                Data managed via Firebase Cloud.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 9.293a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>;

export default ShopSettings;
