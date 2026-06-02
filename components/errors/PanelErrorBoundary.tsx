"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Короткий заголовок внутри панели (не роняет всю страницу). */
  title?: string;
  className?: string;
};

type State = { hasError: boolean };

/**
 * Локальный error boundary для колокола, сайдбара и т.п.
 * Ошибка в уведомлениях не должна валить весь кабинет/админку.
 */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[PanelErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={
            this.props.className ??
            "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          }
        >
          {this.props.title ?? "Не удалось загрузить этот блок. Обновите страницу."}
        </div>
      );
    }
    return this.props.children;
  }
}
