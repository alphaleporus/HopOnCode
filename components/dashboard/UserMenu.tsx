'use client';

import {useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import {User, LogOut, Settings, ChevronDown, X, Bell, Moon, Globe, Shield} from 'lucide-react';

// Mock user for demo purposes (no authentication needed)
const demoUser = {
    name: 'Demo User',
    email: 'demo@fleetfusion.com',
    role: 'Demo',
};

export default function UserMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState({
        notifications: true,
        darkMode: true,
        language: 'English',
        autoSave: true,
    });

    // Use demo user instead of session
    const user = demoUser;

    const handleSignOut = () => {
        // For demo, just close the menu
        setIsOpen(false);
        alert('Sign out disabled in demo mode');
    };

    const handleOpenSettings = () => {
        setIsOpen(false);
        setShowSettings(true);
    };

    return (
        <>
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                    <div
                        className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                        <User className="w-4 h-4 text-teal-400"/>
                    </div>
                    <div className="hidden sm:block text-left">
                        <div className="text-sm font-semibold text-white">{user.name}</div>
                        <div className="text-xs text-slate-400">{user.email}</div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <>
                            {/* Backdrop */}
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setIsOpen(false)}
                            />

                            {/* Menu */}
                            <motion.div
                                initial={{opacity: 0, y: -10}}
                                animate={{opacity: 1, y: 0}}
                                exit={{opacity: 0, y: -10}}
                                className="absolute right-0 mt-2 w-56 glass-card rounded-xl border border-white/10 shadow-xl z-50 overflow-hidden"
                            >
                                <div className="p-3 border-b border-white/10">
                                    <div className="text-sm font-semibold text-white">{user.name}</div>
                                    <div className="text-xs text-slate-400">{user.email}</div>
                                </div>

                                <div className="p-2">
                                    <button
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors"
                                        onClick={handleOpenSettings}
                                    >
                                        <Settings className="w-4 h-4"/>
                                        <span className="text-sm">Settings</span>
                                    </button>

                                    <button
                                        onClick={handleSignOut}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 text-slate-300 hover:text-red-400 transition-colors"
                                    >
                                        <LogOut className="w-4 h-4"/>
                                        <span className="text-sm">Sign Out</span>
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>

            {/* Settings Modal */}
            <AnimatePresence>
                {showSettings && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                            onClick={() => setShowSettings(false)}
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{opacity: 0, scale: 0.95}}
                            animate={{opacity: 1, scale: 1}}
                            exit={{opacity: 0, scale: 0.95}}
                            className="relative w-full max-w-2xl glass-card rounded-2xl border border-white/10 shadow-2xl p-6 z-10"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-teal-500/20 border border-teal-500/30">
                                        <Settings className="w-5 h-5 text-teal-400"/>
                                    </div>
                                    <h2 className="text-2xl font-bold text-white">Settings</h2>
                                </div>
                                <button
                                    onClick={() => setShowSettings(false)}
                                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-400"/>
                                </button>
                            </div>

                            {/* Settings Content */}
                            <div className="space-y-6">
                                {/* Account Section */}
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3">Account Information</h3>
                                    <div className="glass-card rounded-xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm text-slate-400">Name</div>
                                                <div className="text-white font-medium">{user.name}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm text-slate-400">Email</div>
                                                <div className="text-white font-medium">{user.email}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm text-slate-400">Role</div>
                                                <div className="text-teal-400 font-medium">{user.role}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Preferences Section */}
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3">Preferences</h3>
                                    <div className="space-y-3">
                                        {/* Notifications Toggle */}
                                        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Bell className="w-5 h-5 text-teal-400"/>
                                                <div>
                                                    <div className="text-white font-medium">Notifications</div>
                                                    <div className="text-xs text-slate-400">Receive alerts and updates</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSettings({...settings, notifications: !settings.notifications})}
                                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.notifications ? 'bg-teal-500' : 'bg-slate-700'}`}
                                            >
                                                <motion.div
                                                    animate={{x: settings.notifications ? 20 : 0}}
                                                    transition={{type: 'spring', stiffness: 500, damping: 30}}
                                                    className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                                                />
                                            </button>
                                        </div>

                                        {/* Dark Mode Toggle */}
                                        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Moon className="w-5 h-5 text-teal-400"/>
                                                <div>
                                                    <div className="text-white font-medium">Dark Mode</div>
                                                    <div className="text-xs text-slate-400">Use dark theme</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSettings({...settings, darkMode: !settings.darkMode})}
                                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.darkMode ? 'bg-teal-500' : 'bg-slate-700'}`}
                                            >
                                                <motion.div
                                                    animate={{x: settings.darkMode ? 20 : 0}}
                                                    transition={{type: 'spring', stiffness: 500, damping: 30}}
                                                    className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                                                />
                                            </button>
                                        </div>

                                        {/* Auto Save Toggle */}
                                        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Shield className="w-5 h-5 text-teal-400"/>
                                                <div>
                                                    <div className="text-white font-medium">Auto Save</div>
                                                    <div className="text-xs text-slate-400">Automatically save changes</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSettings({...settings, autoSave: !settings.autoSave})}
                                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.autoSave ? 'bg-teal-500' : 'bg-slate-700'}`}
                                            >
                                                <motion.div
                                                    animate={{x: settings.autoSave ? 20 : 0}}
                                                    transition={{type: 'spring', stiffness: 500, damping: 30}}
                                                    className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                                                />
                                            </button>
                                        </div>

                                        {/* Language Selection */}
                                        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Globe className="w-5 h-5 text-teal-400"/>
                                                <div>
                                                    <div className="text-white font-medium">Language</div>
                                                    <div className="text-xs text-slate-400">Select your language</div>
                                                </div>
                                            </div>
                                            <select
                                                value={settings.language}
                                                onChange={(e) => setSettings({...settings, language: e.target.value})}
                                                className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-white/10 focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 outline-none"
                                            >
                                                <option>English</option>
                                                <option>Spanish</option>
                                                <option>French</option>
                                                <option>German</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                                    <button
                                        onClick={() => setShowSettings(false)}
                                        className="px-4 py-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowSettings(false);
                                        }}
                                        className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-semibold transition-colors"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
