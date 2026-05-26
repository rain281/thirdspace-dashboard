export function renderProductBoard(
  container: HTMLElement,
  products: Array<{ name: string; status: string; milestone: string }>
): void {
  container.empty();

  if (products.length === 0) {
    container.createDiv({ cls: "ts-empty-hint", text: "No product-status.md found" });
    return;
  }

  const STATUS_ICON: Record<string, string> = {
    active: "🟢",
    watch: "🟡",
    paused: "🔴",
    unknown: "⚪",
  };

  const STATUS_LABEL: Record<string, string> = {
    active: "Active",
    watch: "Watch",
    paused: "Paused",
    unknown: "Unknown",
  };

  const list = container.createDiv({ cls: "ts-product-list" });

  for (const product of products) {
    const row = list.createDiv({ cls: `ts-product-row ts-product-${product.status}` });

    const left = row.createDiv({ cls: "ts-product-left" });
    left.createSpan({ cls: "ts-product-icon", text: STATUS_ICON[product.status] || "⚪" });
    left.createSpan({ cls: "ts-product-name", text: product.name });

    const right = row.createDiv({ cls: "ts-product-right" });
    if (product.milestone) {
      right.createSpan({ cls: "ts-product-milestone", text: product.milestone });
    }
  }
}
