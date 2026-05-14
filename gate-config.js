var GATE_CONFIG = {
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
