"use client";

import * as Phaser from "phaser";
import { useCallback, useEffect, useRef } from "react";
import { PokerTableScene } from "@/features/tables/phaser/poker-table-scene";
import type { PokerTableBridge, PokerTableUiState } from "@/features/tables/poker-table-ui-types";

export type PokerGameCanvasProps = {
  bridge: PokerTableBridge;
  getUiState: (width: number, height: number) => PokerTableUiState;
  className?: string;
};

/**
 * Hosts a full-screen Phaser game for the poker table. React owns lifecycle + registry updates.
 */
export function PokerGameCanvas({ bridge, getUiState, className }: PokerGameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const bridgeRef = useRef(bridge);
  const getUiStateRef = useRef(getUiState);
  bridgeRef.current = bridge;
  getUiStateRef.current = getUiState;

  const pushState = useCallback(() => {
    const game = gameRef.current;
    const el = hostRef.current;
    if (!game || !el) return;
    const w = Math.max(200, Math.floor(el.clientWidth));
    const h = Math.max(280, Math.floor(el.clientHeight));
    const ui = getUiStateRef.current(w, h);
    game.registry.set("bridge", bridgeRef.current);
    game.registry.set("pokerUiState", ui);
    game.scale.resize(w, h);
    game.events.emit("poker-ui-update");
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const w = Math.max(200, Math.floor(el.clientWidth));
    const h = Math.max(280, Math.floor(el.clientHeight));
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: el,
      width: w,
      height: h,
      backgroundColor: "#140608",
      scene: [PokerTableScene],
      scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
    });
    gameRef.current = game;
    pushState();

    const ro = new ResizeObserver(() => {
      pushState();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      game.destroy(true);
      gameRef.current = null;
    };
  }, [pushState]);

  useEffect(() => {
    pushState();
  }, [pushState, getUiState, bridge]);

  return <div ref={hostRef} className={className ?? "h-full w-full min-h-0"} />;
}
