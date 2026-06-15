export class RenderPassGuard {
  private currentPass = 0;

  begin(): number {
    this.currentPass += 1;
    return this.currentPass;
  }

  isCurrent(pass: number): boolean {
    return pass === this.currentPass;
  }
}

export function canCommitRenderPass(guard: RenderPassGuard, pass: number, root: HTMLElement): boolean {
  return guard.isCurrent(pass) && root.isConnected;
}
