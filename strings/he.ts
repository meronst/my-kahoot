/**
 * strings/he.ts — every piece of text the user sees, in one place.
 *
 * Why a strings file when the app is Hebrew-only?
 *  - One place to fix wording, typos or tone, without hunting through components.
 *  - Components stay readable: `t.home.title` instead of long Hebrew literals mixed into markup.
 *  - If an English or Arabic version is ever needed, we add `en.ts` with the same shape.
 *
 * `as const` makes TypeScript treat every value as a fixed literal (like a Java `static final`),
 * so a typo such as `t.home.titel` is a compile error, not an empty string at runtime.
 */
export const he = {
  app: {
    name: "החידון שלי",
    description: "חידון חי בעברית לשילוב בהרצאות",
  },
  home: {
    title: "החידון שלי",
    subtitle: "סרקו את קוד ה-QR שעל המסך, או הקלידו את קוד המשחק",
    pinLabel: "קוד המשחק",
    pinPlaceholder: "6 ספרות",
    go: "המשך",
    pinInvalid: "קוד המשחק הוא 6 ספרות",
  },
  join: {
    joiningQuiz: "הצטרפות לחידון",
    nicknameLabel: "הכינוי שלך",
    nicknameHint: "עד 20 תווים, כך יופיע השם על המסך",
    submit: "הצטרפות",
    submitting: "מצטרפים…",
    notFound: "לא נמצא חידון עם הקוד הזה. בדקו את הקוד ונסו שוב.",
    ended: "החידון הזה הסתיים",
    backHome: "הקלדת קוד אחר",
    errors: {
      nicknameTaken: "הכינוי הזה כבר תפוס, בחרו כינוי אחר",
      nicknameInvalid: "יש לבחור כינוי של 1 עד 20 תווים",
      inProgress: "הסבב כבר התחיל. אפשר להצטרף בהפסקה שבין הסבבים",
      ended: "החידון הזה הסתיים",
      notFound: "לא נמצא חידון עם הקוד הזה",
      tooMany: "יותר מדי הצטרפויות מהרשת הזו. פנו למנחה",
      generic: "ההצטרפות נכשלה. נסו שוב",
    },
  },
  play: {
    youAreIn: "נכנסת לחידון!",
    waitingToStart: "ממתינים שהמנחה יתחיל",
    paused: "הפסקה בין הסבבים. נתראה בסבב הבא!",
    inProgress: "החידון מתנהל: עקבו אחרי המסך",
    ended: "החידון הסתיים. תודה שהשתתפת!",
    score: "ניקוד",
    notJoined: "לא הצטרפת לחידון הזה",
    answerReceived: "התשובה התקבלה!",
    waitForReveal: "מחכים שכולם יענו…",
    timeUp: "נגמר הזמן לשאלה הזו",
    answerFailed: "התשובה לא נשלחה. נסו שוב",
    correct: "תשובה נכונה!",
    wrong: "לא נכון",
    noAnswer: "לא נשלחה תשובה",
    pointsEarned: "נקודות בשאלה הזו",
    totalScore: "הניקוד שלך",
    correctWas: "התשובה הנכונה:",
  },
  login: {
    title: "כניסת מנחה",
    email: "אימייל",
    password: "סיסמה",
    submit: "כניסה",
    submitting: "נכנס…",
    errors: {
      invalidCredentials: "האימייל או הסיסמה שגויים",
      emailNotConfirmed: "יש לאשר את כתובת האימייל לפני הכניסה",
      tooManyAttempts: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות",
      notHost: "לחשבון הזה אין הרשאת מנחה",
      missingFields: "יש למלא אימייל וסיסמה",
      generic: "הכניסה נכשלה. נסו שוב",
    },
  },
  host: {
    title: "אזור המנחה",
    loading: "טוען…",
    signedInAs: "מחובר בתור",
    signOut: "יציאה",
    quizzes: "החידונים שלי",
    noQuizzes: "עדיין אין חידונים",
    startSession: "התחלת חידון",
  },
  lobby: {
    joinAt: "הצטרפות לחידון:",
    scanOrEnter: "סרקו את הקוד או היכנסו לאתר והקלידו את הקוד",
    pinLabel: "קוד המשחק",
    playersJoined: "משתתפים שהצטרפו",
    waitingForPlayers: "ממתינים למשתתפים…",
    notFound: "החידון לא נמצא",
    qrAlt: "קוד QR להצטרפות לחידון",
  },
  projector: {
    start: "התחלת החידון",
    reveal: "הצגת התשובה",
    next: "לשאלה הבאה",
    resume: "המשך לסבב הבא",
    roundOf: "סבב",
    questionOf: "שאלה",
    of: "מתוך",
    answered: "ענו",
    secondsLeft: "שניות",
    noTimer: "ללא הגבלת זמן",
    correctAnswer: "התשובה הנכונה",
    leaderboard: "המובילים",
    points: "נקודות",
    paused: "הפסקה: נתראה בסבב הבא!",
    standings: "המצב עד עכשיו",
    nextRound: "הסבב הבא",
    lateJoin: "עוד לא הצטרפתם? זה הזמן",
    finished: "החידון הסתיים",
    actionFailed: "הפעולה נכשלה. נסו שוב",
    keyboardHint: "רווח = הפעולה הבאה",
    needPlayers: "ממתינים למשתתף ראשון",
  },
} as const;

/** Short alias used in components: `import { t } from "@/strings/he"`. */
export const t = he;
