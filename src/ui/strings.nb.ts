/** All user-visible UI text (bokmål). Content packs carry their own language. */
export const strings = {
  appName: "Skolequiz",
  tagline: "Øv på det du lærer – i ditt eget tempo.",
  loading: "Laster spørsmål …",
  loadError: "Vi fikk ikke lastet spørsmålene. Sjekk nettet og last siden på nytt.",
  reload: "Last inn på nytt",

  // Start screen
  subject: "Fag",
  aimsLegend: "Kompetansemål",
  aimsHint: "Velg hva du vil øve på.",
  selectAll: "Velg alle",
  selectNone: "Fjern alle",
  questionCount: (n: number) => (n === 1 ? "1 spørsmål" : `${n} spørsmål`),
  lengthLegend: "Antall spørsmål",
  lengthAll: "Alle",
  onlyMissed: "Øv på det du bommet på sist",
  onlyMissedCount: (n: number) => (n === 0 ? "Ingen å øve på ennå" : `${n} spørsmål`),
  start: "Start",
  startDisabledNoAims: "Velg minst ett kompetansemål.",
  startDisabledEmpty: "Det finnes ingen spørsmål for dette valget.",
  privacy: "Fremgangen din lagres bare i denne nettleseren. Vi samler ikke inn noe om deg.",
  devBanner: "Utviklingsmodus: utkast og spørsmål til gjennomgang vises også.",

  // Quiz screen
  quit: "Avslutt",
  progress: (n: number, total: number) => `Spørsmål ${n} av ${total}`,
  trueLabel: "Sant",
  falseLabel: "Usant",
  correct: "Riktig!",
  notQuite: "Ikke helt.",
  correctAnswerIs: (label: string) => `Riktig svar: ${label}`,
  requeuedNote: "Du får dette spørsmålet igjen litt senere.",
  yourAnswer: "ditt svar",
  rightAnswer: "riktig svar",
  next: "Neste spørsmål",
  seeResults: "Se resultatet",
  keyboardHint: "Tips: Trykk 1–4 for å svare og Enter for å gå videre.",
  imageCredit: (credit: string, license: string) => `Bilde: ${credit} (${license})`,

  // Results screen
  resultsTitle: "Resultat",
  score: (correct: number, total: number) => `Du fikk ${correct} av ${total} riktig på første forsøk.`,
  scoreEncouragementHigh: "Sterkt jobbet!",
  scoreEncouragementMid: "Bra innsats. Øv litt mer på det du bommet på.",
  scoreEncouragementLow: "Fint at du øver! Prøv spørsmålene du bommet på en gang til.",
  perAimTitle: "Per kompetansemål",
  aimScore: (correct: number, attempted: number) => `${correct} av ${attempted}`,
  focusHere: "Øv mer her",
  practiceMissed: "Øv på spørsmålene du bommet på",
  newRound: "Ny runde",
  noAnswers: "Du svarte ikke på noen spørsmål i denne runden.",
} as const;

export type Strings = typeof strings;
