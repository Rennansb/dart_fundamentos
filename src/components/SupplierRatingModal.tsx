import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';

interface SupplierRatingModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SupplierRatingModal({ order, isOpen, onClose, onSuccess }: SupplierRatingModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setIsSubmitting(true);
    try {
      // Add rating to supplier_ratings collection
      await addDoc(collection(db, 'supplier_ratings'), {
        orderId: order.id,
        supplierId: order.supplierId,
        supplierName: order.supplierName,
        shopId: order.shopId,
        shopName: order.shopName || 'Oficina Cliente',
        rating,
        comment,
        createdAt: serverTimestamp()
      });

      // Update order to show it has been rated
      await updateDoc(doc(db, 'purchase_orders', order.id), {
        isRated: true,
        ratingValue: rating,
        ratedAt: serverTimestamp()
      });

      // Award Points for Rating (Gamification)
      const userRef = doc(db, 'users', order.shopId || '');
      await updateDoc(userRef, {
        points: increment(50)
      });

      onSuccess();
      onClose();
      alert("✅ Avaliação enviada! Você ganhou 50 pontos de experiência.");
    } catch (error) {
      console.error("Error submitting rating:", error);
      alert("Erro ao enviar avaliação. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 dark:border-gray-700"
          >
            <div className="p-8 bg-indigo-600 text-white relative">
              <button 
                onClick={onClose}
                className="absolute right-6 top-6 p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md border border-white/20">
                <Star className="h-8 w-8 text-amber-300 fill-amber-300" />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tighter leading-tight">
                Avaliar Fornecedor
              </h3>
              <p className="text-indigo-100 text-sm mt-2 opacity-90">
                Como foi sua experiência com a <span className="font-black underline">{order.supplierName}</span>?
              </p>
            </div>

            <div className="p-8 space-y-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widests">Sua Nota</p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform active:scale-90"
                    >
                      <Star 
                        className={`w-10 h-10 transition-colors ${
                          star <= (hoveredRating || rating) 
                            ? 'text-amber-500 fill-amber-500' 
                            : 'text-gray-200 dark:text-gray-700'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {rating === 5 && '🚀 Excelente! Recomendo muito.'}
                  {rating === 4 && '✨ Muito bom, mas pode melhorar algo.'}
                  {rating === 3 && '⚙️ Neutro, atendeu o básico.'}
                  {rating === 2 && '⚠️ Ruim, tive alguns problemas.'}
                  {rating === 1 && '❌ Péssimo, não recomendo.'}
                  {rating === 0 && 'Clique nas estrelas para avaliar'}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Seu Comentário (Opcional)</label>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Conte um pouco sobre o atendimento, qualidade das peças e prazo de entrega..."
                  className="w-full h-32 px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white font-medium text-sm resize-none transition-all"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={rating === 0 || isSubmitting}
                  className="flex-1 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-50 disabled:grayscale"
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar Avaliação'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
