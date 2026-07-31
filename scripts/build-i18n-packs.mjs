/**
 * Merge translation sources → scripts/i18n-packs-data.json → src/i18n/locales/packs.ts
 * Run: node scripts/build-i18n-packs.mjs
 */
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

function deepMerge(base, patch) {
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object") {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Generate partial-a.json from _gen-i18n-packs.mjs
spawnSync(process.execPath, [join(__dirname, "_gen-i18n-packs.mjs")], {
  cwd: join(__dirname, ".."),
  stdio: "inherit",
});

const data = {};

const partialA = join(__dirname, "_partial-a.json");
if (existsSync(partialA)) {
  Object.assign(data, JSON.parse(readFileSync(partialA, "utf8")));
}

for (const name of ["_packs-b.mjs", "_packs-c.mjs", "_packs-d.mjs"]) {
  const mod = await import(pathToFileURL(join(__dirname, name)).href);
  const pack = mod.default ?? mod;
  for (const [code, patch] of Object.entries(pack)) {
    data[code] = data[code] ? deepMerge(data[code], patch) : patch;
  }
}

/** Extra locales not yet in pack scripts — full nav/settings/common translations. */
const EXTRA = {
  pa: {
    common: {
      loading: "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…",
      save: "ਸੇਵ",
      cancel: "ਰੱਦ ਕਰੋ",
      confirm: "ਪੁਸ਼ਟੀ",
      continue: "ਜਾਰੀ ਰੱਖੋ",
      back: "ਪਿੱਛੇ",
      close: "ਬੰਦ ਕਰੋ",
      done: "ਹੋ ਗਿਆ",
      search: "ਖੋਜ",
      copy: "ਕਾਪੀ",
      copied: "ਕਾਪੀ ਹੋ ਗਿਆ",
      signOut: "ਸਾਈਨ ਆਉਟ",
      amount: "ਰਕਮ",
      balance: "ਬਕਾਇਆ",
      wallet: "ਵਾਲਿਟ",
      goHome: "ਘਰ ਜਾਓ",
    },
    nav: {
      home: "ਘਰ",
      wallet: "ਵਾਲਿਟ",
      tokens: "ਟੋਕਨ",
      history: "ਇਤਿਹਾਸ",
      settings: "ਸੈਟਿੰਗਾਂ",
      send: "ਭੇਜੋ",
      receive: "ਪ੍ਰਾਪਤ ਕਰੋ",
      swap: "ਸਵੈਪ",
      buy: "ਖਰੀਦੋ",
      scan: "ਸਕੈਨ",
      deposit: "ਡਿਪਾਜ਼ਿਟ",
      blog: "ਬਲੌਗ",
      wiki: "ਵਿਕੀ",
      ai: "OpenPay AI",
    },
    language: {
      title: "ਡਿਸਪਲੇ ਭਾਸ਼ਾ",
      subtitle: "ਆਪਣੀ OpenPay Pro ਭਾਸ਼ਾ ਚੁਣੋ",
      searchPlaceholder: "ਭਾਸ਼ਾਵਾਂ ਖੋਜੋ",
      updated: "ਭਾਸ਼ਾ ਅੱਪਡੇਟ ਹੋਈ",
      current: "ਮੌਜੂਦਾ ਭਾਸ਼ਾ",
    },
    settings: {
      title: "ਸੈਟਿੰਗਾਂ",
      preferences: "ਪਸੰਦਾਂ",
      language: "ਭਾਸ਼ਾ",
      languageDesc: "ਇੰਟਰਫੇਸ ਭਾਸ਼ਾ",
      theme: "ਥੀਮ",
      currency: "ਮੁਦਰਾ",
    },
  },
  sw: {
    common: {
      loading: "Inapakia…",
      save: "Hifadhi",
      cancel: "Ghairi",
      confirm: "Thibitisha",
      continue: "Endelea",
      back: "Rudi",
      close: "Funga",
      done: "Imekamilika",
      search: "Tafuta",
      copy: "Nakili",
      copied: "Imenakiliwa",
      signOut: "Toka",
      amount: "Kiasi",
      balance: "Salio",
      wallet: "Pochi",
      goHome: "Nenda nyumbani",
    },
    nav: {
      home: "Nyumbani",
      wallet: "Pochi",
      tokens: "Tokeni",
      history: "Historia",
      settings: "Mipangilio",
      send: "Tuma",
      receive: "Pokea",
      swap: "Badilisha",
      buy: "Nunua",
      scan: "Changanua",
      deposit: "Weka",
      blog: "Blogu",
      wiki: "Wiki",
      ai: "OpenPay AI",
    },
    language: {
      title: "Lugha ya Kuonyesha",
      subtitle: "Chagua lugha yako ya OpenPay Pro",
      searchPlaceholder: "Tafuta lugha",
      updated: "Lugha imesasishwa",
      current: "Lugha ya sasa",
    },
    settings: {
      title: "Mipangilio",
      preferences: "Mapendeleo",
      language: "Lugha",
      languageDesc: "Lugha ya kiolesura",
      theme: "Mandhari",
      currency: "Sarafu",
    },
  },
  ta: {
    common: {
      loading: "ஏற்றுகிறது…",
      save: "சேமி",
      cancel: "ரத்து",
      confirm: "உறுதிப்படுத்து",
      continue: "தொடரவும்",
      back: "பின்",
      close: "மூடு",
      done: "முடிந்தது",
      search: "தேடு",
      copy: "நகலெடு",
      copied: "நகலெடுக்கப்பட்டது",
      signOut: "வெளியேறு",
      amount: "தொகை",
      balance: "இருப்பு",
      wallet: "பணப்பை",
      goHome: "முகப்புக்குச் செல்",
    },
    nav: {
      home: "முகப்பு",
      wallet: "பணப்பை",
      tokens: "டோக்கன்கள்",
      history: "வரலாறு",
      settings: "அமைப்புகள்",
      send: "அனுப்பு",
      receive: "பெறு",
      swap: "மாற்று",
      buy: "வாங்கு",
      scan: "ஸ்கேன்",
      deposit: "வைப்பு",
      blog: "வலைப்பதிவு",
      wiki: "விக்கி",
      ai: "OpenPay AI",
    },
    language: {
      title: "காட்சி மொழி",
      subtitle: "உங்கள் OpenPay Pro மொழியைத் தேர்ந்தெடுக்கவும்",
      searchPlaceholder: "மொழிகளைத் தேடு",
      updated: "மொழி புதுப்பிக்கப்பட்டது",
      current: "தற்போதைய மொழி",
    },
    settings: {
      title: "அமைப்புகள்",
      preferences: "விருப்பங்கள்",
      language: "மொழி",
      languageDesc: "இடைமுக மொழி",
      theme: "தீம்",
      currency: "நாணயம்",
    },
  },
  te: {
    common: {
      loading: "లోడ్ అవుతోంది…",
      save: "సేవ్",
      cancel: "రద్దు",
      confirm: "నిర్ధారించు",
      continue: "కొనసాగించు",
      back: "వెనుకకు",
      close: "మూసివేయి",
      done: "పూర్తయింది",
      search: "వెతుకు",
      copy: "కాపీ",
      copied: "కాపీ అయింది",
      signOut: "సైన్ అవుట్",
      amount: "మొత్తం",
      balance: "బ్యాలెన్స్",
      wallet: "వాలెట్",
      goHome: "హోమ్‌కి వెళ్లు",
    },
    nav: {
      home: "హోమ్",
      wallet: "వాలెట్",
      tokens: "టోకెన్లు",
      history: "చరిత్ర",
      settings: "సెట్టింగ్‌లు",
      send: "పంపు",
      receive: "స్వీకరించు",
      swap: "స్వాప్",
      buy: "కొను",
      scan: "స్కాన్",
      deposit: "డిపాజిట్",
      blog: "బ్లాగ్",
      wiki: "వికీ",
      ai: "OpenPay AI",
    },
    language: {
      title: "డిస్‌ప్లే భాష",
      subtitle: "మీ OpenPay Pro భాషను ఎంచుకోండి",
      searchPlaceholder: "భాషలు వెతకండి",
      updated: "భాష నవీకరించబడింది",
      current: "ప్రస్తుత భాష",
    },
    settings: {
      title: "సెట్టింగ్‌లు",
      preferences: "ప్రాధాన్యతలు",
      language: "భాష",
      languageDesc: "ఇంటర్‌ఫేస్ భాష",
      theme: "థీమ్",
      currency: "కరెన్సీ",
    },
  },
  yo: {
    common: {
      loading: "Ń ṣe àkójọpọ̀…",
      save: "Fi pamọ́",
      cancel: "Fagilé",
      confirm: "Jẹ́rìísí",
      continue: "Tẹ̀síwájú",
      back: "Padà",
      close: "Tì í",
      done: "Ti parí",
      search: "Ṣàwárí",
      copy: "Dàákọ",
      copied: "Ti dàákọ",
      signOut: "Jáde",
      amount: "Iye",
      balance: "Ìwọ̀ntúnwọ̀nsì",
      wallet: "Àpò owó",
      goHome: "Lọ sí ilé",
    },
    nav: {
      home: "Ilé",
      wallet: "Àpò owó",
      tokens: "Àwọn tóòkẹ̀nì",
      history: "Ìtàn",
      settings: "Àwọn ètò",
      send: "Firánṣẹ́",
      receive: "Gba",
      swap: "Pààrọ̀",
      buy: "Ra",
      scan: "Ṣàyẹ̀wò",
      deposit: "Fi síi",
      blog: "Búlọ́ọ̀gì",
      wiki: "Wiki",
      ai: "OpenPay AI",
    },
    language: {
      title: "Èdè ìfihàn",
      subtitle: "Yan èdè OpenPay Pro rẹ",
      searchPlaceholder: "Ṣàwárí àwọn èdè",
      updated: "Èdè ti sọ̀dọ̀tun",
      current: "Èdè lọ́wọ́lọ́wọ́",
    },
    settings: {
      title: "Àwọn ètò",
      preferences: "Àwọn ààyò",
      language: "Èdè",
      languageDesc: "Èdè ojú ìwòye",
      theme: "Àkóónú",
      currency: "Owó",
    },
  },
};

for (const [code, patch] of Object.entries(EXTRA)) {
  data[code] = data[code] ? deepMerge(data[code], patch) : patch;
}

/** Ensure every pack has newer nav keys (deposit/blog/wiki/ai) when missing. */
const NAV_EXTRAS_EN = {
  deposit: "Deposit",
  blog: "Blog",
  wiki: "Wiki",
  ai: "OpenPay AI",
  developer: "Developer",
  agentConnect: "Agent Connect",
  depositGateway: "Deposit gateway",
};

for (const patch of Object.values(data)) {
  if (!patch.nav) patch.nav = {};
  for (const [k, v] of Object.entries(NAV_EXTRAS_EN)) {
    if (patch.nav[k] == null) patch.nav[k] = v;
  }
}

const outJson = join(__dirname, "i18n-packs-data.json");
writeFileSync(outJson, JSON.stringify(data, null, 2), "utf8");
console.log("Wrote", outJson, "locales:", Object.keys(data).sort().join(", "));

spawnSync(process.execPath, [join(__dirname, "generate-i18n-packs.mjs")], {
  cwd: join(__dirname, ".."),
  stdio: "inherit",
});
