import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalProps = {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ open, title, description, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-card__header">
          <div>
            <p className="eyebrow">Pockets & Paths</p>
            <h2 id="modal-title">{title}</h2>
            <p id="modal-description">{description}</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
