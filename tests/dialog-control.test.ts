// @vitest-environment jsdom
import assert from "node:assert/strict";
import { test } from "vitest";
import { mountDialogControl } from "../src/ui/dialog-control.ts";

test("dialog opens from its header trigger and closes from its button or backdrop", () => {
  const trigger = document.createElement("button");
  const dialog = document.createElement("dialog");
  dialog.innerHTML = `<section><button type="button" data-close-dialog>关闭</button><span>内容</span></section>`;
  dialog.showModal = () => dialog.setAttribute("open", "");
  dialog.close = () => dialog.removeAttribute("open");
  const destroy = mountDialogControl(dialog, trigger);

  trigger.click();
  assert.equal(dialog.open, true);
  dialog.querySelector<HTMLElement>("span")?.click();
  assert.equal(dialog.open, true);
  dialog.querySelector<HTMLButtonElement>("[data-close-dialog]")?.click();
  assert.equal(dialog.open, false);
  trigger.click();
  dialog.click();
  assert.equal(dialog.open, false);
  destroy();
  trigger.click();
  assert.equal(dialog.open, false);
});
