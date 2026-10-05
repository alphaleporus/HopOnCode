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
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-paper transition-colors"
                >
                    <div
                        className="w-8 h-8 rounded-full bg-mist border border-line flex items-center justify-center">
                        <User className="w-4 h-4 text-cobalt"/>
                    </div>
                    <div className="hidden sm:block text-left">
                        <div className="text-sm font-semibold text-ink">{user.name}</div>
                        <div className="text-xs text-muted">{user.email}</div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
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
                                className="absolute right-0 mt-2 w-56 glass-card rounded-lg border border-line shadow-xl z-50 overflow-hidden"
                            >
                                <div className="p-3 border-b border-line">
                                    <div className="text-sm font-semibold text-ink">{user.name}</div>
                                    <div className="text-xs text-muted">{user.email}</div>
                                </div>

                                <div className="p-2">
                                    <button
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-paper text-ink-2 hover:text-ink transition-colors"
                                        onClick={handleOpenSettings}
                                    >
                                        <Settings className="w-4 h-4"/>
                                        <span className="text-sm">Settings</span>
                                    </button>

                                    <button
                                        onClick={handleSignOut}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-alert/10 text-ink-2 hover:text-alert transition-colors"
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
                            className="absolute inset-0 bg-ink/40"
                            onClick={() => setShowSettings(false)}
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{opacity: 0, scale: 0.95}}
                            animate={{opacity: 1, scale: 1}}
                            exit={{opacity: 0, scale: 0.95}}
                            className="relative w-full max-w-2xl glass-card rounded-lg border border-line shadow-lg p-6 z-10"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-mist border border-line">
                                        <Settings className="w-5 h-5 text-cobalt"/>
                                    </div>
                                    <h2 className="text-2xl font-bold text-ink">Settings</h2>
                                </div>
                                <button
                                    onClick={() => setShowSettings(false)}
                                    className="p-2 hover:bg-paper rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-muted"/>
                                </button>
                            </div>

                            {/* Settings Content */}
                            <div className="space-y-6">
                                {/* Account Section */}
                                <div>
                                    <h3 className="text-sm font-semibold text-muted uppercase mb-3">Account Information</h3>
                                    <div className="glass-card rounded-lg p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm text-muted">Name</div>
                                                <div className="text-ink font-medium">{user.name}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm text-muted">Email</div>
                                                <div className="text-ink font-medium">{user.email}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm text-muted">Role</div>
                                                <div className="text-cobalt font-medium">{user.role}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Preferences Section */}
                                <div>
                                    <h3 className="text-sm font-semibold text-muted uppercase mb-3">Preferences</h3>
                                    <div className="space-y-3">
                                        {/* Notifications Toggle */}
                                        <div className="glass-card rounded-lg p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Bell className="w-5 h-5 text-cobalt"/>
                                                <div>
                                                    <div className="text-ink font-medium">Notifications</div>
                                                    <div className="text-xs text-muted">Receive alerts and updates</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSettings({...settings, notifications: !settings.notifications})}
                                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.notifications ? 'bg-cobalt' : 'bg-slate-700'}`}
                                            >
                                                <motion.div
                                                    animate={{x: settings.notifications ? 20 : 0}}
                                                    transition={{type: 'spring', stiffness: 500, damping: 30}}
                                                    className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                                                />
                                            </button>
                                        </div>

                                        {/* Dark Mode Toggle */}
                                        <div className="glass-card rounded-lg p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Moon className="w-5 h-5 text-cobalt"/>
                                                <div>
                                                    <div className="text-ink font-medium">Dark Mode</div>
                                                    <div className="text-xs text-muted">Use dark theme</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSettings({...settings, darkMode: !settings.darkMode})}
                                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.darkMode ? 'bg-cobalt' : 'bg-slate-700'}`}
                                            >
                                                <motion.div
                                                    animate={{x: settings.darkMode ? 20 : 0}}
                                                    transition={{type: 'spring', stiffness: 500, damping: 30}}
                                                    className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                                                />
                                            </button>
                                        </div>

                                        {/* Auto Save Toggle */}
                                        <div className="glass-card rounded-lg p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Shield className="w-5 h-5 text-cobalt"/>
                                                <div>
                                                    <div className="text-ink font-medium">Auto Save</div>
                                                    <div className="text-xs text-muted">Automatically save changes</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSettings({...settings, autoSave: !settings.autoSave})}
                                                className={`relative w-11 h-6 rounded-full transition-colors ${settings.autoSave ? 'bg-cobalt' : 'bg-slate-700'}`}
                                            >
                                                <motion.div
                                                    animate={{x: settings.autoSave ? 20 : 0}}
                                                    transition={{type: 'spring', stiffness: 500, damping: 30}}
                                                    className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                                                />
                                            </button>
                                        </div>

                                        {/* Language Selection */}
                                        <div className="glass-card rounded-lg p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Globe className="w-5 h-5 text-cobalt"/>
                                                <div>
                                                    <div className="text-ink font-medium">Language</div>
                                                    <div className="text-xs text-muted">Select your language</div>
                                                </div>
                                            </div>
                                            <select
                                                value={settings.language}
                                                onChange={(e) => setSettings({...settings, language: e.target.value})}
                                                className="bg-paper text-ink px-3 py-2 rounded-lg border border-line focus:border-line focus:ring-2 focus:ring-teal-500/20 outline-none"
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
                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                                    <button
                                        onClick={() => setShowSettings(false)}
                                        className="px-4 py-2 rounded-lg hover:bg-paper text-ink-2 hover:text-ink transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowSettings(false);
                                        }}
                                        className="px-4 py-2 rounded-lg bg-cobalt hover:bg-teal-600 text-ink font-semibold transition-colors"
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
