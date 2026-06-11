import type { ControlledWritePreview } from "../data/controlled-write";

export interface WritePreviewModalActions {
  onConfirm(): void;
  onCancel(): void;
}

export function renderWritePreviewModalContent(
  parent: HTMLElement,
  preview: ControlledWritePreview,
  actions: WritePreviewModalActions,
): void {
  parent.empty();
  parent.addClass("ts-write-preview");

  parent.createEl("h3", { text: preview.title, cls: "ts-modal-title ts-write-preview-title" });
  const meta = parent.createDiv({ cls: "ts-write-preview-meta" });
  meta.createDiv({ cls: "ts-write-preview-label", text: "目标文件" });
  meta.createDiv({ cls: "ts-write-preview-path", text: preview.path });
  meta.createDiv({ cls: "ts-write-preview-label", text: "动作摘要" });
  meta.createDiv({ cls: "ts-write-preview-summary", text: preview.summary });

  if (preview.warnings.length > 0) {
    const warnings = parent.createDiv({ cls: "ts-write-preview-warnings" });
    warnings.createDiv({ cls: "ts-write-preview-label", text: "风险提示" });
    for (const warning of preview.warnings) warnings.createDiv({ cls: "ts-write-preview-warning", text: warning });
  }

  renderBlock(parent, "待写入内容", preview.writeContent, "ts-write-preview-content");
  renderBlock(parent, "变更预览", preview.diff || "No textual diff", "ts-write-preview-diff");

  const row = parent.createDiv({ cls: "ts-modal-row ts-write-preview-actions" });
  const cancel = row.createEl("button", { text: "取消", cls: "ts-modal-btn ts-write-preview-cancel" });
  cancel.addEventListener("click", actions.onCancel);
  const confirm = row.createEl("button", { text: "确认写入", cls: "ts-modal-btn ts-modal-btn--primary ts-write-preview-confirm" });
  confirm.addEventListener("click", actions.onConfirm);
}

function renderBlock(parent: HTMLElement, label: string, text: string, cls: string): void {
  const section = parent.createDiv({ cls: `ts-write-preview-section ${cls}` });
  section.createDiv({ cls: "ts-write-preview-label", text: label });
  section.createEl("pre", { cls: "ts-write-preview-code", text });
}
