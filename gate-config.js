var GATE_CONFIG = {
  // false = bramka prosi o wpisanie kodu (bez kamery); true = dawne skanowanie QR kamerą
  camera: false,
  // dokąd prowadzi „← wracam” i znaczki w rogu (start lawendy)
  returnHref: '/',
  codeGate: {
    label: 'wpisz kod',
    frame: ['swoje znajdki', 'tak oddaje', 'przeznaczenie', 'znaczy znaczek'],
    go: 'otwórz →',
    checking: 'sprawdzam',
    notFound: 'nie ma takiego kodu',
    banned: 'w kodach nie ma 0, O, 1, I, L ani U',
    known: 'z powrotem.',
    transferPersonal: ['ten kod ma już właściciela.', 'nie da się go przejąć.'],
    transferWild: ['ta znajdka jest teraz u kogoś.', 'kiedy ją puści, wpisz kod jeszcze raz.'],
    error: 'coś poszło nie tak',
    offline: 'brak połączenia',
    retry: 'spróbuj jeszcze raz',
    another: 'wpisz inny kod',
    back: '← wracam',
  },
  firstAccessCaption: 'otwarte.',
  intro: '~ hej.',
  activateLabel: 'czytaj',
  welcomeFirst: [
    { text: 'otwarte.', delay: 700 },
    { text: 'pierwsze wejście.', delay: 950 },
  ],
  welcomeReturning: [
    { text: 'z powrotem.', delay: 700 },
    { text: 'znajdka cię pamięta.', delay: 950 },
  ],
  noCodeIntro: [
    { text: '_ to nie błąd.', delay: 700 },
    { text: 'tu są wiersze.', delay: 950 },
    { text: '| wejście przez znajdkę.', delay: 1100 },
    { text: 'szukaj w warszawie.', delay: 1100 },
  ],
  noCodeScanLabel: 'skanuj znajdkę',
  noCodeManualInputLabel: 'mam znajdkę, wpiszę kod',
  noCodeReturnLabel: '← wracam',
  withCodeConfirm: [
    { text: 'pokaż znajdkę kamerze.', delay: 800 },
  ],
  withCodeActivateLabel: 'pokaż kamerze',
  scanStatuses: {
    searching: 'szukam znajdki',
    detected: 'widzę kod',
    opening: 'otwieram',
  },
  manualInputPrompt: 'wpisz kod ze znajdki',
  manualInputErrorInvalid: 'nie ma takiego kodu',
  protoManualLabel: 'wpisz kod ręcznie',
  cameraUnavailable: 'kamera niedostępna — wpisz kod',
  noAccess: [
    { text: 'brak dostępu.', delay: 700 },
    { text: 'wejdź przez znajdkę.', delay: 950 },
  ],
  transferFlow: [
    { text: 'ta znajdka ma już właściciela.', delay: 800 },
    { text: 'tej ścieżki nie da się przejąć.', delay: 1000 },
    { text: 'wróć i znajdź inną znajdkę.', delay: 1050 },
  ],
  notFound: [
    { text: 'nie ma takiego kodu.', delay: 650 },
  ],
  // Opcjonalne pytanie przy pierwszym wejściu. Można pominąć.
  tracePrompt: 'jak masz na imię?',
  traceHint: 'enter',
  traceSkipLabel: 'pomiń',
  tracePlaceholder: '',
  error: [
    { text: 'coś poszło nie tak.', delay: 550 },
  ],
  buttons: {
    read: 'czytaj',
    scanAgain: 'skanuj ponownie',
    findAnother: 'znajdź inną znajdkę',
    cancel: 'nie teraz',
    retry: 'spróbuj ponownie',
    manualSubmit: 'otwórz',
  },
};
