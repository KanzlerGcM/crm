import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar',
  variant = 'default', onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const btnStyles = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    default: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onCancel} />
      <div className="relative bg-[#14171D] rounded-2xl shadow-2xl max-w-lg w-full p-8 animate-scale-in">
        <button onClick={onCancel} className="absolute top-5 right-5 p-1.5 rounded-lg hover:bg-white/[0.04]">
          <X className="w-5 h-5 text-gray-400" />
        </button>

        <div className="flex items-start gap-4">
          {variant === 'danger' && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
          )}
          {variant === 'warning' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-white">{title}</h3>
            <p className="text-base text-gray-500 mt-2">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            onClick={onCancel}
            className="px-6 py-3 border border-white/[0.08] rounded-lg text-base font-medium hover:bg-white/[0.03] transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-3 rounded-lg text-base font-medium transition-colors ${btnStyles[variant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
