export function mountDialogControl(dialog: HTMLDialogElement, trigger: HTMLButtonElement): () => void {
  const open = (): void => { if (!dialog.open) dialog.showModal(); };
  const close = (): void => { if (dialog.open) dialog.close(); };
  const onDialogClick = (event: MouseEvent): void => {
    const target = event.target;
    if (target === dialog || (target instanceof Element && target.closest("[data-close-dialog]"))) close();
  };
  trigger.addEventListener("click", open);
  dialog.addEventListener("click", onDialogClick);
  return () => { trigger.removeEventListener("click", open); dialog.removeEventListener("click", onDialogClick); close(); };
}
