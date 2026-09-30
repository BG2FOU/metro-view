export interface DetailDialogController {
  show(content: string, kind: "station" | "train"): void;
  refresh(content: string): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

export function mountDetailDialog(dialog: HTMLDialogElement, onClose: () => void): DetailDialogController {
  const content = dialog.querySelector<HTMLElement>(".detail-dialog-content")!;
  const title = dialog.querySelector<HTMLElement>("#detail-dialog-title")!;
  const close = (): void => { if (dialog.open) dialog.close(); };
  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (target === dialog || (target instanceof Element && target.closest("[data-close-detail]"))) close();
  };
  const onDialogClose = (): void => { if (!dialog.open) onClose(); };
  dialog.addEventListener("click", onClick);
  dialog.addEventListener("close", onDialogClose);
  return {
    show(html, kind) {
      content.innerHTML = html;
      dialog.dataset.detailKind = kind;
      title.textContent = kind === "station" ? "车站运行信息" : "列车运行信息";
      if (!dialog.open) dialog.showModal();
    },
    refresh(html) { if (dialog.open) content.innerHTML = html; },
    close,
    isOpen: () => dialog.open,
    destroy() {
      close();
      dialog.removeEventListener("click", onClick);
      dialog.removeEventListener("close", onDialogClose);
    },
  };
}
