import React, { useState, useRef } from 'react';
import { X, Camera, Mic, Send, Brain, Loader2, Play, Square, Trash2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { performAiDiagnosis } from '../services/aiService';

interface AiDiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (diagnosis: any) => void;
  vehicleInfo?: string;
}

export default function AiDiagnosisModal({ isOpen, onClose, onApply, vehicleInfo }: AiDiagnosisModalProps) {
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const reader = new FileReader();
      reader.onload = () => {
        setImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(files[i]);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/ogg; codecs=opus' });
        setAudioURL(URL.createObjectURL(blob));
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Permissão de microfone negada.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleDiagnose = async () => {
    setLoading(true);
    try {
      const result = await performAiDiagnosis({
        message,
        images,
        vehicleInfo,
        audioTranscript: audioURL ? "Áudio enviado para análise" : undefined // In a real scenario, we'd send the blob or transcript
      });
      
      onApply(result);
      onClose();
    } catch (error) {
      alert("Erro ao processar diagnóstico IA.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Diagnóstico Inteligente IA</h3>
              <p className="text-xs text-white/70 italic">{vehicleInfo || 'Análise de sintomas gerais'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Photos Section */}
          <div className="space-y-3">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Camera className="w-4 h-4" /> Fotos do Problema
            </label>
            <div className="grid grid-cols-4 gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden group border border-gray-100 dark:border-gray-800">
                  <img src={img} alt="Vehicle Part" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 p-1.5 bg-rose-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-all"
              >
                <Camera className="w-6 h-6" />
                <span className="text-[10px] font-bold">Adicionar</span>
              </button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
          </div>

          {/* Voice Section */}
          <div className="space-y-3">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Mic className="w-4 h-4" /> Depoimento em Áudio
            </label>
            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
              <button 
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-4 rounded-2xl transition-all ${isRecording ? 'bg-rose-500 animate-pulse' : 'bg-indigo-600 shadow-lg shadow-indigo-500/20'}`}
              >
                {isRecording ? <Square className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
              </button>
              <div className="flex-1">
                {isRecording ? (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map(i => <div key={i} className="w-1 h-4 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />)}
                    </div>
                    <span className="text-xs font-bold text-rose-500">Gravando...</span>
                  </div>
                ) : audioURL ? (
                  <div className="flex items-center gap-3">
                    <Play className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Áudio gravado com sucesso!</span>
                    <button onClick={() => setAudioURL(null)} className="text-xs text-rose-500 font-bold hover:underline">Excluir</button>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 font-medium">Clique no botão para gravar os sintomas ditos pelo cliente.</span>
                )}
              </div>
            </div>
          </div>

          {/* Message Section */}
          <div className="space-y-3">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Send className="w-4 h-4" /> Relato Escrito
            </label>
            <textarea 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: O carro está fazendo um barulho metálico na roda dianteira esquerda ao frear..."
              className="w-full h-32 p-5 bg-gray-50 dark:bg-gray-800 border-none rounded-3xl text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner resize-none"
            />
          </div>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 bg-white dark:bg-gray-900 text-gray-600 font-bold rounded-2xl border border-gray-200 dark:border-gray-800 active:scale-95 transition-all">Cancelar</button>
          <button 
            onClick={handleDiagnose}
            disabled={loading || (!message && images.length === 0 && !audioURL)}
            className="flex-2 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
            {loading ? 'Analisando...' : 'Iniciar Diagnóstico Real'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
