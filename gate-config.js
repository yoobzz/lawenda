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
  transferConfirm: 'przejmij',
  welcomeTransferred: [
    { text: 'gotowe.', delay: 700 },
    { text: 'tamten dostęp wygasł.', delay: 950 },
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
    { text: 'jeśli przejmiesz — tamten dostęp zgaśnie.', delay: 1050 },
  ],
  notFound: [
    { text: 'nie ma takiego kodu.', delay: 650 },
  ],
  error: [
    { text: 'coś poszło nie tak.', delay: 550 },
  ],
  buttons: {
    read: 'czytaj',
    transfer: 'przejmij',
    cancel: 'nie teraz',
    retry: 'spróbuj ponownie',
    manualSubmit: 'otwórz',
    locationAllow: 'jasne',
    locationSkip: 'wolę nie',
  },
  locationConsent: [
    { text: 'chcę wiedzieć, gdzie znalazłeś znajdkę.', delay: 600 },
    { text: 'mogę sprawdzić twoją lokalizację?', delay: 900 },
  ],
};
