import fs from "fs";

function fix(file, reps) {
  let s = fs.readFileSync(file, "utf8");
  let n = 0;
  for (const [a, b] of reps) {
    const parts = s.split(a);
    if (parts.length > 1) {
      n += parts.length - 1;
      s = parts.join(b);
    }
  }
  fs.writeFileSync(file, s);
  console.log(file, "replacements", n);
}

fix(
  "src/routes/about.tsx",
  [
    ["bg-[color:rgba(171,159,242,0.35)]", "bg-[rgba(171,159,242,0.35)]"],
    ["bg-[color:rgba(99,102,241,0.22)]", "bg-[rgba(99,102,241,0.22)]"],
    ["text-foreground/80", "text-(--foreground)/80"],
    ["text-background/70", "text-(--background)/70"],
    ["bg-card/80", "bg-(--card)/80"],
  ],
);

fix(
  "src/routes/openusd.tsx",
  [
    ["text-foreground/80", "text-(--foreground)/80"],
    ["bg-accent/15", "bg-(--accent)/15"],
    ["hover:border-accent/40", "hover:border-(--accent)/40"],
  ],
);

fix("src/routes/_authenticated/ai.tsx", [
  ["min-h-[2.25rem]", "min-h-9"],
  ["break-words", "wrap-break-word"],
]);

fix("src/routes/_authenticated/connect.tsx", [
  ["bg-gradient-to-br", "bg-linear-to-br"],
]);
