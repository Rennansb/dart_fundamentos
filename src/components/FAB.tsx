import React, { useState } from 'react';
import { Plus, UserPlus, ClipboardPlus, MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function FAB() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const actions = [
    { icon: <MessageCircle className="h-5 w-5" />, label: 'WhatsApp', color: 'bg-green-500', onClick: () => navigate('/app/conversations') },
    { icon: <UserPlus className="h-5 w-5" />, label: 'Cliente', color: 'bg-blue-500', onClick: () => navigate('/app/customers') },
    { icon: <ClipboardPlus className="h-5 w-5" />, label: 'Nova OS', color: 'bg-indigo-600', onClick: () => navigate('/app/work-orders') },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-[60] md:hidden">
      <AnimatePresence>
        {isOpen && (
          <div className="flex flex-col-reverse items-end space-y-reverse space-y-4 mb-4">
            {actions.map((action, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => {
                  action.onClick();
                  setIsOpen(false);
                }}
              >
                <span className="bg-white dark:bg-gray-800 px-3 py-1 rounded-lg text-xs font-bold shadow-lg border border-gray-100 dark:border-gray-700 text-gray-900 dark:text-white">
                  {action.label}
                </span>
                <div className={`${action.color} p-3 rounded-full text-white shadow-xl`}>
                  {action.icon}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`${isOpen ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-indigo-600 text-white'} p-4 rounded-full shadow-2xl flex items-center justify-center transition-colors`}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </motion.button>
    </div>
  );
}
