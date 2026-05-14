import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Wrench, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { motion } from 'framer-motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { login, user, profile } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user && profile) {
      navigate('/app');
    }
  }, [user, profile, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);
    const trimmedEmail = email.trim();
    try {
      await login(trimmedEmail, password);
      // O redirect será feito pelo useEffect acima assim que o profile carregar
      // isSubmitting will remain true while redirect happens, which is correct UX
    } catch (err: any) {
      console.error("Login error:", err.code, err.message);
      if (err.code === 'auth/invalid-credential') {
        setError('Email ou senha incorretos. Verifique seus dados.');
      } else if (err.code === 'auth/user-not-found') {
        setError('Usuário não encontrado.');
      } else {
        setError('Erro ao entrar. Tente novamente mais tarde.');
      }
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Por favor, insira seu email primeiro.');
      return;
    }
    setError('');
    setMessage('');
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Email de redefinição enviado! Verifique sua caixa de entrada.');
    } catch (err: any) {
      console.error("Reset error:", err.code, err.message);
      setError('Erro ao enviar email de redefinição. Verifique se o email está correto.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F19] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-700">
      <div className="mesh-bg" />
      
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center"
        >
          <div className="p-4 bg-indigo-500/10 rounded-3xl border border-indigo-500/20 backdrop-blur-xl">
            <Wrench className="h-12 w-12 text-indigo-600 dark:text-indigo-400" />
          </div>
        </motion.div>
        <h2 className="mt-6 text-center text-4xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">
          Hub <span className="text-indigo-500">Master</span>
        </h2>
        <p className="mt-2 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">Controle Executivo de Oficinas</p>
      </div>

      <div className="mt-10 relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card py-10 px-6 sm:rounded-[3rem] sm:px-12 backdrop-blur-2xl"
        >
          <form className="space-y-6" onSubmit={handleEmailLogin}>
            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            {message && (
              <div className="rounded-md bg-green-50 dark:bg-green-900/30 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800 dark:text-green-200">{message}</h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 border"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Senha
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white py-2 border"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <div className="text-sm">
                <button
                  type="button"
                  disabled={resetLoading}
                  onClick={handleForgotPassword}
                  className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 disabled:opacity-50"
                >
                  {resetLoading ? 'Enviando...' : 'Esqueceu sua senha?'}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                  Novo por aqui?
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => navigate('/signup')}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Criar uma nova conta
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
