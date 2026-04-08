// fabric.js v5 ships its own d.ts for v6+ but not for v5; declare an
// untyped module so the dynamic import in components/FloorCanvas.tsx
// type-checks. The component itself contains all fabric usage and
// localizes `any` there.
declare module "fabric";
