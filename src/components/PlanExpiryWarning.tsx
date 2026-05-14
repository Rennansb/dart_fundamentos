import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function PlanExpiryWarning() {
  const { profile } = useAuth();

  if (profile?.role === 'admin' || !profile?.planExpiresAt) return null;

  const expiresAt = new Date(profile.planExpiresAt);
  const now = new Date();
  const diffTime = expiresAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Only show warning if 5 days or less remaining
  if (diffDays > 5 || diffDays < 0) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-md">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1 md:flex md:justify-between">
          <p className="text-sm text-yellow-700 dark:text-yellow-200">
            <strong>Atenção:</strong> Seu plano {profile.plan === 'pro' ? 'Pro' : 'Elite'} expira em {diffDays} {diffDays === 1 ? 'dia' : 'dias'}. 
            Evite a suspensão dos serviços renovando agora.
          </p>
          <p className="mt-3 text-sm md:mt-0 md:ml-6">
            <Link to="/plan-selection" className="whitespace-nowrap font-medium text-yellow-700 dark:text-yellow-200 hover:text-yellow-600 dark:hover:text-yellow-100 flex items-center">
              Renovar Plano <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
