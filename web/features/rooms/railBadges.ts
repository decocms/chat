// Where a rail tile's badges sit (like Discord's rail): the red number always inside the bottom right corner, the
// green call speaker always inside the top right. Both are 16px and reach only 2px past the tile, so the badges of
// two tiles in a row (10px apart, mt-2.5) keep the rail between their rings. Static class names, so Tailwind sees them.
/** The red number on a rail tile: smaller than the app's Count (18px), for the 36px tile. */
export const RAIL_COUNT = "h-4 min-w-4 px-1 text-2xs";
export const RAIL_COUNT_AT = "absolute -right-0.5 -bottom-0.5";
export const RAIL_CALL_AT = "-top-0.5 -right-0.5";
