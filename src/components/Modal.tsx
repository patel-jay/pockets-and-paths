import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalProps = {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ open, title, description, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    dialog.showModal();
    document.body.classList.add('modal-open');
    window.requestAnimationFrame(() => {
      const firstControl = dialog.querySelector<HTMLElement>(
        '[autofocus], input:not([type="hidden"]), select, textarea, button',
      );
      firstControl?.focus();
    });

    return () => {
      if (dialog.open) dialog.close();
      document.body.classList.remove('modal-open');
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="modal-layer"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onCloseRef.current();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <section className="modal-card" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-card__header">
          <div>
            <p className="eyebrow">Pockets & Paths</p>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </dialog>
  );
}
