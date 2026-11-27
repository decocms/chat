import type { RoomTint } from "../home/api";

/** A room's color as a dot: the edit dialog's swatches (Gimenes #6163). */
export function tintDot(tint: RoomTint): string {
  switch (tint) {
    case null:
      return "border border-muted-foreground bg-background";
    case "blue":
      return "bg-room-tint-blue";
    case "green":
      return "bg-room-tint-green";
    case "yellow":
      return "bg-room-tint-yellow";
    case "orange":
      return "bg-room-tint-orange";
    case "pink":
      return "bg-room-tint-pink";
    case "purple":
      return "bg-room-tint-purple";
    default: {
      const unknown: never = tint;
      return unknown;
    }
  }
}

/** The color's name, in Portuguese; the caller translates it. */
export function tintName(tint: RoomTint): string {
  switch (tint) {
    case null:
      return "Sem cor";
    case "blue":
      return "Azul";
    case "green":
      return "Verde";
    case "yellow":
      return "Amarelo";
    case "orange":
      return "Laranja";
    case "pink":
      return "Rosa";
    case "purple":
      return "Roxo";
    default: {
      const unknown: never = tint;
      return unknown;
    }
  }
}
