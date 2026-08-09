import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useNavigate } from 'react-router-dom';
import api from '../services/apiClient'; // Import API client
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
    const { currentUser, login } = useAuth(); // Import login from context
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (currentUser) {
            navigate('/', { replace: true });
        }
    }, [currentUser, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await api.post('/auth/login', { email, password });

            // Login via context (saves token and user)
            login(response.data.token, response.data.user);

            toast.success(t('login_success'));
            // Navigation handled by useEffect
        } catch (err: any) {
            console.error(err);
            const errorMessage = err.response?.data?.error || t('login_error');
            toast.error(errorMessage);
            setLoading(false);
        }
    };



    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#541c2c]">
            {/* Animated Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#aa7a51]/20 blur-[120px] animate-[pulse_8s_ease-in-out_infinite]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#e3c4a2]/20 blur-[120px] animate-[pulse_10s_ease-in-out_infinite]" />
            </div>

            <div className="absolute top-6 right-6 z-20">
                <LanguageSwitcher />
            </div>

            <div className="w-full max-w-md p-8 relative z-10">
                <div className="glass-card p-10 rounded-[40px] shadow-2xl shadow-[#541c2c]/5 border-white/60 animate-[slideUp_0.8s_ease-out]">
                    <div className="text-center mb-10">
                        <div className="flex justify-center mb-6 animate-[fadeIn_1s_ease-out]">
                            <img src="/logo.png" alt="IPH SYSTEM Logo" className="h-24 w-auto object-contain hover:scale-110 transition-transform duration-500" />
                        </div>
                        <h2 className="text-2xl font-outfit font-bold text-slate-800 tracking-tight animate-[fadeIn_1.2s_ease-out]">{t('welcome_title')}</h2>
                        <p className="text-slate-500 mt-2 text-sm font-medium animate-[fadeIn_1.4s_ease-out]">{t('welcome_subtitle')}</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2 animate-[slideUp_1s_ease-out]">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{t('email_label')}</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-5 pr-5 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-[#aa7a51]/10 focus:border-[#aa7a51] focus:bg-white transition-all outline-none font-medium text-slate-800 placeholder:text-slate-400"
                                    placeholder={t('email_placeholder')}
                                />
                            </div>
                        </div>
                        <div className="space-y-2 animate-[slideUp_1.2s_ease-out]">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{t('password_label')}</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-5 pr-12 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-[#aa7a51]/10 focus:border-[#aa7a51] focus:bg-white transition-all outline-none font-medium text-slate-800 placeholder:text-slate-400"
                                    placeholder={t('password_placeholder')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>

                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-gradient-to-r from-[#541c2c] to-[#aa7a51] text-white rounded-2xl font-bold shadow-lg shadow-[#541c2c]/10 hover:shadow-xl hover:shadow-[#541c2c]/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed mt-4 animate-[slideUp_1.4s_ease-out]"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                    {t('signing_in')}
                                </div>
                            ) : t('sign_in')}
                        </button>
                    </form>
                </div>

                <p className="text-center mt-8 text-xs text-[#e3c4a2]/70 font-medium animate-[fadeIn_2s_ease-out]">
                    {t('copyright', { year: new Date().getFullYear() })}
                </p>
            </div>
        </div >
    );
};

export default Login;
