import * as Phaser from "phaser";
import type {
  PokerAllowedAction,
  PokerNavigateTarget,
  PokerSeatUi,
  PokerTableBridge,
  PokerTableUiState,
} from "../poker-table-ui-types";

const COL_BG = 0x1a0a0f;
const COL_FELT = 0x0e4a32;
const COL_FELT_EDGE = 0x063822;
const COL_GOLD = 0xf0c85c;
const COL_INK = 0x0c0c10;
const COL_CARD = 0xfdfcfa;

const LAYOUT_6: { x: number; y: number }[] = [
  { x: 0.5, y: 0.86 },
  { x: 0.16, y: 0.74 },
  { x: 0.16, y: 0.26 },
  { x: 0.5, y: 0.14 },
  { x: 0.84, y: 0.26 },
  { x: 0.84, y: 0.74 },
];

function seatPos(seatIndex: number, n: number, w: number, h: number): { x: number; y: number } {
  if (n === 6 && seatIndex < 6) {
    const L = LAYOUT_6[seatIndex]!;
    return { x: L.x * w, y: L.y * h };
  }
  const cx = w * 0.5;
  const cy = h * 0.48;
  const rx = w * 0.38;
  const ry = h * 0.34;
  const ang = -Math.PI / 2 + (seatIndex * (2 * Math.PI)) / Math.max(n, 1);
  return {
    x: cx + Math.cos(ang) * rx * 0.92,
    y: cy + Math.sin(ang) * ry * 0.92,
  };
}

function formatCard(code: string): string {
  if (code.length !== 2) return code;
  const r = code[0]!.toUpperCase();
  const rank = r === "T" ? "10" : r;
  const s = code[1]!.toLowerCase();
  const suit = s === "h" ? "♥" : s === "d" ? "♦" : s === "c" ? "♣" : s === "s" ? "♠" : s;
  return `${rank}${suit}`;
}

type RaiseConfirmMode = "raise_to" | "bet";

export class PokerTableScene extends Phaser.Scene {
  private state: PokerTableUiState | null = null;
  private seatContainers: Phaser.GameObjects.Container[] = [];
  private topBar!: Phaser.GameObjects.Container;
  private menuLayer!: Phaser.GameObjects.Container;
  private bannerText!: Phaser.GameObjects.Text;
  private potText!: Phaser.GameObjects.Text;
  private streetText!: Phaser.GameObjects.Text;
  private boardRoot!: Phaser.GameObjects.Container;
  private actionBar!: Phaser.GameObjects.Container;
  private raisePanel!: Phaser.GameObjects.Container;
  private raiseAmount = 0;
  private raiseConfirmMode: RaiseConfirmMode = "raise_to";
  private prevStreetPuts: number[] = [];
  private sliderTrackW = 0;
  private sliderThumb!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: "PokerTableScene" });
  }

  create() {
    this.game.events.on("poker-ui-update", this.applyStateFromRegistry, this);
    this.applyStateFromRegistry();
  }

  private getBridge(): PokerTableBridge {
    return this.game.registry.get("bridge") as PokerTableBridge;
  }

  private applyStateFromRegistry = () => {
    const s = this.game.registry.get("pokerUiState") as PokerTableUiState | undefined;
    if (s) this.applyState(s);
  };

  applyState(s: PokerTableUiState) {
    const prev = this.state;
    this.state = s;
    const w = s.width;
    const h = s.height;

    this.children.removeAll(true);
    this.seatContainers = [];

    this.add.rectangle(w / 2, h / 2, w, h, COL_BG);

    const cx = w * 0.5;
    const cy = h * 0.46;
    const rx = Math.min(w * 0.38, h * 0.32);
    const ry = h * 0.36;
    const felt = this.add.graphics();
    felt.fillStyle(COL_FELT_EDGE, 1);
    felt.fillEllipse(cx, cy, rx * 2 + 8, ry * 2 + 8);
    felt.fillStyle(COL_FELT, 1);
    felt.fillEllipse(cx, cy, rx * 2, ry * 2);
    felt.lineStyle(2, COL_GOLD, 0.55);
    felt.strokeEllipse(cx, cy, rx * 2 - 4, ry * 2 - 4);

    this.topBar = this.add.container(0, 0);
    this.menuLayer = this.add.container(0, 0);
    this.menuLayer.setVisible(false);
    this.menuLayer.setDepth(1000);
    this.buildTopBar(w, s);
    this.buildMenuLayer(w);

    this.bannerText = this.add
      .text(w / 2, 58, "", {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "12px",
        color: "#fde68a",
      })
      .setOrigin(0.5)
      .setDepth(50);

    this.potText = this.add
      .text(cx, cy - h * 0.1, "", {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "15px",
        color: "#fef3c7",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    this.streetText = this.add
      .text(cx, cy - h * 0.1 - 22, "", {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "11px",
        color: "#94a3b8",
      })
      .setOrigin(0.5);

    this.potText.setText(`Pot $${s.pot.toLocaleString()}`);
    this.streetText.setText(s.streetLabel ? `${s.streetLabel}` : " ");

    this.boardRoot = this.add.container(cx, cy - h * 0.02);
    this.renderBoard(s);

    for (let i = 0; i < s.maxPlayers; i++) {
      const seat = s.seats[i];
      if (!seat) continue;
      const p = seatPos(i, s.maxPlayers, w, h);
      const c = this.buildSeat(p.x, p.y, seat, s, i);
      this.seatContainers.push(c);
      this.add.existing(c);
    }

    this.detectChipDeltas(prev, s, cx, cy);

    this.actionBar = this.add.container(0, h - 112);
    this.raisePanel = this.add.container(0, h - 300);
    this.raisePanel.setVisible(false);
    this.raisePanel.setDepth(900);
    this.buildActionBar(w, s);
    this.buildRaisePanel(w, h, s);

    this.updateBanner(s);
  }

  private buildTopBar(w: number, s: PokerTableUiState) {
    const pad = 10;
    const y = 24;
    const mkBtn = (x: number, label: string, onClick: () => void) => {
      const g = this.add.graphics();
      g.fillStyle(COL_INK, 0.92);
      g.lineStyle(2, COL_GOLD, 0.55);
      g.fillCircle(0, 0, 18);
      g.strokeCircle(0, 0, 18);
      const t = this.add
        .text(0, 0, label, {
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: label.length > 1 ? "11px" : "14px",
          color: "#fef3c7",
        })
        .setOrigin(0.5);
      const z = this.add.zone(0, 0, 44, 44).setInteractive({ useHandCursor: true });
      z.on("pointerup", onClick);
      return this.add.container(x, y, [g, t, z]);
    };

    const menuBtn = mkBtn(pad + 22, "☰", () => {
      this.menuLayer.setVisible(!this.menuLayer.visible);
    });

    const hand =
      s.handSeq != null ? `Hand #${s.handSeq}` : "Waiting";
    const title = this.add.text(w / 2, y - 8, `${s.tableName}\n${hand} · ${s.blindsLabel}`, {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "10px",
      color: "#e2e8f0",
      align: "center",
    });
    title.setOrigin(0.5);

    const liveColor = s.liveReady ? "#86efac" : s.live ? "#fcd34d" : "#64748b";
    const liveLabel = this.add.text(w / 2, y + 18, s.liveReady ? "Live" : s.live ? "…" : "Off", {
      fontSize: "9px",
      color: liveColor,
      fontStyle: "700",
    });
    liveLabel.setOrigin(0.5);

    const back = mkBtn(w - pad - 22, "←", () => this.getBridge().onBack());
    const leave = mkBtn(w - pad - 66, "✕", () => {
      if (typeof window !== "undefined" && window.confirm("Leave this table?")) {
        this.getBridge().onLeave();
      }
    });
    const info = mkBtn(w - pad - 110, "i", () => this.getBridge().onNavigate("settings"));

    this.topBar.add([menuBtn, title, liveLabel, back, leave, info]);
  }

  private buildMenuLayer(w: number) {
    const bg = this.add.rectangle(w / 2, 120, w * 0.72, 200, 0x0a0a0c, 0.96).setStrokeStyle(1, COL_GOLD, 0.35);
    bg.setInteractive();
    const mkNav = (y: number, label: string, to: PokerNavigateTarget) => {
      const t = this.add
        .text(w / 2, y, label, {
          fontSize: "13px",
          color: "#e2e8f0",
          fontStyle: "700",
        })
        .setOrigin(0.5);
      const z = this.add.zone(w / 2, y, w * 0.65, 36).setInteractive({ useHandCursor: true });
      z.on("pointerup", () => {
        this.menuLayer.setVisible(false);
        this.getBridge().onNavigate(to);
      });
      return [t, z];
    };
    const close = this.add
      .text(w / 2, 210, "Close", { fontSize: "11px", color: "#94a3b8" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on("pointerup", () => this.menuLayer.setVisible(false));

    const closeTbl = this.add
      .text(w / 2, 236, "Close table for everyone", {
        fontSize: "10px",
        color: "#fca5a5",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeTbl.on("pointerup", () => {
      this.menuLayer.setVisible(false);
      if (typeof window !== "undefined" && window.confirm("Close this table for everyone?")) {
        this.getBridge().onCloseTable();
      }
    });

    this.menuLayer.add([
      bg,
      ...mkNav(44, "Lobby", "lobby"),
      ...mkNav(78, "All tables", "tables"),
      ...mkNav(112, "Practice", "play"),
      ...mkNav(146, "Settings", "settings"),
      close,
      closeTbl,
    ]);
  }

  private buildSeat(x: number, y: number, seat: PokerSeatUi, s: PokerTableUiState, seatIndex: number) {
    const cont = this.add.container(x, y);
    const isHero = s.viewerSeatIndex === seatIndex;
    const isAct = s.activeSeatIndex === seatIndex && s.phase === "betting";

    const avatar = this.add.graphics();
    if (isAct) {
      avatar.lineStyle(5, 0x4ade80, 0.95);
      avatar.strokeCircle(0, -6, 44);
    }
    if (isHero) {
      avatar.lineStyle(2, COL_GOLD, 0.95);
      avatar.strokeCircle(0, -6, 40);
    }
    avatar.fillStyle(seat.userId ? 0x334155 : 0x1e293b, seat.folded ? 0.45 : 0.95);
    avatar.fillCircle(0, -6, 26);
    avatar.lineStyle(1, 0x64748b, 0.8);
    avatar.strokeCircle(0, -6, 26);

    const timerRing = this.add.graphics();
    timerRing.setName("timerRing");

    const name = seat.userId
      ? seat.userId.length > 10
        ? `${seat.userId.slice(0, 9)}…`
        : seat.userId
      : `Seat ${seatIndex + 1}`;
    const nameT = this.add.text(0, -48, name, {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "11px",
      color: isHero ? "#86efac" : "#f1f5f9",
      fontStyle: "600",
    });
    nameT.setOrigin(0.5);

    const stackT = this.add.text(0, 28, seat.stack != null ? `$${seat.stack.toLocaleString()}` : "—", {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "10px",
      color: "#f0c85c",
      fontStyle: "700",
    });
    stackT.setOrigin(0.5);

    const betT =
      seat.userId && seat.streetPut > 0
        ? this.add.text(0, 42, `Bet $${seat.streetPut.toLocaleString()}`, {
            fontSize: "9px",
            color: "#bae6fd",
            fontStyle: "700",
          })
        : null;
    if (betT) betT.setOrigin(0.5);

    let sitBtn: Phaser.GameObjects.Container | undefined;
    if (!seat.userId && s.live && s.viewerSeatIndex === null) {
      const bg = this.add.graphics();
      bg.fillStyle(0x166534, 1);
      bg.fillRoundedRect(-36, 8, 72, 28, 8);
      bg.lineStyle(1, COL_GOLD, 0.6);
      bg.strokeRoundedRect(-36, 8, 72, 28, 8);
      const st = this.add.text(0, 22, s.sitPendingSeat === seatIndex ? "…" : "SIT", {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "12px",
        color: "#ecfdf5",
        fontStyle: "900",
      });
      st.setOrigin(0.5);
      const z = this.add.zone(0, 22, 76, 32).setInteractive({ useHandCursor: true });
      z.on("pointerup", () => {
        if (s.sitPendingSeat == null) this.getBridge().onSit(seatIndex);
      });
      sitBtn = this.add.container(0, 0, [bg, st, z]);
    }

    const badges: Phaser.GameObjects.GameObject[] = [];
    if (seat.isButton) {
      badges.push(
        this.add.text(28, -28, "D", {
          fontSize: "11px",
          color: "#0f172a",
          fontStyle: "900",
          backgroundColor: "#f8fafc",
          padding: { x: 6, y: 3 },
        }),
      );
    }
    if (seat.isSb)
      badges.push(
        this.add.text(-32, -28, "SB", {
          fontSize: "9px",
          color: "#0f172a",
          fontStyle: "900",
          backgroundColor: "#93c5fd",
          padding: { x: 4, y: 2 },
        }),
      );
    if (seat.isBb)
      badges.push(
        this.add.text(-32, -14, "BB", {
          fontSize: "9px",
          color: "#0f172a",
          fontStyle: "900",
          backgroundColor: "#fbbf24",
          padding: { x: 4, y: 2 },
        }),
      );
    if (seat.folded && seat.userId) {
      const f = this.add.text(0, 8, "FOLD", {
        fontSize: "9px",
        color: "#fca5a5",
        fontStyle: "800",
      });
      f.setOrigin(0.5);
      badges.push(f);
    }

    const parts: Phaser.GameObjects.GameObject[] = [timerRing, avatar, nameT, stackT];
    if (betT) parts.push(betT);

    if (seat.holeCards) {
      const [a, b] = seat.holeCards;
      const cw = Math.min(38, s.width * 0.09);
      const ch = cw * 1.35;
      parts.push(this.makeCardSprite(-cw / 2 - 3, 14, cw, ch, a), this.makeCardSprite(3, 14, cw, ch, b));
    } else if (seat.userId && !seat.folded && s.showHoleBacksForOthers && !isHero) {
      const cw = 22;
      const ch = 30;
      parts.push(this.makeCardBack(-cw - 2, 4, cw, ch), this.makeCardBack(-4, 8, cw, ch));
    } else if (seat.userId && !seat.folded && isHero && s.showHoleBacksForOthers && !seat.holeCards) {
      const cw = 22;
      const ch = 30;
      parts.push(this.makeCardBack(-cw - 2, 4, cw, ch), this.makeCardBack(-4, 8, cw, ch));
    }

    parts.push(...badges);
    if (sitBtn) parts.push(sitBtn);
    cont.add(parts);

    if (isAct && s.turnDeadlineMs) {
      cont.bringToTop(timerRing);
    }

    return cont;
  }

  private makeCardSprite(x: number, y: number, cw: number, ch: number, code: string) {
    const gr = this.add.graphics();
    gr.fillStyle(COL_CARD, 1);
    gr.fillRoundedRect(x, y, cw, ch, 5);
    gr.lineStyle(1, 0x94a3b8, 0.8);
    gr.strokeRoundedRect(x, y, cw, ch, 5);
    const t = this.add.text(x + cw / 2, y + ch / 2, formatCard(code), {
      fontSize: "11px",
      color: "#0f172a",
      fontStyle: "700",
    });
    t.setOrigin(0.5);
    return this.add.container(0, 0, [gr, t]);
  }

  private makeCardBack(x: number, y: number, cw: number, ch: number) {
    const gr = this.add.graphics();
    gr.fillStyle(0x1a1528, 1);
    gr.fillRoundedRect(x, y, cw, ch, 4);
    gr.lineStyle(1, COL_GOLD, 0.5);
    gr.strokeRoundedRect(x, y, cw, ch, 4);
    const t = this.add.text(x + cw / 2, y + ch / 2, "♠", {
      fontSize: "12px",
      color: "#fbbf24",
    });
    t.setOrigin(0.5);
    return this.add.container(0, 0, [gr, t]);
  }

  private renderBoard(s: PokerTableUiState) {
    this.boardRoot.removeAll(true);
    const overlap = 18;
    const ch = Math.min(58, s.height * 0.12);
    const cw = ch / 1.35;
    const total = s.board.length * cw - (s.board.length > 0 ? (s.board.length - 1) * overlap : 0);
    const maxW = s.width * 0.85;
    let scale = 1;
    if (total > maxW) scale = maxW / total;
    const w = cw * scale;
    const h = ch * scale;
    const o = overlap * scale;
    let x = (-(s.board.length * w - (s.board.length > 0 ? (s.board.length - 1) * o : 0))) / 2;
    for (const code of s.board) {
      const gr = this.add.graphics();
      gr.fillStyle(COL_CARD, 1);
      gr.fillRoundedRect(x, -h / 2, w, h, 5);
      gr.lineStyle(1, 0x94a3b8, 0.8);
      gr.strokeRoundedRect(x, -h / 2, w, h, 5);
      const t = this.add.text(x + w / 2, 0, formatCard(code), {
        fontSize: `${Math.max(10, 12 * scale)}px`,
        color: "#0f172a",
        fontStyle: "700",
      });
      t.setOrigin(0.5);
      this.boardRoot.add(gr);
      this.boardRoot.add(t);
      x += w - o;
    }
  }

  private buildActionBar(w: number, s: PokerTableUiState) {
    const bar = this.add.graphics();
    bar.fillStyle(0x000000, 0.55);
    bar.fillRect(0, 0, w, 112);
    this.actionBar.add(bar);

    if (!s.live || !s.isViewerTurn || s.allowedActions.length === 0) {
      const msg =
        !s.live && s.viewerSeatIndex !== null
          ? "Offline — set NEXT_PUBLIC_API_URL for live play"
          : s.live && !s.liveReady && s.viewerSeatIndex !== null
            ? "Connecting to live table…"
          : s.isViewerTurn && !s.live
            ? "Offline"
            : "";
      const t = this.add.text(w / 2, 48, msg, {
        fontSize: "11px",
        color: "#64748b",
      });
      t.setOrigin(0.5);
      this.actionBar.add(t);
      return;
    }

    const acts = s.allowedActions;
    const col = Math.min(3, acts.length);
    const gap = 8;
    const bw = (w - gap * (col + 1)) / col;
    let x = gap;
    for (let i = 0; i < acts.length && i < 6; i++) {
      const a = acts[i]!;
      const btn = this.makeActionButton(x, 12, bw, 52, a, s);
      this.actionBar.add(btn);
      x += bw + gap;
    }
  }

  private makeActionButton(
    x: number,
    y: number,
    bw: number,
    bh: number,
    a: PokerAllowedAction,
    s: PokerTableUiState,
  ) {
    const colors =
      a.id === "fold"
        ? { fill: 0xb91c1c, stroke: 0x7f1d1d }
        : a.id === "check" || a.id === "call"
          ? { fill: 0x15803d, stroke: 0x14532d }
          : { fill: 0x1d4ed8, stroke: 0x172554 };
    const g = this.add.graphics();
    g.fillStyle(colors.fill, 1);
    g.fillRoundedRect(x, y, bw, bh, 14);
    g.lineStyle(2, colors.stroke, 0.9);
    g.strokeRoundedRect(x, y, bw, bh, 14);
    const t = this.add.text(x + bw / 2, y + bh / 2, a.label, {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "12px",
      color: "#ffffff",
      fontStyle: "800",
      align: "center",
      wordWrap: { width: bw - 8 },
    });
    t.setOrigin(0.5);
    const z = this.add.zone(x + bw / 2, y + bh / 2, bw, bh).setInteractive({ useHandCursor: true });
    z.on("pointerup", () => this.dispatchAction(a, s));
    return this.add.container(0, 0, [g, t, z]);
  }

  private dispatchAction(a: PokerAllowedAction, s: PokerTableUiState) {
    const b = this.getBridge();
    if (!s.useEngineActions) {
      if (a.id === "fold") b.onTableAction("fold");
      if (a.id === "check") b.onTableAction("check");
      return;
    }
    if (a.id === "fold") b.onEngineAction({ type: "fold" });
    if (a.id === "check") b.onEngineAction({ type: "check" });
    if (a.id === "call") b.onEngineAction({ type: "call" });
    if (a.id === "bet") {
      this.raiseConfirmMode = "bet";
      this.raiseAmount = Math.min(
        Math.max(a.amount ?? s.bigBlind, s.raisePanelMin),
        s.raisePanelMax,
      );
      this.raisePanel.setVisible(true);
      this.refreshRaisePanel(s);
      return;
    }
    if (a.id === "raise") {
      this.raiseConfirmMode = "raise_to";
      this.raiseAmount = Math.min(
        Math.max(a.amount ?? s.defaultRaiseTo, s.raisePanelMin),
        s.raisePanelMax,
      );
      this.raisePanel.setVisible(true);
      this.refreshRaisePanel(s);
      return;
    }
    if (a.id === "allin" && a.amount != null) b.onEngineAction({ type: "raise_to", amount: a.amount });
  }

  private clampRaise(s: PokerTableUiState) {
    this.raiseAmount = Math.min(s.raisePanelMax, Math.max(s.raisePanelMin, Math.floor(this.raiseAmount)));
  }

  private buildRaisePanel(w: number, _h: number, s: PokerTableUiState) {
    const panelH = 248;
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a0c, 0.96);
    bg.fillRoundedRect(12, 0, w - 24, panelH, 16);
    bg.lineStyle(1, COL_GOLD, 0.35);
    bg.strokeRoundedRect(12, 0, w - 24, panelH, 16);
    this.raisePanel.add(bg);

    const amt = this.add.text(w / 2, 26, "", {
      fontSize: "18px",
      color: "#fef3c7",
      fontStyle: "800",
    });
    amt.setOrigin(0.5);
    amt.setName("raiseAmt");
    this.raisePanel.add(amt);

    const rowY = 52;
    const cell = (w - 48) / 2 - 6;
    const mk = (label: string, bx: number, by: number, onClick: () => void) => {
      const g = this.add.graphics();
      g.fillStyle(0x27272a, 1);
      g.fillRoundedRect(bx, by, cell, 34, 10);
      const t = this.add.text(bx + cell / 2, by + 17, label, {
        fontSize: "11px",
        color: "#e2e8f0",
        fontStyle: "700",
      });
      t.setOrigin(0.5);
      const z = this.add.zone(bx + cell / 2, by + 17, cell, 34).setInteractive({ useHandCursor: true });
      z.on("pointerup", onClick);
      this.raisePanel.add([g, t, z]);
    };

    const half = () => {
      this.raiseAmount = Math.floor(s.pot / 2);
      this.clampRaise(s);
      this.refreshRaisePanel(s);
    };
    const potb = () => {
      this.raiseAmount = s.pot;
      this.clampRaise(s);
      this.refreshRaisePanel(s);
    };
    const all = () => {
      const my = s.viewerSeatIndex != null ? s.seats[s.viewerSeatIndex] : null;
      if (my?.stack != null) this.raiseAmount = my.stack + (my.streetPut ?? 0);
      this.clampRaise(s);
      this.refreshRaisePanel(s);
    };
    const minR = () => {
      this.raiseAmount = s.raisePanelMin;
      this.refreshRaisePanel(s);
    };

    mk("Min", 18, rowY, minR);
    mk("½ Pot", 18 + cell + 12, rowY, half);
    mk("Pot", 18, rowY + 40, potb);
    mk("All-in", 18 + cell + 12, rowY + 40, all);

    const trackY = rowY + 92;
    const trackX = 28;
    this.sliderTrackW = w - 56;
    const track = this.add.graphics();
    track.fillStyle(0x27272a, 1);
    track.fillRoundedRect(trackX, trackY, this.sliderTrackW, 8, 4);
    this.raisePanel.add(track);

    const thumb = this.add.graphics();
    thumb.fillStyle(COL_GOLD, 1);
    thumb.fillCircle(0, 0, 10);
    this.sliderThumb = this.add.container(trackX, trackY + 4, [thumb]);
    this.sliderThumb.setName("raiseThumb");
    this.sliderThumb.setInteractive({ useHandCursor: true });
    this.raisePanel.add(this.sliderThumb);
    this.input.setDraggable(this.sliderThumb);
    this.sliderThumb.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number) => {
      const st = this.state;
      if (!st) return;
      const minX = 28;
      const maxX = 28 + this.sliderTrackW;
      const nx = Phaser.Math.Clamp(this.sliderThumb.x + dragX, minX, maxX);
      this.sliderThumb.setX(nx);
      const u = this.sliderTrackW > 0 ? (nx - minX) / this.sliderTrackW : 0;
      const span = Math.max(1, st.raisePanelMax - st.raisePanelMin);
      this.raiseAmount = Math.floor(st.raisePanelMin + u * span);
      const tAmt = this.raisePanel.getByName("raiseAmt") as Phaser.GameObjects.Text;
      if (tAmt) tAmt.setText(`$ ${this.raiseAmount.toLocaleString()}`);
      const lab = this.raisePanel.getByName("raiseConfirmLabel") as Phaser.GameObjects.Text;
      if (lab) lab.setText(this.raiseConfirmMode === "bet" ? "Confirm Bet" : "Confirm Raise");
    });

    mk("-", 18, trackY + 28, () => {
      this.raiseAmount -= s.bigBlind;
      this.clampRaise(s);
      this.refreshRaisePanel(s);
    });
    mk("+", 18 + cell + 12, trackY + 28, () => {
      this.raiseAmount += s.bigBlind;
      this.clampRaise(s);
      this.refreshRaisePanel(s);
    });
    const confirm = this.add.graphics();
    confirm.fillStyle(0xf59e0b, 1);
    confirm.fillRoundedRect(18, panelH - 72, w - 36, 40, 12);
    const ct = this.add.text(w / 2, panelH - 52, "Confirm Raise", {
      fontSize: "13px",
      color: "#0f172a",
      fontStyle: "900",
    });
    ct.setOrigin(0.5);
    ct.setName("raiseConfirmLabel");
    const cz = this.add.zone(w / 2, panelH - 52, w - 36, 40).setInteractive({ useHandCursor: true });
    cz.on("pointerup", () => {
      const b = this.getBridge();
      if (this.raiseConfirmMode === "bet") {
        b.onEngineAction({ type: "bet", amount: Math.floor(this.raiseAmount) });
      } else {
        b.onEngineAction({ type: "raise_to", amount: Math.floor(this.raiseAmount) });
      }
      this.raisePanel.setVisible(false);
    });
    const cancel = this.add.text(w / 2, panelH - 18, "Cancel", {
      fontSize: "12px",
      color: "#94a3b8",
    });
    cancel.setOrigin(0.5);
    cancel.setInteractive({ useHandCursor: true });
    cancel.on("pointerup", () => this.raisePanel.setVisible(false));

    this.raisePanel.add([confirm, ct, cz, cancel]);
    this.refreshRaisePanel(s);
  }

  private refreshRaisePanel(s: PokerTableUiState) {
    this.clampRaise(s);
    const t = this.raisePanel.getByName("raiseAmt") as Phaser.GameObjects.Text;
    if (t) t.setText(`$ ${this.raiseAmount.toLocaleString()}`);
    const span = Math.max(1, s.raisePanelMax - s.raisePanelMin);
    const u = (this.raiseAmount - s.raisePanelMin) / span;
    const tx = 28 + u * this.sliderTrackW;
    if (this.sliderThumb) this.sliderThumb.setX(tx);

    const lab = this.raisePanel.getByName("raiseConfirmLabel") as Phaser.GameObjects.Text;
    if (lab) lab.setText(this.raiseConfirmMode === "bet" ? "Confirm Bet" : "Confirm Raise");
  }

  private updateBanner(s: PokerTableUiState) {
    this.bannerText.setText(s.banner ?? "");
  }

  private updateTimerRing(s: PokerTableUiState) {
    if (!s.turnDeadlineMs || s.activeSeatIndex == null) return;
    const idx = s.activeSeatIndex;
    const cont = this.seatContainers[idx];
    if (!cont) return;
    const ring = cont.getByName("timerRing") as Phaser.GameObjects.Graphics | null;
    if (!ring || !(ring instanceof Phaser.GameObjects.Graphics)) return;
    ring.clear();
    const total = Math.max(1000, s.turnTimerTotalMs);
    const left = Math.max(0, s.turnDeadlineMs - Date.now());
    const p = Phaser.Math.Clamp(left / total, 0, 1);
    ring.lineStyle(5, 0x4ade80, 0.9);
    ring.beginPath();
    ring.arc(0, -6, 38, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2, false);
    ring.strokePath();
  }

  private detectChipDeltas(prev: PokerTableUiState | null, s: PokerTableUiState, cx: number, cy: number) {
    const sameHand =
      prev &&
      (prev.handSeq ?? null) === (s.handSeq ?? null) &&
      prev.phase === s.phase;
    if (!sameHand) {
      this.prevStreetPuts = s.seats.map((x) => x.streetPut);
      return;
    }
    for (let i = 0; i < s.seats.length; i++) {
      const d = s.seats[i]!.streetPut - (this.prevStreetPuts[i] ?? 0);
      if (d > 0) {
        const p = seatPos(i, s.maxPlayers, s.width, s.height);
        this.tweenChip(p.x, p.y, cx, cy - s.height * 0.08);
      }
    }
    this.prevStreetPuts = s.seats.map((x) => x.streetPut);
  }

  update() {
    const s = this.state;
    if (!s) return;
    this.updateTimerRing(s);
  }

  private tweenChip(x0: number, y0: number, x1: number, y1: number) {
    const g = this.add.graphics({ x: x0, y: y0 });
    g.fillStyle(COL_GOLD, 0.95);
    g.fillCircle(0, 0, 7);
    this.tweens.add({
      targets: g,
      x: x1,
      y: y1,
      duration: 420,
      ease: "Sine.easeInOut",
      onComplete: () => {
        g.destroy();
      },
    });
  }

  shutdown() {
    this.game.events.off("poker-ui-update", this.applyStateFromRegistry, this);
  }
}
