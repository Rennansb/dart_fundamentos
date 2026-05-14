import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import { CheckCircle, ShieldCheck, PenTool, Car, User, Calendar } from 'lucide-react';

export default function PublicSignature() {
  const { osId } = useParams();
  const [os, setOs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signed, setSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const fetchOS = async () => {
      if (!osId) return;
      try {
        const docRef = doc(db, 'work_orders', osId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setOs(docSnap.data());
          if (docSnap.data().signature) setSigned(true);
        }
      } catch (error) {
        console.error("Error fetching OS:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOS();
  }, [osId]);

  const getCoordinates = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: any) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.beginPath();
    }
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e, canvas);

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !osId) return;

    const signatureBase64 = canvas.toDataURL();
    try {
      await updateDoc(doc(db, 'work_orders', osId), {
        signature: signatureBase64,
        signedAt: serverTimestamp(),
        status: 'approved'
      });
      setSigned(true);
    } catch (error) {
      alert("Erro ao salvar assinatura.");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Carregando...</div>;
  if (!os) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Ordem de Serviço não encontrada.</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100"
      >
        <div className="bg-indigo-600 p-6 text-white text-center">
          <ShieldCheck className="h-12 w-12 mx-auto mb-2 opacity-90" />
          <h1 className="text-xl font-black">Aprovação Digital</h1>
          <p className="text-indigo-100 text-sm">Service Hub - OS #{osId?.substring(0, 6)}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3 text-gray-700">
              <User className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-bold">{os.customerName}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <Car className="h-4 w-4 text-indigo-500" />
              <span className="text-sm">{os.vehicleInfo || os.model}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <Calendar className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-bold text-indigo-600">Total: R$ {os.total?.toFixed(2)}</span>
            </div>
          </div>

          {signed ? (
            <div className="text-center py-12 space-y-4">
              <CheckCircle className="h-20 w-20 text-emerald-500 mx-auto" />
              <h2 className="text-2xl font-black text-gray-900">Assinado com Sucesso!</h2>
              <p className="text-gray-500 text-sm">Sua ordem de serviço foi aprovada e já está em processamento.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <PenTool className="h-3 w-3" /> Sua Assinatura
                </label>
                <button onClick={clearCanvas} className="text-xs text-indigo-600 font-bold hover:underline">Limpar</button>
              </div>
              
              <div className="border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 overflow-hidden">
                <canvas 
                  ref={canvasRef}
                  width={400}
                  height={200}
                  onMouseDown={startDrawing}
                  onMouseUp={stopDrawing}
                  onMouseMove={draw}
                  onTouchStart={startDrawing}
                  onTouchEnd={stopDrawing}
                  onTouchMove={draw}
                  className="w-full h-48 cursor-crosshair touch-none"
                />
              </div>

              <p className="text-[10px] text-gray-400 leading-tight">
                Ao assinar, você concorda com os termos de serviço e autoriza a execução dos reparos e substituição de peças descritos no orçamento.
              </p>

              <button 
                onClick={saveSignature}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all transform active:scale-95"
              >
                Confirmar e Autorizar
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
